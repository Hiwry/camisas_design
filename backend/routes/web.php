<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// Fallback para servir arquivos do storage (quando o symlink público da hospedagem falhar ou não existir)
Route::get('/storage/{path}', function (string $path) {
    if (str_contains($path, '..')) {
        abort(403);
    }

    $path = ltrim($path, '/');

    // Lista exaustiva de locais onde o arquivo pode ter sido gravado
    $candidates = [
        storage_path('app/public/' . $path),
        storage_path('app/private/' . $path),
        storage_path('app/' . $path),
        public_path('storage/' . $path),
        base_path('storage/app/public/' . $path),
        base_path('storage/app/private/' . $path),
        base_path('storage/app/' . $path),
    ];

    foreach ($candidates as $candidate) {
        if (@file_exists($candidate) && is_file($candidate)) {
            return response()->file($candidate, [
                'Access-Control-Allow-Origin' => '*',
                'Cache-Control'               => 'public, max-age=86400',
            ]);
        }
    }

    // Tenta via disks do Storage
    $disks = array_unique(['public', 'local', config('filesystems.default')]);
    foreach ($disks as $diskName) {
        if ($diskName && Storage::disk($diskName)->exists($path)) {
            $diskPath = Storage::disk($diskName)->path($path);
            if (@file_exists($diskPath) && is_file($diskPath)) {
                return response()->file($diskPath, [
                    'Access-Control-Allow-Origin' => '*',
                    'Cache-Control'               => 'public, max-age=86400',
                ]);
            }
        }
    }

    abort(404, 'Arquivo não encontrado no storage.');
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
