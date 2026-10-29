<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'evolution' => [
        'url'          => env('EVOLUTION_API_URL', 'http://localhost:8080'),
        'key'          => env('EVOLUTION_API_KEY'),
        'instance'     => env('EVOLUTION_INSTANCE', 'camiseta-design'),
        'admin_number' => env('WHATSAPP_ADMIN_NUMBER'),
    ],

    'openrouter' => [
        // Aceita OPENROUTER_API_KEY ou ANTHROPIC_API_KEY (compatibilidade)
        'key'      => env('OPENROUTER_API_KEY') ?? env('ANTHROPIC_API_KEY'),
        'model'    => env('OPENROUTER_MODEL') ?? env('ANTHROPIC_MODEL', 'anthropic/claude-sonnet-4-5'),
        'base_url' => env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
    ],

    'pix' => [
        'chave'            => env('PIX_CHAVE', 'financeiro@camisasdesign.com'),
        'beneficiario'     => env('PIX_BENEFICIARIO', 'Camiseta Design'),
        'cidade'           => env('PIX_CIDADE', 'SAO PAULO'),
        'valor_credito_ia' => (float) env('VALOR_CREDITO_IA', 5.00),
    ],

];
