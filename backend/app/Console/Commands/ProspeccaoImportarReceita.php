<?php

namespace App\Console\Commands;

use App\Services\ProspeccaoService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Importa empresas novas dos arquivos abertos da Receita Federal (CNPJ).
 *
 * Baixe em https://dadosabertos.rfb.gov.br/CNPJ/ (ou o espelho https://arquivos.receitafederal.gov.br)
 * os arquivos "Estabelecimentos0.zip ... Estabelecimentos9.zip" (e "Municipios.zip"), descompacte
 * e rode este comando em cada .csv. O comando lê em streaming (aguenta arquivos de GB).
 */
class ProspeccaoImportarReceita extends Command
{
    protected $signature = 'prospeccao:importar-receita
        {arquivo : Caminho do CSV de Estabelecimentos descompactado}
        {--cnae=1411801,1412601,1412602,1412603,1413401,1413402,1413403,1414200 : CNAEs principais (sem pontuação, separados por vírgula)}
        {--meses=12 : Só empresas abertas nos últimos N meses}
        {--uf= : Filtrar por UF (ex: AL). Vazio = Brasil todo}
        {--municipios= : Caminho do Municipios.csv para trocar o código pelo nome da cidade}
        {--limite=0 : Parar após importar N contatos (0 = sem limite)}';

    protected $description = 'Importa confecções com menos de N meses de abertura a partir dos dados abertos da Receita';

    public function handle(): int
    {
        $arquivo = (string) $this->argument('arquivo');
        if (!is_file($arquivo)) {
            $this->error("Arquivo não encontrado: {$arquivo}");
            return self::FAILURE;
        }

        $cnaes  = array_filter(array_map('trim', explode(',', (string) $this->option('cnae'))));
        $corte  = now()->subMonths((int) $this->option('meses'))->format('Ymd');
        $uf     = strtoupper(trim((string) $this->option('uf')));
        $limite = (int) $this->option('limite');

        $municipios = [];
        if ($this->option('municipios') && is_file($this->option('municipios'))) {
            $h = fopen($this->option('municipios'), 'r');
            while (($l = fgetcsv($h, 0, ';', '"')) !== false) {
                if (isset($l[0], $l[1])) {
                    $municipios[trim($l[0])] = $this->utf8($l[1]);
                }
            }
            fclose($h);
        }

        $h = fopen($arquivo, 'r');
        $lote = [];
        $lidos = $importados = 0;
        $agora = now();

        // Layout oficial de Estabelecimentos (sem cabeçalho, separador ';'):
        // 0 cnpj_basico | 1 ordem | 2 dv | 3 matriz(1)/filial(2) | 4 nome fantasia | 5 situação (02=ativa)
        // 10 início atividade (AAAAMMDD) | 11 CNAE principal | 19 UF | 20 município | 21-22 DDD/tel1 | 23-24 DDD/tel2 | 27 e-mail
        while (($c = fgetcsv($h, 0, ';', '"')) !== false) {
            $lidos++;
            if (count($c) < 28) {
                continue;
            }
            if ($c[5] !== '02' || $c[3] !== '1') {
                continue; // só ativas e matriz
            }
            if ($c[10] < $corte || !in_array($c[11], $cnaes, true)) {
                continue;
            }
            if ($uf !== '' && $c[19] !== $uf) {
                continue;
            }

            $tel = ProspeccaoService::normalizarTelefone($c[21] . $c[22])
                ?? ProspeccaoService::normalizarTelefone($c[23] . $c[24]);
            if (!$tel) {
                continue; // sem celular = sem WhatsApp
            }

            $cod = trim($c[20]);
            $lote[] = [
                'cnpj'          => $c[0] . $c[1] . $c[2],
                'nome'          => $this->utf8($c[4]) ?: null,
                'cidade'        => $municipios[$cod] ?? $cod,
                'uf'            => $c[19],
                'cnae'          => $c[11],
                'data_abertura' => substr($c[10], 0, 4) . '-' . substr($c[10], 4, 2) . '-' . substr($c[10], 6, 2),
                'telefone'      => $tel,
                'email'         => $c[27] !== '' ? mb_strtolower($this->utf8($c[27])) : null,
                'origem'        => 'receita',
                'status'        => 'pendente', // só envia depois que você aprovar na tela
                'etapa'         => 0,
                'created_at'    => $agora,
                'updated_at'    => $agora,
            ];

            if (count($lote) >= 500) {
                $importados += $this->gravar($lote);
                $lote = [];
                $this->line("lidas {$lidos} linhas | novos contatos {$importados}");
            }
            if ($limite > 0 && $importados >= $limite) {
                break;
            }
        }
        fclose($h);
        if ($lote) {
            $importados += $this->gravar($lote);
        }

        $this->info("Concluído: {$lidos} linhas lidas, {$importados} contatos novos importados.");
        $this->comment('Obs.: telefones repetidos (ex.: contador que cadastra várias empresas) são ignorados de propósito.');
        return self::SUCCESS;
    }

    private function gravar(array $lote): int
    {
        // insertOrIgnore respeita os índices únicos (cnpj e telefone): sem duplicar contato
        return (int) DB::table('prospectos')->insertOrIgnore($lote);
    }

    private function utf8(string $s): string
    {
        return trim(mb_convert_encoding($s, 'UTF-8', 'ISO-8859-1'));
    }
}
