<?php

namespace App\Services;

use App\Models\ProspeccaoMensagem;
use App\Models\ProspeccaoModelo;
use App\Models\Prospecto;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Motor da prospecção: escolhe o próximo contato, respeita horário, limite
 * diário (com aquecimento), intervalo aleatório e pausa sozinho se começar a falhar.
 */
class ProspeccaoService
{
    private const CACHE_CONFIG  = 'prospeccao.config';
    private const CACHE_PROXIMO = 'prospeccao.proximo_envio';
    private const CACHE_FALHAS  = 'prospeccao.falhas_seguidas';

    private WhatsAppService $wa;

    public function __construct(?WhatsAppService $wa = null)
    {
        $this->wa = $wa ?? WhatsAppService::prospeccao();
    }

    public function whatsapp(): WhatsAppService
    {
        return $this->wa;
    }

    // ── Configuração ────────────────────────────────────────────────

    public function config(): array
    {
        $salvo = Cache::get(self::CACHE_CONFIG, []);
        return array_merge(config('prospeccao.defaults'), is_array($salvo) ? $salvo : []);
    }

    public function salvarConfig(array $novos): array
    {
        $permitidas = array_keys(config('prospeccao.defaults'));
        $atual = $this->config();
        foreach ($novos as $k => $v) {
            if (in_array($k, $permitidas, true)) {
                $atual[$k] = $v;
            }
        }
        Cache::forever(self::CACHE_CONFIG, $atual);
        return $atual;
    }

    // ── Telefone ────────────────────────────────────────────────────

    /**
     * Normaliza para 55+DDD+número de CELULAR. Retorna null se for fixo/inválido
     * (fixo não tem WhatsApp). Celular antigo de 8 dígitos ganha o 9.
     */
    public static function normalizarTelefone(?string $bruto): ?string
    {
        $n = preg_replace('/\D/', '', (string) $bruto);
        if ($n === '') {
            return null;
        }
        $n = ltrim($n, '0');
        if (str_starts_with($n, '55') && strlen($n) >= 12) {
            $n = substr($n, 2);
        }
        // agora: DDD (2) + número (8 ou 9)
        if (strlen($n) === 10) {
            $ddd = substr($n, 0, 2);
            $num = substr($n, 2);
            if (!preg_match('/^[6-9]/', $num)) {
                return null; // fixo
            }
            $n = $ddd . '9' . $num;
        }
        if (strlen($n) !== 11) {
            return null;
        }
        $ddd = (int) substr($n, 0, 2);
        if ($ddd < 11 || $ddd > 99 || $n[2] !== '9') {
            return null;
        }
        return '55' . $n;
    }

    // ── Mensagem ────────────────────────────────────────────────────

    public static function nomeParaMensagem(?string $nome): ?string
    {
        $nome = trim((string) $nome);
        if ($nome === '') {
            return null;
        }
        $nome = preg_replace('/^\d[\d\s\.\-\/]*/u', '', $nome);                       // "12345678 FULANO" -> "FULANO"
        $nome = preg_replace('/\b(ltda|me|mei|epp|eireli|s\.?a\.?|ss)\b\.?/iu', '', $nome);
        $nome = trim(preg_replace('/\s+/u', ' ', $nome));
        if (mb_strlen($nome) < 2) {
            return null;
        }
        if ($nome === mb_strtoupper($nome)) {
            $nome = mb_convert_case($nome, MB_CASE_TITLE, 'UTF-8');
        }
        return $nome;
    }

    public function renderizar(string $texto, Prospecto $p): string
    {
        $cfg   = $this->config();
        $marca = self::nomeParaMensagem($p->nome);
        $vars = [
            '{a_marca}'  => $marca ? "a {$marca}"  : 'a sua confecção',
            '{da_marca}' => $marca ? "da {$marca}" : 'da sua confecção',
            '{meu_nome}' => $cfg['meu_nome'] ?: 'designer',
            '{cidade}'   => $p->cidade ?: 'sua cidade',
        ];
        $texto = strtr($texto, $vars);

        // Variações [opção A|opção B] -> sorteia uma
        $texto = preg_replace_callback('/\[([^\[\]]*\|[^\[\]]*)\]/u', function ($m) {
            $opcoes = explode('|', $m[1]);
            return trim($opcoes[array_rand($opcoes)]);
        }, $texto);

        return $texto;
    }

    // ── Limites ─────────────────────────────────────────────────────

    public function tz(): string
    {
        return config('prospeccao.timezone', 'America/Maceio');
    }

    public function dentroDoHorario(?Carbon $agora = null): bool
    {
        $cfg   = $this->config();
        $agora = ($agora ?? now())->copy()->setTimezone($this->tz());
        if ($agora->isWeekend()) {
            return false;
        }
        return $agora->hour >= (int) $cfg['hora_inicio'] && $agora->hour < (int) $cfg['hora_fim'];
    }

    public function enviadosHoje(): int
    {
        $ini = now($this->tz())->startOfDay()->setTimezone(config('app.timezone'));
        return ProspeccaoMensagem::where('direcao', 'saida')->where('ok', true)
            ->where('created_at', '>=', $ini)->count();
    }

    /** Limite do dia com aquecimento: começa baixo e sobe por dia ativo até o teto. */
    public function limiteHoje(): int
    {
        $cfg  = $this->config();
        $ini  = now($this->tz())->startOfDay()->setTimezone(config('app.timezone'));
        $dias = ProspeccaoMensagem::where('direcao', 'saida')->where('ok', true)
            ->where('created_at', '<', $ini)
            ->get(['created_at'])
            ->map(fn ($m) => $m->created_at->copy()->setTimezone($this->tz())->toDateString())
            ->unique()->count();

        return (int) min(
            (int) $cfg['limite_max_dia'],
            (int) $cfg['limite_inicial_dia'] + $dias * (int) $cfg['aquecimento_passo']
        );
    }

    // ── Motor ───────────────────────────────────────────────────────

    /** Um "tick" (chamado a cada minuto). Envia no máximo UMA mensagem. */
    public function processarUmEnvio(): string
    {
        $cfg = $this->config();
        if (!$cfg['ativo']) {
            return 'desligado';
        }
        if (!$this->wa->configurado()) {
            return 'evolution_nao_configurada';
        }
        if (!$this->dentroDoHorario()) {
            return 'fora_do_horario';
        }
        if ($this->enviadosHoje() >= $this->limiteHoje()) {
            return 'limite_diario';
        }
        $proximo = (int) Cache::get(self::CACHE_PROXIMO, 0);
        if (now()->timestamp < $proximo) {
            return 'aguardando_intervalo';
        }
        if (($this->wa->status()['state'] ?? 'close') !== 'open') {
            return 'whatsapp_desconectado';
        }

        [$prospecto, $tipo] = $this->escolherProximo($cfg);
        if (!$prospecto) {
            return 'sem_contatos';
        }

        $modelo = $this->proximoModelo($tipo);
        if (!$modelo) {
            return 'sem_modelo_' . $tipo;
        }

        $texto = $this->renderizar($modelo->texto, $prospecto);
        $ok    = $this->wa->enviarTexto($prospecto->telefone, $texto);

        ProspeccaoMensagem::create([
            'prospecto_id' => $prospecto->id,
            'direcao'      => 'saida',
            'tipo'         => $tipo,
            'modelo_id'    => $modelo->id,
            'texto'        => $texto,
            'ok'           => $ok,
            'erro'         => $ok ? null : 'falha no envio (veja storage/logs)',
            'created_at'   => now(),
        ]);

        // intervalo aleatório até o próximo (mesmo em falha, para não insistir)
        Cache::put(
            self::CACHE_PROXIMO,
            now()->addSeconds(random_int((int) $cfg['intervalo_min_seg'], max((int) $cfg['intervalo_min_seg'], (int) $cfg['intervalo_max_seg'])))->timestamp,
            now()->addHour()
        );

        if (!$ok) {
            $falhas = (int) Cache::get(self::CACHE_FALHAS, 0) + 1;
            Cache::forever(self::CACHE_FALHAS, $falhas);
            if ($falhas >= (int) $cfg['falhas_para_pausar']) {
                $this->salvarConfig(['ativo' => false]);
                Cache::forget(self::CACHE_FALHAS);
                Log::error("Prospecção PAUSADA automaticamente após {$falhas} falhas seguidas de envio.");
                return 'pausado_por_falhas';
            }
            return 'falha_envio';
        }

        Cache::forget(self::CACHE_FALHAS);

        $novoEtapa = ['inicial' => 1, 'followup1' => 2, 'followup2' => 3][$tipo];
        $dados = [
            'etapa'           => $novoEtapa,
            'status'          => 'em_sequencia',
            'ultimo_envio_em' => now(),
        ];
        if ($tipo === 'inicial') {
            $dados['modelo_id'] = $modelo->id;
        }
        $prospecto->update($dados);

        return 'enviado';
    }

    /** @return array{0: ?Prospecto, 1: string} */
    private function escolherProximo(array $cfg): array
    {
        // 1) follow-ups vencidos (sem resposta)
        $f2 = Prospecto::where('status', 'em_sequencia')->where('etapa', 2)
            ->where('ultimo_envio_em', '<=', now()->subDays((int) $cfg['dias_followup_2']))
            ->orderBy('ultimo_envio_em')->first();
        if ($f2) {
            return [$f2, 'followup2'];
        }
        $f1 = Prospecto::where('status', 'em_sequencia')->where('etapa', 1)
            ->where('ultimo_envio_em', '<=', now()->subDays((int) $cfg['dias_followup_1']))
            ->orderBy('ultimo_envio_em')->first();
        if ($f1) {
            return [$f1, 'followup1'];
        }

        // 2) contatos novos: mais recentes primeiro; confere se têm WhatsApp
        for ($i = 0; $i < 5; $i++) {
            $novo = Prospecto::where('status', 'novo')->where('etapa', 0)
                ->whereNotNull('telefone')
                ->orderByDesc('data_abertura')->orderBy('id')->first();
            if (!$novo) {
                return [null, 'inicial'];
            }
            $check = $this->wa->verificarWhatsApp([$novo->telefone]);
            if ($check === null) {
                return [null, 'inicial']; // erro de rede: tenta de novo no próximo minuto
            }
            if (($check[$novo->telefone] ?? false) === true) {
                return [$novo, 'inicial'];
            }
            $novo->update(['status' => 'sem_whatsapp']);
        }
        return [null, 'inicial'];
    }

    /** Quantas vezes cada modelo já foi enviado (por tipo). [modelo_id => total] */
    private function usoModelos(string $tipo): array
    {
        return ProspeccaoMensagem::where('direcao', 'saida')->where('ok', true)->where('tipo', $tipo)
            ->whereNotNull('modelo_id')
            ->select('modelo_id', DB::raw('count(*) as total'))
            ->groupBy('modelo_id')->pluck('total', 'modelo_id')->all();
    }

    /**
     * ALTERNA os modelos: usa sempre o ativo que foi menos enviado (empate = o mais antigo).
     * Resultado: A, B, C, D, E, A, B... distribuído por igual (e a taxa de resposta fica comparável).
     */
    private function proximoModelo(string $tipo, ?array &$uso = null): ?ProspeccaoModelo
    {
        $uso ??= $this->usoModelos($tipo);
        $modelo = ProspeccaoModelo::where('tipo', $tipo)->where('ativo', true)->orderBy('id')->get()
            ->sortBy(fn ($m) => $uso[$m->id] ?? 0)->first(); // sortBy é estável: empate mantém ordem por id
        if ($modelo) {
            $uso[$modelo->id] = ($uso[$modelo->id] ?? 0) + 1;
        }
        return $modelo;
    }

    /**
     * Prévia da fila: quem vai receber em seguida, que modelo e o texto (amostra).
     * Mesma ordem e mesma regra de alternância do envio real.
     */
    public function previaFila(int $limite = 20): array
    {
        $cfg = $this->config();
        $fila = collect();

        Prospecto::where('status', 'em_sequencia')->where('etapa', 2)
            ->where('ultimo_envio_em', '<=', now()->subDays((int) $cfg['dias_followup_2']))
            ->orderBy('ultimo_envio_em')->limit($limite)->get()
            ->each(fn ($p) => $fila->push([$p, 'followup2']));
        Prospecto::where('status', 'em_sequencia')->where('etapa', 1)
            ->where('ultimo_envio_em', '<=', now()->subDays((int) $cfg['dias_followup_1']))
            ->orderBy('ultimo_envio_em')->limit($limite)->get()
            ->each(fn ($p) => $fila->push([$p, 'followup1']));
        Prospecto::where('status', 'novo')->where('etapa', 0)->whereNotNull('telefone')
            ->orderByDesc('data_abertura')->orderBy('id')->limit($limite)->get()
            ->each(fn ($p) => $fila->push([$p, 'inicial']));

        $usos = [];
        $saida = [];
        foreach ($fila->take($limite) as [$p, $tipo]) {
            $usos[$tipo] ??= $this->usoModelos($tipo);
            $modelo = $this->proximoModelo($tipo, $usos[$tipo]);
            $saida[] = [
                'id'        => $p->id,
                'nome'      => $p->nome,
                'cidade'    => $p->cidade,
                'uf'        => $p->uf,
                'telefone'  => $p->telefone,
                'tipo'      => $tipo,
                'modelo'    => $modelo?->nome,
                'mensagem'  => $modelo ? $this->renderizar($modelo->texto, $p) : null,
            ];
        }
        return $saida;
    }

    // ── Respostas ───────────────────────────────────────────────────

    public function ehOptOut(string $texto): bool
    {
        $t = mb_strtolower(trim($texto));
        foreach (config('prospeccao.optout_palavras') as $palavra) {
            if ($t === $palavra || preg_match('/\b' . preg_quote($palavra, '/') . '\b/u', $t)) {
                return true;
            }
        }
        return false;
    }

    /** Registra uma resposta recebida e atualiza o funil. */
    public function registrarResposta(string $numeroLimpo, string $texto): ?Prospecto
    {
        $ult8 = substr($numeroLimpo, -8);
        if (strlen($ult8) < 8) {
            return null;
        }
        $p = Prospecto::where('telefone', 'like', '%' . $ult8)->first();
        if (!$p) {
            return null;
        }

        ProspeccaoMensagem::create([
            'prospecto_id' => $p->id,
            'direcao'      => 'entrada',
            'tipo'         => 'resposta',
            'texto'        => $texto,
            'ok'           => true,
            'created_at'   => now(),
        ]);

        if ($this->ehOptOut($texto)) {
            $p->update(['status' => 'optout', 'respondeu_em' => $p->respondeu_em ?? now()]);
        } elseif (in_array($p->status, ['novo', 'em_sequencia'], true)) {
            $p->update(['status' => 'respondeu', 'respondeu_em' => now()]);
        }
        return $p;
    }
}
