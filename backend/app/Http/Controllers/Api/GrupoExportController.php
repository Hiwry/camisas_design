<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grupo;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GrupoExportController extends Controller
{
    /**
     * Retorna os totais agregados e a matriz de produção para o Admin e a Confecção.
     */
    public function totaisProducao(Request $request, $grupoId)
    {
        $grupo = Grupo::with(['modelos', 'participantes.modelo', 'confeccao'])->findOrFail($grupoId);
        $user = $request->user();

        // Permissão
        if ($user->isConfeccao()) {
            if ($grupo->confeccao_id !== $user->confeccao?->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }
        } elseif (!$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $participantes = $grupo->participantes;

        // 1. Total por tamanho
        $porTamanho = [];
        // 2. Total por modelo
        $porModelo = [];
        // 3. Grade cruzada (Modelo -> Cor -> Tamanho -> Quantidade)
        $grade = [];
        // 4. Lista de nomes e números com detecção de números duplicados
        $numerosContagem = [];
        $listaNomesNumeros = [];

        $totalPecas = 0;

        foreach ($participantes as $p) {
            $qtd = (int) $p->quantidade;
            $totalPecas += $qtd;

            $tam = strtoupper(trim($p->tamanho ?: 'Único'));
            $modeloNome = $p->modelo ? $p->modelo->nome : 'Geral';
            $cor = trim($p->cor ?: 'Padrão');

            // Total por tamanho
            $porTamanho[$tam] = ($porTamanho[$tam] ?? 0) + $qtd;

            // Total por modelo
            $porModelo[$modeloNome] = ($porModelo[$modeloNome] ?? 0) + $qtd;

            // Matriz Grade
            if (!isset($grade[$modeloNome])) {
                $grade[$modeloNome] = [];
            }
            if (!isset($grade[$modeloNome][$cor])) {
                $grade[$modeloNome][$cor] = [];
            }
            $grade[$modeloNome][$cor][$tam] = ($grade[$modeloNome][$cor][$tam] ?? 0) + $qtd;

            // Nomes e números
            if (!empty($p->numero_camisa)) {
                $numStr = trim((string) $p->numero_camisa);
                $numerosContagem[$numStr] = ($numerosContagem[$numStr] ?? 0) + 1;
            }

            $listaNomesNumeros[] = [
                'id' => $p->id,
                'nome_completo' => $p->nome_completo,
                'modelo' => $modeloNome,
                'cor' => $cor,
                'tamanho' => $tam,
                'quantidade' => $qtd,
                'nome_camisa' => $p->nome_camisa,
                'numero_camisa' => $p->numero_camisa,
                'apelido' => $p->apelido,
                'frase_costas' => $p->frase_costas,
                'observacao' => $p->observacao,
            ];
        }

        // Marca quem tem número repetido
        $numerosRepetidos = array_keys(array_filter($numerosContagem, fn($c) => $c > 1));

        foreach ($listaNomesNumeros as &$item) {
            $num = trim((string) ($item['numero_camisa'] ?? ''));
            $item['numero_duplicado'] = !empty($num) && in_array($num, $numerosRepetidos);
        }

        return response()->json([
            'grupo' => [
                'id' => $grupo->id,
                'nome' => $grupo->nome,
                'cliente_nome' => $grupo->cliente_nome,
                'cliente_whatsapp' => $grupo->cliente_whatsapp,
                'confeccao_nome' => $grupo->confeccao?->nome,
                'status' => $grupo->status,
                'prazo_limite' => $grupo->prazo_limite,
                'total_esperado' => $grupo->total_esperado,
                'pedido_minimo' => $grupo->pedido_minimo,
                'imagem_capa' => $grupo->imagem_capa,
                'tabela_medidas_url' => $grupo->tabela_medidas_url,
            ],
            'total_pecas' => $totalPecas,
            'por_tamanho' => $porTamanho,
            'por_modelo' => $porModelo,
            'grade' => $grade,
            'numeros_repetidos' => $numerosRepetidos,
            'lista_nomes_numeros' => $listaNomesNumeros,
        ]);
    }

    /**
     * Exporta CSV da Ordem de Produção (UTF-8 com BOM para Excel).
     */
    public function exportarCsv(Request $request, $grupoId)
    {
        $grupo = Grupo::with(['modelos', 'participantes.modelo'])->findOrFail($grupoId);
        
        $user = $request->user();
        if (!$user && $request->filled('token')) {
            $tokenObj = \Laravel\Sanctum\PersonalAccessToken::findToken($request->query('token'));
            if ($tokenObj) {
                $user = $tokenObj->tokenable;
            }
        }

        if ($user && $user->isConfeccao()) {
            if ($grupo->confeccao_id !== $user->confeccao?->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }
        } elseif ($user && !$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $filename = 'ordem_producao_' . \Illuminate\Support\Str::slug($grupo->nome) . '_' . date('Ymd_His') . '.csv';

        $response = new StreamedResponse(function () use ($grupo) {
            $handle = fopen('php://output', 'w');
            // BOM UTF-8 para Excel abrir sem quebrar caracteres com acentuação
            fprintf($handle, chr(0xEF).chr(0xBB).chr(0xBF));

            // Cabeçalho da Ordem
            fputcsv($handle, ['ORDEM DE PRODUÇÃO - GRUPO DE CAMISAS'], ';');
            fputcsv($handle, ['Grupo:', $grupo->nome], ';');
            fputcsv($handle, ['Data Exportação:', date('d/m/Y H:i')], ';');
            fputcsv($handle, ['Status:', $grupo->status], ';');
            fputcsv($handle, ['Total de Peças:', $grupo->participantes->sum('quantidade')], ';');
            fputcsv($handle, [], ';');

            // Lista de Participantes e Personalizações
            fputcsv($handle, [
                'ID',
                'Nome Completo',
                'Modelo',
                'Cor',
                'Tamanho',
                'Qtd',
                'Nome na Camisa',
                'Número',
                'Apelido',
                'Frase Costas',
                'Observação'
            ], ';');

            foreach ($grupo->participantes as $p) {
                // Neutraliza fórmulas (=,+,-,@) para evitar CSV/Excel injection
                $seguro = fn ($v) => (is_string($v) && $v !== '' && in_array($v[0], ['=', '+', '-', '@', "	", "
"], true)) ? "'" . $v : $v;
                fputcsv($handle, [
                    $p->id,
                    $seguro($p->nome_completo),
                    $p->modelo ? $seguro($p->modelo->nome) : 'N/A',
                    $seguro($p->cor),
                    $seguro($p->tamanho),
                    $p->quantidade,
                    $seguro($p->nome_camisa ?? ''),
                    $seguro($p->numero_camisa ?? ''),
                    $seguro($p->apelido ?? ''),
                    $seguro($p->frase_costas ?? ''),
                    $seguro($p->observacao ?? ''),
                ], ';');
            }

            fclose($handle);
        });

        $response->headers->set('Content-Type', 'text/csv; charset=UTF-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="' . $filename . '"');

        return $response;
    }

    /**
     * Exporta PDF da Ordem de Produção formatada para download direto.
     */
    public function exportarPdf(Request $request, $grupoId)
    {
        try {
            $grupo = Grupo::with(['modelos', 'user', 'confeccao', 'participantes.modelo'])->findOrFail($grupoId);
            
            $user = $request->user();
            if (!$user && $request->filled('token')) {
                $tokenObj = \Laravel\Sanctum\PersonalAccessToken::findToken($request->query('token'));
                if ($tokenObj) {
                    $user = $tokenObj->tokenable;
                }
            }

            if ($user && $user->isConfeccao()) {
                if ($grupo->confeccao_id !== $user->confeccao?->id) {
                    return response()->json(['message' => 'Acesso negado.'], 403);
                }
            } elseif ($user && !$user->isAdmin() && $grupo->user_id !== $user->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }

            $participantes = $grupo->participantes ?? collect();

            $porTamanho = [];
            $porModelo = [];
            $numerosContagem = [];
            $listaNomesNumeros = [];
            $totalPecas = 0;

            foreach ($participantes as $p) {
                $qtd = (int) $p->quantidade;
                $totalPecas += $qtd;

                $tam = strtoupper(trim($p->tamanho ?: 'Único'));
                $modeloNome = $p->modelo ? $p->modelo->nome : 'Geral';
                $cor = trim($p->cor ?: 'Padrão');

                $porTamanho[$tam] = ($porTamanho[$tam] ?? 0) + $qtd;
                $porModelo[$modeloNome] = ($porModelo[$modeloNome] ?? 0) + $qtd;

                if (!empty($p->numero_camisa)) {
                    $numStr = trim((string) $p->numero_camisa);
                    $numerosContagem[$numStr] = ($numerosContagem[$numStr] ?? 0) + 1;
                }

                $listaNomesNumeros[] = [
                    'id' => $p->id,
                    'nome_completo' => $p->nome_completo,
                    'modelo' => $modeloNome,
                    'cor' => $cor,
                    'tamanho' => $tam,
                    'quantidade' => $qtd,
                    'nome_camisa' => $p->nome_camisa,
                    'numero_camisa' => $p->numero_camisa,
                    'apelido' => $p->apelido,
                    'frase_costas' => $p->frase_costas,
                    'observacao' => $p->observacao,
                ];
            }

            $numerosRepetidos = array_keys(array_filter($numerosContagem, fn($c) => $c > 1));

            foreach ($listaNomesNumeros as &$item) {
                $num = trim((string) ($item['numero_camisa'] ?? ''));
                $item['numero_duplicado'] = !empty($num) && in_array($num, $numerosRepetidos);
            }

            $dadosView = [
                'grupo' => $grupo,
                'totalPecas' => $totalPecas,
                'porTamanho' => $porTamanho,
                'porModelo' => $porModelo,
                'listaNomesNumeros' => $listaNomesNumeros,
            ];

            // Se DomPDF estiver instalado e disponível, gera o arquivo PDF binário
            if (class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
                $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.ordem_producao', $dadosView);
                $pdf->setPaper('a4', 'portrait');
                $filename = 'ordem_producao_' . \Illuminate\Support\Str::slug($grupo->nome) . '_' . date('Ymd_His') . '.pdf';
                return $pdf->download($filename);
            }

            // Fallback: se DomPDF ainda não foi instalado no servidor, retorna o HTML estilizado
            \Illuminate\Support\Facades\Log::warning("DomPDF não instalado no servidor. Retornando visualização HTML da ordem para impressão.");
            $dadosView['isHtml'] = true;
            return response()->view('pdf.ordem_producao', $dadosView);

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Erro ao exportar PDF: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => (config('app.debug') ? 'Erro ao gerar ordem: ' . $e->getMessage() : 'Erro ao gerar ordem.'),
            ], 500);
        }
    }

    /**
     * Retorna a visualização HTML da ordem de produção formatada para impressão no navegador.
     */
    public function ordemImpressao(Request $request, $grupoId)
    {
        $grupo = Grupo::with(['modelos', 'user', 'confeccao', 'participantes.modelo'])->findOrFail($grupoId);
        
        $user = $request->user();
        if (!$user && $request->filled('token')) {
            $tokenObj = \Laravel\Sanctum\PersonalAccessToken::findToken($request->query('token'));
            if ($tokenObj) {
                $user = $tokenObj->tokenable;
            }
        }

        if ($user && $user->isConfeccao()) {
            if ($grupo->confeccao_id !== $user->confeccao?->id) {
                return response()->json(['message' => 'Acesso negado.'], 403);
            }
        } elseif ($user && !$user->isAdmin() && $grupo->user_id !== $user->id) {
            return response()->json(['message' => 'Acesso negado.'], 403);
        }

        $participantes = $grupo->participantes ?? collect();
        $porTamanho = [];
        $porModelo = [];
        $numerosContagem = [];
        $listaNomesNumeros = [];
        $totalPecas = 0;

        foreach ($participantes as $p) {
            $qtd = (int) $p->quantidade;
            $totalPecas += $qtd;

            $tam = strtoupper(trim($p->tamanho ?: 'Único'));
            $modeloNome = $p->modelo ? $p->modelo->nome : 'Geral';
            $cor = trim($p->cor ?: 'Padrão');

            $porTamanho[$tam] = ($porTamanho[$tam] ?? 0) + $qtd;
            $porModelo[$modeloNome] = ($porModelo[$modeloNome] ?? 0) + $qtd;

            if (!empty($p->numero_camisa)) {
                $numStr = trim((string) $p->numero_camisa);
                $numerosContagem[$numStr] = ($numerosContagem[$numStr] ?? 0) + 1;
            }

            $listaNomesNumeros[] = [
                'id' => $p->id,
                'nome_completo' => $p->nome_completo,
                'modelo' => $modeloNome,
                'cor' => $cor,
                'tamanho' => $tam,
                'quantidade' => $qtd,
                'nome_camisa' => $p->nome_camisa,
                'numero_camisa' => $p->numero_camisa,
                'apelido' => $p->apelido,
                'frase_costas' => $p->frase_costas,
                'observacao' => $p->observacao,
            ];
        }

        $numerosRepetidos = array_keys(array_filter($numerosContagem, fn($c) => $c > 1));

        foreach ($listaNomesNumeros as &$item) {
            $num = trim((string) ($item['numero_camisa'] ?? ''));
            $item['numero_duplicado'] = !empty($num) && in_array($num, $numerosRepetidos);
        }

        return response()->view('pdf.ordem_producao', [
            'grupo' => $grupo,
            'totalPecas' => $totalPecas,
            'porTamanho' => $porTamanho,
            'porModelo' => $porModelo,
            'listaNomesNumeros' => $listaNomesNumeros,
            'isHtml' => true,
        ]);
    }
}

