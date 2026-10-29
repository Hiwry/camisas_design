<?php

namespace App\Http\Controllers;

use App\Models\Arte;
use App\Models\Pedido;
use App\Models\TransacaoCredito;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RevisaoArteController extends Controller
{
    public function revisar(Request $request, Pedido $pedido): JsonResponse
    {
        $request->validate([
            'arte_id'          => 'required|integer|exists:artes,id',
            'arte_comparar_id' => 'nullable|integer|exists:artes,id',
        ]);

        $user = auth()->user();
        if ($user && !$user->isAdmin() && $user->confeccao?->id !== $pedido->confeccao_id) {
            abort(403, 'Acesso não autorizado a este pedido.');
        }

        $confeccao = $user?->confeccao;

        // Se NÃO for admin, é obrigatório ter créditos de IA
        if ($user && !$user->isAdmin()) {
            $saldoCreditos = $confeccao ? (int) $confeccao->creditos_ia : (int) ($user->creditos_ia ?? 0);
            if ($saldoCreditos <= 0) {
                return response()->json([
                    'message'         => 'Você não possui créditos suficientes para realizar a análise por IA. Cada análise custa R$ 5,00. Adquira créditos para continuar.',
                    'sem_creditos'    => true,
                    'creditos_atuais' => 0,
                ], 403);
            }
        }

        $apiKey = config('services.openrouter.key');
        if (!$apiKey) {
            return response()->json([
                'message' => 'OPENROUTER_API_KEY não configurada no .env do backend.',
            ], 503);
        }

        $arte    = Arte::findOrFail($request->arte_id);
        if ($arte->pedido_id !== $pedido->id) abort(404);

        $urlArte = $arte->preview_url ?? $this->urlSeImagem($arte->arquivo_url, $arte->arquivo_tipo);
        if (!$urlArte) {
            return response()->json([
                'message' => 'Esta versão não possui imagem para análise. Envie uma arte com JPG, PNG ou WebP.',
            ], 422);
        }

        $arteComparar = null;
        $urlComparar  = null;
        if ($request->arte_comparar_id) {
            $arteComparar = Arte::findOrFail($request->arte_comparar_id);
            if ($arteComparar->pedido_id !== $pedido->id) abort(404);
            $urlComparar  = $arteComparar->preview_url
                ?? $this->urlSeImagem($arteComparar->arquivo_url, $arteComparar->arquivo_tipo);
            if (!$urlComparar) $arteComparar = null;
        }

        $comparando = $arteComparar !== null;

        // Montar content no formato OpenRouter / OpenAI vision
        $content = [];

        $img1 = $this->imagemParaOpenRouter($urlArte);
        if (!$img1) {
            return response()->json(['message' => 'Não foi possível carregar a imagem da arte.'], 422);
        }
        $content[] = $img1;

        if ($comparando) {
            $img2 = $this->imagemParaOpenRouter($urlComparar);
            if ($img2) {
                $content[] = $img2;
            } else {
                $comparando = false;
            }
        }

        $content[] = [
            'type' => 'text',
            'text' => $comparando ? $this->promptComparacao() : $this->promptSimples(),
        ];

        $resultado = $this->chamarIA($apiKey, $content);
        if (isset($resultado['error'])) {
            return response()->json(['message' => $resultado['error']], 502);
        }

        // Deduz 1 crédito se NÃO for admin
        $saldoRestante = 'ilimitado';
        if ($user && !$user->isAdmin()) {
            if ($confeccao) {
                $confeccao->decrement('creditos_ia', 1);
                $saldoRestante = (int) $confeccao->fresh()->creditos_ia;
            } elseif ($user->creditos_ia > 0) {
                $user->decrement('creditos_ia', 1);
                $saldoRestante = (int) $user->fresh()->creditos_ia;
            }

            TransacaoCredito::create([
                'confeccao_id'        => $confeccao?->id,
                'user_id'             => $user->id,
                'quantidade_creditos' => -1,
                'valor_total'         => 0.00,
                'tipo'                => 'consumo',
                'status'              => 'pago',
                'descricao'           => "Revisão de arte IA no Pedido #{$pedido->id}",
                'pago_em'             => now(),
            ]);
        }

        return response()->json(array_merge($resultado, [
            'comparacao'         => $comparando,
            'arte_versao'        => $arte->versao,
            'comparar_versao'    => $arteComparar?->versao,
            'creditos_restantes' => $saldoRestante,
        ]));
    }

    /* ── Helpers ── */

    private function chamarIA(string $apiKey, array $content): array
    {
        try {
            $response = Http::timeout(90)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'HTTP-Referer'  => config('app.url', 'http://localhost'),
                    'X-Title'       => config('app.name', 'Camiseta Design'),
                    'Content-Type'  => 'application/json',
                ])
                ->post(config('services.openrouter.base_url') . '/chat/completions', [
                    'model'      => config('services.openrouter.model', 'anthropic/claude-sonnet-4-5'),
                    'max_tokens' => 2048,
                    'messages'   => [
                        ['role' => 'user', 'content' => $content],
                    ],
                ]);
        } catch (\Exception $e) {
            Log::error('OpenRouter error: ' . $e->getMessage());
            return ['error' => 'Erro de conexão com a IA. Tente novamente.'];
        }

        if (!$response->ok()) {
            $msg = $response->json('error.message') ?? $response->body();
            Log::error('OpenRouter response error: ' . $msg);
            return ['error' => "Erro na IA: {$msg}"];
        }

        // OpenRouter retorna choices[0].message.content
        $rawText = $response->json('choices.0.message.content') ?? '';

        if (preg_match('/\{[\s\S]*\}/m', $rawText, $m)) {
            $resultado = json_decode($m[0], true);
        } else {
            $resultado = json_decode($rawText, true);
        }

        if (!$resultado || !isset($resultado['erros'])) {
            Log::warning('OpenRouter JSON inválido: ' . $rawText);
            return ['error' => 'A IA não retornou uma resposta válida. Tente novamente.'];
        }

        return $resultado;
    }

    private function imagemParaOpenRouter(string $url): ?array
    {
        try {
            $response = Http::timeout(15)->get($url);
            if (!$response->ok()) return null;

            $mime    = $this->mimeFromUrl($url);
            $base64  = base64_encode($response->body());

            return [
                'type'      => 'image_url',
                'image_url' => ['url' => "data:{$mime};base64,{$base64}"],
            ];
        } catch (\Exception $e) {
            Log::warning("Falha ao carregar imagem {$url}: " . $e->getMessage());
            return null;
        }
    }

    private function urlSeImagem(?string $url, ?string $tipo): ?string
    {
        if (!$url) return null;
        $ext = strtolower($tipo ?? pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
        return in_array($ext, ['jpg','jpeg','png','webp','gif']) ? $url : null;
    }

    private function mimeFromUrl(string $url): string
    {
        $ext = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
        return match ($ext) {
            'jpg','jpeg' => 'image/jpeg',
            'png'        => 'image/png',
            'webp'       => 'image/webp',
            'gif'        => 'image/gif',
            default      => 'image/jpeg',
        };
    }

    private function promptComparacao(): string
    {
        return <<<'PROMPT'
Você é um revisor especialista em artes gráficas para produção de camisetas e uniformes.
A primeira imagem é a versão NOVA (atual). A segunda imagem é a versão ANTERIOR (referência).

═══════════════════════════════════════
ANÁLISE DE TEXTOS — PRIORIDADE MÁXIMA
═══════════════════════════════════════
Leia e analise TODOS os textos das duas imagens, incluindo:
- Textos grandes e pequenos
- Textos curvados, circulares ou rotacionados
- Textos dentro de selos, brasões, escudos, fitas e emblemas
- Textos nas laterais ou bordas
- Números de telefone, redes sociais, endereços

Compare LETRA POR LETRA cada texto entre as versões. Verifique:
✗ Acentos faltando ou errados (ex: "ELEUTERIO" em vez de "ELEUTÉRIO")
✗ Cedilha faltando (ex: "CONCEICAO" em vez de "CONCEIÇÃO")
✗ Letras trocadas (ex: "PDRCELANATARIA" em vez de "PORCELANATARIA")
✗ Letras faltando ou a mais
✗ Nomes próprios grafados de forma diferente entre as versões
✗ Sobrenomes com erro ortográfico
✗ Qualquer diferença em nome próprio = ERRO CRÍTICO obrigatório

═══════════════════════════════════════
ANÁLISE VISUAL
═══════════════════════════════════════
1. INCONSISTÊNCIAS — elementos presentes em uma versão e ausentes em outra (logos, selos, fitas, brasões, estrelas, símbolos)
2. CORES — diferenças significativas de cor entre as versões
3. LAYOUT — posicionamento, tamanho ou alinhamento de elementos alterados
4. LOGO — versão diferente, partes faltando ou distorção

═══════════════════════════════════════
REGRAS DE GRAVIDADE
═══════════════════════════════════════
- CRÍTICO: qualquer erro em nome próprio, sobrenome, acento em nome, letras trocadas em palavras-chave
- ATENÇÃO: diferenças de cor, elementos faltando, erros em textos secundários
- INFORMATIVO: diferenças de layout, espaçamento

═══════════════════════════════════════
REGRAS ANTI-ALUCINAÇÃO — OBRIGATÓRIAS
═══════════════════════════════════════
⚠ NUNCA invente, suponha ou complete texto que não está claramente legível na imagem.
⚠ Somente reporte um erro se você conseguir LER o texto errado exatamente como está escrito.
⚠ Se um texto estiver desfocado, pequeno demais ou ilegível, NÃO reporte erro ortográfico.
⚠ Não confunda palavras parecidas. Leia letra por letra.
⚠ Se você não tem certeza do que está escrito, não reporte como erro.
⚠ Apenas relate diferenças REAIS entre o que está em cada versão.

Retorne APENAS o JSON abaixo, sem nenhum texto fora dele:
{
  "erros": [
    {
      "tipo": "ortografico | visual | cor | layout | logo",
      "gravidade": "critico | atencao | informativo",
      "descricao": "Cite EXATAMENTE o texto que você leu e como deveria ser",
      "localizacao": "Onde está na imagem (ex: selo circular central, fita inferior, lateral direita)",
      "imagem_referencia": "imagem_1 | imagem_2 | ambas",
      "sugestao": "Como corrigir, citando o texto correto entre aspas"
    }
  ],
  "resumo": "Diagnóstico geral em 1-2 frases destacando os erros mais graves",
  "aprovada": true | false
}

IMPORTANTE: aprovada só pode ser true se NÃO houver NENHUM erro crítico ou de atenção.
PROMPT;
    }

    private function promptSimples(): string
    {
        return <<<'PROMPT'
Você é um revisor especialista em artes gráficas para produção de camisetas e uniformes.
Analise a imagem enviada e identifique TODOS os problemas que possam causar erro na produção.

═══════════════════════════════════════
ANÁLISE DE TEXTOS — PRIORIDADE MÁXIMA
═══════════════════════════════════════
Leia TODOS os textos da imagem, incluindo:
- Textos grandes e pequenos
- Textos curvados, circulares ou rotacionados
- Textos dentro de selos, brasões, escudos, fitas e emblemas
- Textos nas laterais ou bordas

Verifique letra por letra:
✗ Acentos faltando ou errados
✗ Cedilha faltando
✗ Letras trocadas ou faltando
✗ Nomes próprios com erro ortográfico
✗ Qualquer erro em nome próprio = ERRO CRÍTICO obrigatório

═══════════════════════════════════════
ANÁLISE VISUAL
═══════════════════════════════════════
1. PROBLEMAS VISUAIS — elementos desalinhados, sobrepostos, fora de proporção
2. PROBLEMAS DE COR — baixo contraste, cores problemáticas para impressão
3. PROBLEMAS DE LAYOUT — composição geral, margens, espaçamento
4. PROBLEMAS NO LOGO — logo ilegível, distorcido ou com qualidade insuficiente

═══════════════════════════════════════
REGRAS ANTI-ALUCINAÇÃO — OBRIGATÓRIAS
═══════════════════════════════════════
⚠ NUNCA invente, suponha ou complete texto que não está claramente legível na imagem.
⚠ Somente reporte um erro se você conseguir LER o texto errado exatamente como está escrito.
⚠ Se um texto estiver desfocado, pequeno demais ou ilegível, NÃO reporte erro ortográfico.
⚠ Não confunda palavras parecidas. Leia letra por letra.
⚠ Se você não tem certeza do que está escrito, não reporte como erro.

Retorne APENAS o JSON abaixo, sem nenhum texto fora dele:
{
  "erros": [
    {
      "tipo": "ortografico | visual | cor | layout | logo",
      "gravidade": "critico | atencao | informativo",
      "descricao": "Cite EXATAMENTE o texto que você leu e como deveria ser",
      "localizacao": "Onde está na imagem (ex: selo circular central, fita inferior, lateral direita)",
      "imagem_referencia": "imagem_1",
      "sugestao": "Como corrigir, citando o texto correto entre aspas"
    }
  ],
  "resumo": "Diagnóstico geral em 1-2 frases destacando os erros mais graves",
  "aprovada": true | false
}

IMPORTANTE: aprovada só pode ser true se NÃO houver NENHUM erro crítico ou de atenção.
Se a arte estiver perfeita, retorne erros vazio e aprovada true.
PROMPT;
    }
}
