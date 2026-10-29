<?php

namespace App\Http\Controllers;

use App\Models\RevisaoIa;
use App\Models\TransacaoCredito;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RevisaoImagemController extends Controller
{
    /**
     * Compara duas imagens enviadas diretamente (sem vínculo a pedido/arte).
     * POST /api/revisao/comparar
     *
     * Multipart:
     *   imagem_referencia  — briefing / referência do cliente
     *   imagem_arte        — arte finalizada pelo designer
     *   contexto           — (opcional) texto com informações do pedido
     */
    public function comparar(Request $request): JsonResponse
    {
        $request->validate([
            'imagem_referencia' => 'required|file|mimes:jpg,jpeg,png,webp|max:10240',
            'imagem_arte'       => 'required|file|mimes:jpg,jpeg,png,webp|max:10240',
            'contexto'          => 'nullable|string|max:1000',
        ]);

        $user = auth()->user();
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

        $ref  = $request->file('imagem_referencia');
        $arte = $request->file('imagem_arte');

        // Upscale automático: se menor que 1400px, dobra o tamanho antes de enviar
        // Melhora significativamente a leitura de textos pequenos e circulares
        $refMime  = $this->mimeFromExt($ref->getClientOriginalExtension());
        $arteMime = $this->mimeFromExt($arte->getClientOriginalExtension());

        $refData  = base64_encode($this->upscaleSeNecessario($ref->getRealPath(),  $refMime));
        $arteData = base64_encode($this->upscaleSeNecessario($arte->getRealPath(), $arteMime));

        $content = [
            [
                'type'      => 'image_url',
                'image_url' => ['url' => "data:{$refMime};base64,{$refData}"],
            ],
            [
                'type'      => 'image_url',
                'image_url' => ['url' => "data:{$arteMime};base64,{$arteData}"],
            ],
            [
                'type' => 'text',
                'text' => $this->buildPrompt($request->contexto),
            ],
        ];

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
            return response()->json(['message' => 'Erro de conexão com a IA. Tente novamente.'], 502);
        }

        if (!$response->ok()) {
            $msg = $response->json('error.message') ?? $response->body();
            Log::error('OpenRouter response error: ' . $msg);
            return response()->json(['message' => "Erro na IA: {$msg}"], 502);
        }

        // OpenRouter: choices[0].message.content
        $rawText = $response->json('choices.0.message.content') ?? '';

        if (preg_match('/\{[\s\S]*\}/m', $rawText, $m)) {
            $resultado = json_decode($m[0], true);
        } else {
            $resultado = json_decode($rawText, true);
        }

        if (!$resultado || !isset($resultado['erros'])) {
            Log::warning('OpenRouter JSON inválido: ' . $rawText);
            return response()->json(['message' => 'A IA não retornou uma resposta válida. Tente novamente.'], 502);
        }

        // Salva no histórico
        $erros        = $resultado['erros'] ?? [];
        $criticos     = count(array_filter($erros, fn($e) => ($e['gravidade'] ?? '') === 'critico'));
        $atencoes     = count(array_filter($erros, fn($e) => ($e['gravidade'] ?? '') === 'atencao'));
        $informativos = count(array_filter($erros, fn($e) => ($e['gravidade'] ?? '') === 'informativo'));

        RevisaoIa::create([
            'user_id'      => auth()->id(),
            'pedido_id'    => $request->integer('pedido_id') ?: null,
            'contexto'     => $request->contexto,
            'resumo'       => $resultado['resumo'] ?? '',
            'aprovada'     => $resultado['aprovada'] ?? false,
            'total_erros'  => count($erros),
            'criticos'     => $criticos,
            'atencoes'     => $atencoes,
            'informativos' => $informativos,
            'erros'        => $erros,
        ]);

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
                'descricao'           => 'Análise de arte com IA',
                'pago_em'             => now(),
            ]);
        }

        $resultado['creditos_restantes'] = $saldoRestante;

        return response()->json($resultado);
    }

    /**
     * GET /api/revisao/historico — últimas 50 revisões do usuário autenticado.
     */
    public function historico(): JsonResponse
    {
        $revisoes = RevisaoIa::where('user_id', auth()->id())
            ->with('pedido:id,titulo')
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn(RevisaoIa $r) => [
                'id'           => $r->id,
                'aprovada'     => $r->aprovada,
                'resumo'       => $r->resumo,
                'contexto'     => $r->contexto,
                'total_erros'  => $r->total_erros,
                'criticos'     => $r->criticos,
                'atencoes'     => $r->atencoes,
                'informativos' => $r->informativos,
                'erros'        => $r->erros,
                'pedido'       => $r->pedido ? ['id' => $r->pedido->id, 'titulo' => $r->pedido->titulo] : null,
                'created_at'   => $r->created_at->toISOString(),
            ]);

        return response()->json($revisoes);
    }

    /**
     * Se a imagem for menor que 1400px de largura, redimensiona para 2x.
     * Textos pequenos e circulares ficam muito mais legíveis para a IA.
     * Retorna os bytes da imagem (upscalada ou original).
     */
    private function upscaleSeNecessario(string $path, string $mime): string
    {
        if (!function_exists('imagecreatefromstring')) {
            // GD não disponível — retorna original
            return file_get_contents($path);
        }

        $bytes = file_get_contents($path);
        $img   = @imagecreatefromstring($bytes);

        if (!$img) return $bytes;

        $w = imagesx($img);
        $h = imagesy($img);

        // Só faz upscale se menor que 1400px e não maior que 3000px já
        if ($w >= 1400 || $w > 3000) {
            imagedestroy($img);
            return $bytes;
        }

        // Escalar para no mínimo 1600px de largura, máximo 2x o tamanho original
        $fator  = max(2.0, 1600 / $w);
        $novoW  = (int) ($w * $fator);
        $novoH  = (int) ($h * $fator);

        $canvas = imagecreatetruecolor($novoW, $novoH);

        // Fundo transparente para PNG
        if ($mime === 'image/png') {
            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
            $transparente = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
            imagefilledrectangle($canvas, 0, 0, $novoW, $novoH, $transparente);
        }

        imagecopyresampled($canvas, $img, 0, 0, 0, 0, $novoW, $novoH, $w, $h);

        ob_start();
        match ($mime) {
            'image/png'  => imagepng($canvas, null, 6),
            'image/webp' => imagewebp($canvas, null, 90),
            default      => imagejpeg($canvas, null, 92),
        };
        $resultado = ob_get_clean();

        imagedestroy($img);
        imagedestroy($canvas);

        Log::info("Imagem upscalada: {$w}x{$h} → {$novoW}x{$novoH}");

        return $resultado;
    }

    private function mimeFromExt(string $ext): string
    {
        return match (strtolower($ext)) {
            'jpg','jpeg' => 'image/jpeg',
            'png'        => 'image/png',
            'webp'       => 'image/webp',
            default      => 'image/jpeg',
        };
    }

    private function buildPrompt(?string $contexto): string
    {
        $ctx = $contexto
            ? "\n\nContexto fornecido: {$contexto}"
            : '';

        return <<<PROMPT
Você é um revisor especialista em artes gráficas para produção de camisetas e uniformes.
A PRIMEIRA imagem é a REFERÊNCIA (briefing / modelo pedido pelo cliente).
A SEGUNDA imagem é a ARTE FINAL criada pelo designer.{$ctx}

═══════════════════════════════════════
ANÁLISE DE TEXTOS — PRIORIDADE MÁXIMA
═══════════════════════════════════════
Leia e analise TODOS os textos das duas imagens, incluindo:
- Textos grandes e pequenos
- Textos curvados, circulares ou rotacionados
- Textos dentro de selos, brasões, escudos, fitas e emblemas
- Textos nas laterais ou bordas
- Números de telefone, redes sociais, endereços

Compare LETRA POR LETRA cada texto da arte final com a referência. Verifique:
✗ Acentos faltando ou errados (ex: "ELEUTERIO" em vez de "ELEUTÉRIO")
✗ Cedilha faltando (ex: "CONCEICAO" em vez de "CONCEIÇÃO")
✗ Letras trocadas (ex: "PDRCELANATARIA" em vez de "PORCELANATARIA")
✗ Letras faltando ou a mais
✗ Nomes próprios grafados diferente da referência
✗ Sobrenomes com erro ortográfico
✗ Qualquer diferença em nome próprio = ERRO CRÍTICO obrigatório

═══════════════════════════════════════
ANÁLISE VISUAL
═══════════════════════════════════════
1. INCONSISTÊNCIAS — elementos presentes na referência e ausentes na arte ou vice-versa (logos, selos, fitas, brasões, estrelas, símbolos)
2. CORES — diferenças significativas de cor entre referência e arte
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
⚠ Somente reporte um erro se você conseguir LER o texto errado exatamente como está escrito na arte.
⚠ Se um texto estiver desfocado, pequeno demais ou ilegível, NÃO reporte erro ortográfico — apenas mencione que o texto não está legível.
⚠ Não confunda palavras parecidas. Leia letra por letra.
⚠ Se você não tem certeza do que está escrito, não reporte como erro.
⚠ Apenas relate diferenças REAIS entre o que está na imagem_1 e o que está na imagem_2.

Retorne APENAS o JSON abaixo, sem nenhum texto fora dele:
{
  "erros": [
    {
      "tipo": "ortografico | visual | cor | layout | logo",
      "gravidade": "critico | atencao | informativo",
      "descricao": "Cite EXATAMENTE o texto que você leu na arte e como está na referência",
      "localizacao": "Onde está na imagem (ex: selo circular central, fita inferior, lateral direita)",
      "imagem_referencia": "imagem_1 | imagem_2 | ambas",
      "sugestao": "Como corrigir, citando o texto correto entre aspas"
    }
  ],
  "resumo": "Diagnóstico geral em 1-2 frases destacando os erros mais graves",
  "aprovada": true | false
}

IMPORTANTE: aprovada só pode ser true se NÃO houver NENHUM erro crítico ou de atenção.
Se a arte estiver 100% fiel à referência, retorne erros vazio e aprovada true.
PROMPT;
    }
}
