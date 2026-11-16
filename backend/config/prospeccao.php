<?php

/*
|--------------------------------------------------------------------------
| Prospecção (CRM de confecções novas)
|--------------------------------------------------------------------------
| Usa uma instância Evolution SEPARADA da principal (outro chip), para que um
| eventual banimento por prospecção não derrube o atendimento dos clientes.
*/

return [
    // Nome da instância Evolution dedicada (crie/escaneie o QR na tela Prospecção)
    'instance' => env('EVOLUTION_PROSPECT_INSTANCE', 'prospeccao'),

    // Padrões (podem ser alterados na tela e ficam salvos em cache)
    'defaults' => [
        'ativo'              => false,   // envio automático começa DESLIGADO
        'meu_nome'           => env('PROSPECCAO_MEU_NOME', ''),
        'limite_max_dia'     => 40,      // teto diário depois do aquecimento
        'limite_inicial_dia' => 10,      // 1º dia de envio
        'aquecimento_passo'  => 5,       // +N por dia até o teto
        'hora_inicio'        => 9,
        'hora_fim'           => 17,
        'intervalo_min_seg'  => 60,
        'intervalo_max_seg'  => 180,
        'dias_followup_1'    => 3,       // dias após a mensagem inicial
        'dias_followup_2'    => 4,       // dias após o follow-up 1
        'falhas_para_pausar' => 3,       // falhas seguidas => pausa automática
    ],

    // Palavras que, numa resposta, tiram o contato da lista para sempre
    'optout_palavras' => [
        'pare', 'parar', 'sair', 'remover', 'remova', 'descadastrar',
        'não quero', 'nao quero', 'não tenho interesse', 'nao tenho interesse',
        'não me chame', 'nao me chame', 'me tire', 'me remove', 'spam',
    ],

    'timezone' => env('PROSPECCAO_TZ', 'America/Maceio'),
];
