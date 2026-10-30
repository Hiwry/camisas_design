<?php

use Illuminate\Support\Facades\Route;

// Serve o frontend React SPA para qualquer rota web que não seja da API
Route::get('/{any?}', function () {
    $indexPath = public_path('index.html');
    if (file_exists($indexPath)) {
        return response(file_get_contents($indexPath), 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
        ]);
    }
    return response()->json([
        'app'     => config('app.name'),
        'status'  => 'ok',
        'message' => 'Frontend build não encontrado em public/index.html. Execute npm run build.'
    ]);
})->where('any', '^(?!api|storage).*$');
