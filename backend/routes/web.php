<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

// Debug route para diagnosticar storage em producao
Route::get('/debug-storage', function () {
    $path = request('path', 'pedidos/referencias/0LxIE4ij0XF52cXRvXjFUOsQBEfB4U1tthgO3Cep.png');

    $storageApp = storage_path('app');
    $allFiles = [];
    try {
        if (file_exists($storageApp)) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($storageApp, \FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $allFiles[] = str_replace(base_path(), '', $file->getPathname());
                }
            }
        }
    } catch (\Throwable $e) {
        $allFiles = ['error' => $e->getMessage()];
    }

    return response()->json([
        'requested_path'   => $path,
        'base_path'        => base_path(),
        'storage_path'     => storage_path(),
        'public_path'      => public_path(),
        'disk_default'     => config('filesystems.default'),
        'disk_public_root' => config('filesystems.disks.public.root'),
        'symlink_exists'   => is_link(public_path('storage')),
        'symlink_target'   => is_link(public_path('storage')) ? readlink(public_path('storage')) : null,
        'files_in_storage' => $allFiles,
    ]);
});

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
