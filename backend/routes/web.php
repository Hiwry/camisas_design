<?php

use Illuminate\Support\Facades\Route;

// Fallback para servir arquivos do storage (quando o symlink público da hospedagem falhar ou não existir)
Route::get('/storage/{path}', function (string $path) {
    $path = ltrim(str_replace(chr(92), '/', rawurldecode($path)), '/');

    // Bloqueia path traversal, bytes nulos e arquivos ocultos (.env, .htaccess...)
    if ($path === '' || str_contains($path, '..') || str_contains($path, chr(0))
        || preg_match('#(^|/)\.#', $path)) {
        abort(403);
    }

    // Somente locais públicos (nunca storage/app/private nem a raiz de storage/app)
    $bases = array_filter([
        realpath(storage_path('app/public')),
        realpath(public_path('storage')),
    ]);

    foreach ($bases as $base) {
        $real = realpath($base . DIRECTORY_SEPARATOR . $path);
        if ($real === false || !is_file($real)) {
            continue;
        }
        // Garante que o arquivo resolvido continua dentro da pasta base
        if (!str_starts_with($real, $base . DIRECTORY_SEPARATOR)) {
            continue;
        }

        $ext = strtolower(pathinfo($real, PATHINFO_EXTENSION));
        $imagens = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'];
        $headers = [
            'Access-Control-Allow-Origin'    => '*',
            'Cache-Control'                  => 'public, max-age=86400',
            'X-Content-Type-Options'         => 'nosniff',
            // Impede execução de scripts em qualquer arquivo enviado por usuários (SVG/HTML)
            'Content-Security-Policy'        => "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        ];

        // Tudo que não é imagem raster/PDF/SVG inerte é forçado a download
        if (in_array($ext, ['html', 'htm', 'xhtml', 'xml', 'js', 'mjs', 'php', 'phtml', 'phar'], true)) {
            $headers['Content-Type'] = 'application/octet-stream';
            $headers['Content-Disposition'] = 'attachment';
        } elseif ($ext === 'svg') {
            $headers['Content-Type'] = 'image/svg+xml';
        } elseif (!in_array($ext, array_merge($imagens, ['pdf']), true)) {
            $headers['Content-Disposition'] = 'attachment';
        }

        return response()->file($real, $headers);
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
