<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'ativo' => \App\Http\Middleware\EnsureUserAtivo::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);

        // Evita RouteNotFoundException: Route [login] not defined em requisições de API
        $middleware->redirectGuestsTo(fn () => null);

        // Security headers em todas as respostas
        $middleware->append(\App\Http\Middleware\SecurityHeadersMiddleware::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
