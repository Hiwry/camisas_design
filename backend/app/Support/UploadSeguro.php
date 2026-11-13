<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * Evita upload de arquivos executáveis (ex.: shell.php) escolhendo a extensão
 * a partir de uma lista permitida, nunca confiando cegamente no nome enviado.
 */
class UploadSeguro
{
    public const IMAGENS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

    public const PERMITIDAS = [
        'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'tif', 'tiff', 'heic',
        'pdf', 'ai', 'eps', 'psd', 'cdr', 'zip', 'rar', '7z', 'xcf', 'indd',
        'doc', 'docx', 'xls', 'xlsx', 'txt',
    ];

    /**
     * Retorna a extensão segura do arquivo ou lança 422.
     */
    public static function extensao(UploadedFile $file, ?array $permitidas = null, string $campo = 'arquivo'): string
    {
        $permitidas = $permitidas ?? self::PERMITIDAS;
        $cliente = strtolower((string) $file->getClientOriginalExtension());
        $mime = strtolower((string) ($file->guessExtension() ?? ''));
        if ($mime === 'jpeg') {
            $mime = 'jpg';
        }

        // Preferimos a extensão detectada pelo conteúdo quando ela é permitida
        if ($mime !== '' && in_array($mime, $permitidas, true)) {
            return $mime === 'jpg' && $cliente === 'jpeg' ? 'jpeg' : $mime;
        }

        if ($cliente !== '' && in_array($cliente, $permitidas, true)
            && !in_array($mime, ['php', 'html', 'htm', 'js', 'xml', 'sh'], true)) {
            return $cliente;
        }

        throw ValidationException::withMessages([
            $campo => ['Tipo de arquivo não permitido.'],
        ]);
    }
}
