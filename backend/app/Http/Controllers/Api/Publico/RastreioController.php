<?php

namespace App\Http\Controllers\Api\Publico;

use App\Http\Controllers\Controller;
use App\Models\Confeccao;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class RastreioController extends Controller
{
    /**
     * POST /api/publico/rastreio
     *
     * Busca pedidos pelo telefone/WhatsApp informado pelo cliente
     */
    public function rastrear(Request $request): JsonResponse
    {
        $request->validate([
            'telefone' => 'required|string|min:8|max:30',
        ]);

        $rawInput = trim($request->input('telefone'));
        $digits = preg_replace('/\D/', '', $rawInput);

        if (strlen($digits) < 8) {
            return response()->json([
                'encontrado' => false,
                'mensagem'   => 'Por favor, informe um número de telefone ou WhatsApp válido com DDD.',
                'pedidos'    => [],
            ], 422);
        }

        // Gera variações possíveis do número no Brasil
        $variants = $this->gerarVariacoesNumero($digits);

        // 1. Tenta encontrar Confecção cadastrada por telefone ou WhatsApp
        $buscaNorm = $this->normalizarNumero($digits);
        $confeccao = Confeccao::where(function ($q) use ($variants) {
            foreach ($variants as $v) {
                $q->orWhere('whatsapp', 'like', "%{$v}%")
                  ->orWhere('telefone', 'like', "%{$v}%");
            }
        })->get()->first(function (Confeccao $c) use ($buscaNorm) {
            // Comparação exata do número normalizado (evita casar só pelos últimos dígitos)
            foreach ([$c->whatsapp, $c->telefone] as $tel) {
                if ($tel && $this->normalizarNumero(preg_replace('/\D/', '', $tel)) === $buscaNorm) {
                    return true;
                }
            }
            return false;
        });

        $pedidos = collect();
        $clienteInfo = null;

        if ($confeccao) {
            // Busca pedidos associados a esta confecção
            $pedidos = Pedido::where('confeccao_id', $confeccao->id)
                ->with([
                    'artes' => fn($q) => $q->orderBy('versao', 'desc'),
                    'confeccao',
                ])
                ->orderBy('created_at', 'desc')
                ->get();

            $clienteInfo = [
                'nome'     => $confeccao->nome,
                'tipo'     => 'confeccao',
                'plano'    => $confeccao->plano,
                'telefone' => $confeccao->whatsapp ?? $confeccao->telefone,
            ];
        } else {
            // 2. Tenta encontrar pedidos pelo WhatsApp do cliente direto
            $pedidosCandidatos = Pedido::where(function ($q) use ($variants) {
                foreach ($variants as $v) {
                    $q->orWhere('whatsapp_cliente', 'like', "%{$v}%")
                      ->orWhere('cliente_whatsapp', 'like', "%{$v}%");
                }
            })
            ->with([
                'artes' => fn($q) => $q->orderBy('versao', 'desc'),
                'confeccao',
            ])
            ->orderBy('created_at', 'desc')
            ->get();

            // Normaliza o número buscado para garantir que não haja vazamento de pedidos de terceiros
            $cleanBusca = preg_replace('/\D/', '', $rawInput);
            if (str_starts_with($cleanBusca, '55') && strlen($cleanBusca) >= 12) {
                $cleanBusca = substr($cleanBusca, 2);
            }
            if (strlen($cleanBusca) === 11 && $cleanBusca[2] === '9') {
                $cleanBusca = substr($cleanBusca, 0, 2) . substr($cleanBusca, 3);
            }

            $pedidos = $pedidosCandidatos->filter(function (Pedido $p) use ($cleanBusca) {
                $telefones = array_filter([$p->cliente_whatsapp, $p->whatsapp_cliente]);
                foreach ($telefones as $tel) {
                    $c = preg_replace('/\D/', '', $tel);
                    if (str_starts_with($c, '55') && strlen($c) >= 12) {
                        $c = substr($c, 2);
                    }
                    if (strlen($c) === 11 && $c[2] === '9') {
                        $c = substr($c, 0, 2) . substr($c, 3);
                    }
                    if (!empty($c) && $c === $cleanBusca) {
                        return true;
                    }
                }
                return false;
            })->values();

            if ($pedidos->isNotEmpty()) {
                $primeiro = $pedidos->first();
                $clienteInfo = [
                    'nome'     => $primeiro->nome_cliente ?? $primeiro->cliente_nome ?? 'Cliente',
                    'tipo'     => 'cliente',
                    'telefone' => $rawInput,
                ];
            }
        }

        if ($pedidos->isEmpty()) {
            return response()->json([
                'encontrado' => false,
                'mensagem'   => 'Nenhum pedido foi encontrado para este número. Verifique o DDD e o número digitado ou fale com nossa equipe.',
                'cliente'    => null,
                'pedidos'    => [],
            ]);
        }

        $pedidosFormatados = $pedidos->map(function (Pedido $p) {
            $arteAtiva = $p->arteAtiva ?? $p->artes->first();
            $progresso = match ($p->status) {
                'aguardando_briefing'  => 15,
                'em_producao'          => 45,
                'aguardando_aprovacao' => 80,
                'aprovado'             => 95,
                'finalizado'           => 100,
                'cancelado'            => 0,
                default                => 20,
            };

            return [
                'id'              => $p->id,
                'titulo'          => $p->titulo,
                'tipo_impressao'  => $p->tipo_impressao,
                'status'          => $p->status,
                'status_label'    => Pedido::STATUS_LABELS[$p->status] ?? $p->status,
                'prazo'           => $p->prazo?->format('Y-m-d'),
                'prazo_formatado' => $p->prazo?->format('d/m/Y'),
                'esta_atrasado'   => $p->estaAtrasado(),
                'token_aprovacao' => $p->token_aprovacao,
                'link_aprovacao'  => "/aprovar/{$p->token_aprovacao}",
                'observacoes'     => $p->observacoes,
                'progresso'       => $progresso,
                'created_at'      => $p->created_at?->format('d/m/Y'),
                'confeccao_nome'  => $p->confeccao?->nome ?? null,
                'preview_url'     => $arteAtiva?->preview_url ?? $arteAtiva?->arquivo_url ?? null,
                'tem_arte'        => $p->artes->isNotEmpty(),
                'referencias'     => $p->referencias ?? [],
            ];
        });

        return response()->json([
            'encontrado' => true,
            'cliente'    => $clienteInfo,
            'total'      => $pedidosFormatados->count(),
            'pedidos'    => $pedidosFormatados,
        ]);
    }

    /** Remove DDI 55 e o 9º dígito para comparar números BR de forma exata */
    private function normalizarNumero(string $digits): string
    {
        if (str_starts_with($digits, '55') && strlen($digits) >= 12) {
            $digits = substr($digits, 2);
        }
        if (strlen($digits) === 11 && $digits[2] === '9') {
            $digits = substr($digits, 0, 2) . substr($digits, 3);
        }
        return $digits;
    }

    /**
     * Gera lista de variações para cobrir formatos comuns de números BR
     */
    private function gerarVariacoesNumero(string $digits): array
    {
        $variants = [$digits];

        // Se começa com 55 e tem mais de 11 dígitos, remove o 55
        $semDdi = $digits;
        if (str_starts_with($digits, '55') && strlen($digits) >= 12) {
            $semDdi = substr($digits, 2);
            $variants[] = $semDdi;
        } else {
            $variants[] = '55' . $digits;
        }

        // Se tem 11 dígitos (DDD + 9 + 8 dígitos)
        if (strlen($semDdi) === 11 && $semDdi[2] === '9') {
            // Versão sem o 9 (10 dígitos)
            $sem9 = substr($semDdi, 0, 2) . substr($semDdi, 3);
            $variants[] = $sem9;
            $variants[] = '55' . $sem9;
        }

        // Se tem 10 dígitos (DDD + 8 dígitos)
        if (strlen($semDdi) === 10) {
            // Versão com o 9
            $com9 = substr($semDdi, 0, 2) . '9' . substr($semDdi, 2);
            $variants[] = $com9;
            $variants[] = '55' . $com9;
        }

        // Pega os últimos 8 dígitos (sem DDD e sem 9) para buscas parciais seguras
        if (strlen($semDdi) >= 8) {
            $ultimos8 = substr($semDdi, -8);
            $variants[] = $ultimos8;
        }

        return array_values(array_unique(array_filter($variants)));
    }

    /**
     * POST /api/publico/pedidos/{id}/anexar-referencias
     *
     * Permite ao cliente anexar fotos e arquivos de referência através do portal de rastreio
     */
    public function anexarReferencias(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'telefone'   => 'required|string|min:8|max:30',
            'arquivos'   => 'required|array|min:1',
            'arquivos.*' => 'file|mimes:jpg,jpeg,png,webp,gif,pdf|max:30720', // até 30MB cada arquivo
        ]);

        $pedido = Pedido::with('confeccao')->find($id);
        if (!$pedido) {
            return response()->json(['message' => 'Pedido não encontrado.'], 404);
        }

        // Validação de segurança: o telefone informado deve pertencer ao cliente do pedido
        $rawInput = trim($request->input('telefone'));
        $digits = preg_replace('/\D/', '', $rawInput);
        $variants = $this->gerarVariacoesNumero($digits);

        $pertence = false;
        $telefonesPedido = array_filter([
            $pedido->cliente_whatsapp,
            $pedido->whatsapp_cliente,
            $pedido->confeccao?->whatsapp,
            $pedido->confeccao?->telefone,
        ]);

        foreach ($telefonesPedido as $tel) {
            $c = preg_replace('/\D/', '', $tel);
            if ($c !== '' && $this->normalizarNumero($c) === $this->normalizarNumero($digits)) {
                $pertence = true;
                break;
            }
        }

        if (!$pertence) {
            return response()->json(['message' => 'Número de telefone não autorizado para este pedido.'], 403);
        }

        $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
        $refsAtuais = $pedido->referencias ?? [];

        foreach ($request->file('arquivos') as $arquivo) {
            $path = $arquivo->store('pedidos/referencias', $disk);
            $url = Storage::disk($disk)->url($path);
            if (!str_starts_with($url, 'http')) {
                $url = rtrim(config('app.url'), '/') . '/' . ltrim($url, '/');
            }

            $refsAtuais[] = [
                'url'     => $url,
                'nome'    => mb_substr(basename($arquivo->getClientOriginalName()), 0, 120),
                'tipo'    => strtolower((string) $arquivo->guessExtension()),
                'tamanho' => $arquivo->getSize(),
            ];
        }

        $pedido->referencias = $refsAtuais;
        $pedido->save();

        return response()->json([
            'success'     => true,
            'message'     => 'Fotos/referências anexadas com sucesso!',
            'referencias' => $pedido->referencias,
        ]);
    }
}

