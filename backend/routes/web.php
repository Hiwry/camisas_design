<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// Fallback para servir arquivos do storage (quando o symlink público da hospedagem falhar ou não existir)
Route::get('/storage/{path}', function (string $path) {
    if (str_contains($path, '..')) {
        abort(403);
    }

    $fullPath = storage_path('app/public/' . $path);
    if (!file_exists($fullPath) || !is_file($fullPath)) {
        $disk = config('filesystems.default', 'public');
        if (Storage::disk($disk)->exists($path)) {
            $fullPath = Storage::disk($disk)->path($path);
        } else {
            abort(404, 'Arquivo não encontrado no storage.');
        }
    }

    return response()->file($fullPath, [
        'Cache-Control' => 'public, max-age=86400',
    ]);
})->where('path', '.*');

// Serve o frontend React SPA para qualquer rota web que não seja da API ou Storage
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
