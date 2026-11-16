<?php

namespace App\Console\Commands;

use App\Services\ProspeccaoService;
use Illuminate\Console\Command;

class ProspeccaoEnviar extends Command
{
    protected $signature   = 'prospeccao:enviar';
    protected $description = 'Envia a próxima mensagem da prospecção (no máx. 1 por execução; rodar a cada minuto)';

    public function handle(ProspeccaoService $svc): int
    {
        $this->line($svc->processarUmEnvio());
        return self::SUCCESS;
    }
}
