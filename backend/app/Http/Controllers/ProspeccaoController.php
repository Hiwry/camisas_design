<?php

namespace App\Http\Controllers;

use App\Models\ProspeccaoMensagem;
use App\Models\ProspeccaoModelo;
use App\Models\Prospecto;
use App\Services\ProspeccaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProspeccaoController extends Controller
{
    public function __construct(private ProspeccaoService $svc) {}

    /** GET /api/prospeccao/resumo */
    public function resumo(): JsonResponse
    {
        $funil = Prospecto::select('status', DB::raw('count(*) as total'))
            ->groupBy('status')->pluck('total', 'status');

        $porModelo = ProspeccaoModelo::where('tipo', 'inicial')->get()->map(function ($m) {
            $enviados   = Prospecto::where('modelo_id', $m->id)->count();
            $respostas  = Prospecto::where('modelo_id', $m->id)->whereNotNull('respondeu_em')->count();
            return [
                'id' => $m->id, 'nome' => $m->nome,
                'enviados' => $enviados, 'respostas' => $respostas,
                'taxa' => $enviados > 0 ? round($respostas / $enviados * 100, 1) : null,
            ];
        });

        return response()->json([
            'funil'          => $funil,
            'total'          => Prospecto::count(),
            'enviados_hoje'  => $this->svc->enviadosHoje(),
            'limite_hoje'    => $this->svc->limiteHoje(),
            'dentro_horario' => $this->svc->dentroDoHorario(),
            'config'         => $this->svc->config(),
            'por_modelo'     => $porModelo,
        ]);
    }

    /** GET /api/prospeccao/fila — prévia de quem recebe em seguida e com qual mensagem */
    public function fila(Request $request): JsonResponse
    {
        $limite = max(1, min((int) $request->query('limite', 20), 100));
        return response()->json([
            'fila'          => $this->svc->previaFila($limite),
            'enviados_hoje' => $this->svc->enviadosHoje(),
            'limite_hoje'   => $this->svc->limiteHoje(),
        ]);
    }

    /** GET /api/prospeccao/prospectos */
    public function listar(Request $request): JsonResponse
    {
        $q = $this->aplicarFiltros(Prospecto::query(), $request->query());
        $q->orderByDesc('data_abertura')->orderByDesc('id');

        return response()->json($q->paginate(min((int) $request->query('por_pagina', 30), 100)));
    }

    /** POST /api/prospeccao/prospectos */
    public function criar(Request $request): JsonResponse
    {
        $d = $request->validate([
            'nome'      => 'nullable|string|max:160',
            'telefone'  => 'required|string|max:30',
            'cidade'    => 'nullable|string|max:80',
            'uf'        => 'nullable|string|size:2',
            'instagram' => 'nullable|string|max:80',
            'notas'     => 'nullable|string|max:2000',
        ]);

        $tel = ProspeccaoService::normalizarTelefone($d['telefone']);
        if (!$tel) {
            return response()->json(['message' => 'Telefone inválido: precisa ser celular com DDD.'], 422);
        }
        if (Prospecto::where('telefone', $tel)->exists()) {
            return response()->json(['message' => 'Esse número já está na lista.'], 409);
        }

        $p = Prospecto::create([
            'nome' => $d['nome'] ?? null, 'telefone' => $tel,
            'cidade' => $d['cidade'] ?? null, 'uf' => isset($d['uf']) ? strtoupper($d['uf']) : null,
            'instagram' => $d['instagram'] ?? null, 'notas' => $d['notas'] ?? null,
            'origem' => 'manual', 'status' => 'pendente', 'etapa' => 0,
        ]);
        return response()->json($p, 201);
    }

    /** POST /api/prospeccao/prospectos/importar-lista  (texto: nome;telefone;cidade;uf por linha) */
    public function importarLista(Request $request): JsonResponse
    {
        $request->validate(['lista' => 'required|string|max:200000']);

        $ok = $invalidos = $duplicados = 0;
        foreach (preg_split('/\r\n|\r|\n/', $request->lista) as $linha) {
            $linha = trim($linha);
            if ($linha === '') {
                continue;
            }
            $cols = preg_split('/[;\t,]/', $linha);
            // aceita "nome;telefone;cidade;uf" ou só "telefone"
            $tel = null;
            $nome = null;
            $resto = [];
            foreach ($cols as $i => $c) {
                $c = trim($c);
                if ($tel === null && ($t = ProspeccaoService::normalizarTelefone($c))) {
                    $tel = $t;
                    continue;
                }
                if ($i === 0 && $nome === null) {
                    $nome = $c;
                    continue;
                }
                $resto[] = $c;
            }
            if (!$tel) {
                $invalidos++;
                continue;
            }
            if (Prospecto::where('telefone', $tel)->exists()) {
                $duplicados++;
                continue;
            }
            Prospecto::create([
                'nome' => $nome ?: null, 'telefone' => $tel,
                'cidade' => $resto[0] ?? null,
                'uf' => isset($resto[1]) && strlen($resto[1]) === 2 ? strtoupper($resto[1]) : null,
                'origem' => 'lista', 'status' => 'pendente', 'etapa' => 0,
            ]);
            $ok++;
        }
        return response()->json(['importados' => $ok, 'invalidos' => $invalidos, 'duplicados' => $duplicados]);
    }

    /**
     * POST /api/prospeccao/prospectos/aprovar
     * Body: { acao: 'aprovar'|'rejeitar', ids?: number[], todos?: bool }
     * Só contatos "pendente" mudam; aprovar => entram na fila de envio, rejeitar => descartado.
     */
    public function aprovar(Request $request): JsonResponse
    {
        $d = $request->validate([
            'acao'    => 'required|in:aprovar,rejeitar,pendente',
            'ids'     => 'nullable|array|max:5000',
            'ids.*'   => 'integer',
            'todos'   => 'nullable|boolean',
            'filtros' => 'nullable|array',
        ]);

        // Só mexe em contatos ainda não trabalhados: pendente, aprovado (novo) ou rejeitado.
        $f = $d['filtros'] ?? [];
        $origem = in_array($f['status'] ?? 'pendente', ['pendente', 'novo', 'descartado'], true) ? ($f['status'] ?? 'pendente') : 'pendente';
        $f['status'] = $origem;

        $q = $this->aplicarFiltros(Prospecto::query(), $f);
        if (empty($d['todos'])) {
            if (empty($d['ids'])) {
                return response()->json(['message' => 'Selecione ao menos um contato.'], 422);
            }
            $q->whereIn('id', $d['ids']);
        }
        $novo = ['aprovar' => 'novo', 'rejeitar' => 'descartado', 'pendente' => 'pendente'][$d['acao']];
        $total = $q->update(['status' => $novo]);

        return response()->json(['atualizados' => $total, 'acao' => $d['acao']]);
    }

    /** GET /api/prospeccao/filtros — UFs e cidades disponíveis (com contagem) para os filtros. */
    public function filtros(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pendente');
        $base = Prospecto::query()->when($status !== 'todos', fn ($q) => $q->where('status', $status));

        $ufs = (clone $base)->whereNotNull('uf')->where('uf', '!=', '')
            ->select('uf', DB::raw('count(*) as total'))->groupBy('uf')->orderBy('uf')->get();

        $cidades = collect();
        if ($uf = strtoupper((string) $request->query('uf'))) {
            $cidades = (clone $base)->where('uf', $uf)->whereNotNull('cidade')->where('cidade', '!=', '')
                ->select('cidade', DB::raw('count(*) as total'))->groupBy('cidade')
                ->orderByDesc('total')->limit(300)->get();
        }

        return response()->json(['ufs' => $ufs, 'cidades' => $cidades]);
    }

    /** Filtros comuns de lista/aprovação: status, uf, cidade, busca, com_nome. */
    private function aplicarFiltros($q, array $f)
    {
        if (!empty($f['status']) && $f['status'] !== 'todos') {
            $q->where('status', $f['status']);
        }
        if (!empty($f['uf'])) {
            $q->where('uf', strtoupper((string) $f['uf']));
        }
        if (!empty($f['cidade'])) {
            $q->where('cidade', (string) $f['cidade']);
        }
        if (!empty($f['com_nome']) && $f['com_nome'] !== 'false' && $f['com_nome'] !== '0') {
            $q->whereNotNull('nome')->where('nome', '!=', '');
        }
        if ($b = trim((string) ($f['busca'] ?? ''))) {
            $q->where(function ($w) use ($b) {
                $w->where('nome', 'like', "%{$b}%")
                  ->orWhere('cidade', 'like', "%{$b}%")
                  ->orWhere('telefone', 'like', '%' . preg_replace('/\D/', '', $b) . '%');
            });
        }
        return $q;
    }

    /** PATCH /api/prospeccao/prospectos/{prospecto} */
    public function atualizar(Request $request, Prospecto $prospecto): JsonResponse
    {
        $d = $request->validate([
            'status' => 'nullable|in:' . implode(',', Prospecto::STATUS),
            'notas'  => 'nullable|string|max:2000',
            'nome'   => 'nullable|string|max:160',
        ]);
        $prospecto->update(array_filter($d, fn ($v) => $v !== null));
        return response()->json($prospecto->fresh());
    }

    /** DELETE /api/prospeccao/prospectos/{prospecto} */
    public function excluir(Prospecto $prospecto): JsonResponse
    {
        $prospecto->delete();
        return response()->json(['success' => true]);
    }

    /** GET /api/prospeccao/prospectos/{prospecto}/mensagens */
    public function mensagens(Prospecto $prospecto): JsonResponse
    {
        return response()->json($prospecto->mensagens()->orderBy('created_at')->get());
    }

    // ── Modelos ─────────────────────────────────────────────────────

    public function modelos(): JsonResponse
    {
        return response()->json(ProspeccaoModelo::orderBy('tipo')->orderBy('id')->get());
    }

    public function atualizarModelo(Request $request, ProspeccaoModelo $modelo): JsonResponse
    {
        $d = $request->validate([
            'nome'  => 'sometimes|string|max:60',
            'texto' => 'sometimes|string|max:2000',
            'ativo' => 'sometimes|boolean',
        ]);
        $modelo->update($d);
        return response()->json($modelo);
    }

    // ── Configuração e instância ────────────────────────────────────

    public function atualizarConfig(Request $request): JsonResponse
    {
        $d = $request->validate([
            'ativo'              => 'sometimes|boolean',
            'meu_nome'           => 'sometimes|string|max:60',
            'limite_max_dia'     => 'sometimes|integer|min:1|max:200',
            'limite_inicial_dia' => 'sometimes|integer|min:1|max:100',
            'aquecimento_passo'  => 'sometimes|integer|min:0|max:50',
            'hora_inicio'        => 'sometimes|integer|min:0|max:23',
            'hora_fim'           => 'sometimes|integer|min:1|max:24',
            'intervalo_min_seg'  => 'sometimes|integer|min:30|max:3600',
            'intervalo_max_seg'  => 'sometimes|integer|min:30|max:7200',
            'dias_followup_1'    => 'sometimes|integer|min:1|max:30',
            'dias_followup_2'    => 'sometimes|integer|min:1|max:30',
        ]);

        // Segurança: ligar o envio exige o nome do remetente e WhatsApp conectado
        if (($d['ativo'] ?? false) === true) {
            $cfg = array_merge($this->svc->config(), $d);
            if (trim((string) $cfg['meu_nome']) === '') {
                return response()->json(['message' => 'Preencha "Seu nome" antes de ligar o envio automático.'], 422);
            }
            if (($this->svc->whatsapp()->status()['state'] ?? 'close') !== 'open') {
                return response()->json(['message' => 'Conecte o WhatsApp de prospecção (QR Code) antes de ligar.'], 422);
            }
        }
        return response()->json($this->svc->salvarConfig($d));
    }

    public function status(): JsonResponse
    {
        $wa = $this->svc->whatsapp();
        if (!$wa->configurado()) {
            return response()->json(['configurado' => false, 'message' => 'EVOLUTION_API_KEY não configurada no .env']);
        }
        $s = $wa->status();
        return response()->json([
            'configurado' => true, 'state' => $s['state'], 'perfil' => $s['perfil'],
            'instance' => $s['instance'], 'conectado' => $s['state'] === 'open',
        ]);
    }

    public function qrcode(): JsonResponse
    {
        $wa = $this->svc->whatsapp();
        if (!$wa->configurado()) {
            return response()->json(['message' => 'EVOLUTION_API_KEY não configurada.'], 503);
        }
        try {
            $qr = $wa->obterQrCode();
            if (!$qr['base64']) {
                if (($wa->status()['state'] ?? '') === 'open') {
                    return response()->json(['conectado' => true, 'state' => 'open']);
                }
                return response()->json(['message' => 'Não foi possível gerar o QR Code.'], 502);
            }
            return response()->json(['base64' => $qr['base64'], 'conectado' => false]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao conectar à Evolution API.'], 502);
        }
    }

    public function desconectar(): JsonResponse
    {
        $this->svc->salvarConfig(['ativo' => false]);
        return response()->json(['success' => $this->svc->whatsapp()->desconectar()]);
    }

    public function configurarWebhook(): JsonResponse
    {
        $url = rtrim(config('app.url'), '/') . '/api/prospeccao/webhook';
        $ok  = $this->svc->whatsapp()->configurarWebhook($url);
        return response()->json(['success' => $ok, 'webhook_url' => $url]);
    }

    // ── Webhook público (respostas dos contatos) ────────────────────

    /** POST /api/prospeccao/webhook — fail-closed: exige a apikey da Evolution (ou secret) */
    public function webhook(Request $request): JsonResponse
    {
        $esperada = (string) config('services.evolution.key');
        $segredo  = (string) config('services.evolution.webhook_secret');
        $enviada  = $request->header('apikey') ?? $request->header('x-api-key')
            ?? $request->bearerToken() ?? $request->input('apikey') ?? $request->input('data.apikey');

        $okChave   = $esperada !== '' && is_string($enviada) && $enviada !== '' && hash_equals($esperada, $enviada);
        $okSegredo = $segredo !== '' && hash_equals($segredo, (string) $request->query('secret', ''));
        if (!$okChave && !$okSegredo) {
            Log::warning('Prospecção webhook: chave inválida', ['ip' => $request->ip()]);
            return response()->json(['status' => 'unauthorized'], 401);
        }

        $evento = strtolower((string) $request->input('event', ''));
        if (!in_array($evento, ['messages.upsert', 'messages_upsert', ''], true)) {
            return response()->json(['status' => 'ignored']);
        }

        $dados = $request->input('data', $request->all());
        if (isset($dados[0]) && is_array($dados[0])) {
            $dados = $dados[0];
        }

        $id = $dados['key']['id'] ?? null;
        if (is_string($id) && $id !== '' && !Cache::add('prosp_msg_' . $id, 1, now()->addMinutes(15))) {
            return response()->json(['status' => 'ignored', 'reason' => 'duplicate']);
        }
        if (($dados['key']['fromMe'] ?? false) === true) {
            return response()->json(['status' => 'ignored', 'reason' => 'from_me']);
        }

        $jid = $dados['key']['remoteJid'] ?? '';
        if (str_contains($jid, '@g.us')) {
            return response()->json(['status' => 'ignored', 'reason' => 'group']);
        }
        foreach ([$dados['key']['remoteJidAlt'] ?? null, $dados['sender'] ?? null, $jid] as $cand) {
            if ($cand && !str_contains($cand, '@lid')) {
                $jid = $cand;
                break;
            }
        }

        $msg = $dados['message'] ?? [];
        $texto = $msg['conversation']
            ?? $msg['extendedTextMessage']['text']
            ?? $msg['imageMessage']['caption']
            ?? $msg['buttonsResponseMessage']['selectedDisplayText']
            ?? (isset($msg['audioMessage']) ? '[áudio]' : null)
            ?? (isset($msg['imageMessage']) ? '[imagem]' : null);

        if (!$texto || !$jid) {
            return response()->json(['status' => 'ignored', 'reason' => 'no_text']);
        }

        $numero = preg_replace('/\D/', '', explode('@', $jid)[0]);
        $p = $this->svc->registrarResposta($numero, $texto);

        return response()->json(['status' => $p ? 'registered' : 'unknown_contact']);
    }
}
