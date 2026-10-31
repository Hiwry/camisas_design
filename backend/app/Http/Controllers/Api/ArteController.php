<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Arte;
use App\Models\Pedido;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ArteController extends Controller
{
    public function index(Pedido $pedido)
    {
        $this->authorizePedido($pedido);
        return response()->json($pedido->artes()->get());
    }

    public function store(Request $request, Pedido $pedido)
    {
        $this->authorizePedido($pedido);

        $request->validate([
            'arquivo'    => 'nullable|file|max:51200',
            'preview'    => 'nullable|file|max:20480',
            'arquivos'   => 'nullable|array',
            'arquivos.*' => 'file|max:51200',
            'previews'   => 'nullable|array',
            'previews.*' => 'file|max:20480',
            'notas'      => 'nullable|string',
            'is_final'   => 'nullable',
        ]);

        $hasAnyFile = $request->hasFile('arquivo')
            || $request->hasFile('preview')
            || $request->hasFile('arquivos')
            || $request->hasFile('previews');

        if (!$hasAnyFile) {
            return response()->json(['message' => 'Envie ao menos um arquivo ou imagem de visualização.'], 422);
        }

        $versao = Arte::proximaVersao($pedido->id);
        $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
        $arquivosLista = [];
        $primeiroPreviewUrl = null;
        $primeiroPreviewNome = null;
        $primeiroFonteUrl = null;
        $primeiroFonteNome = null;
        $primeiroFonteTipo = 'imagem';
        $primeiroFonteTamanho = null;

        $processarArquivo = function ($file, $isExplicitPreview = false) use (&$arquivosLista, &$primeiroPreviewUrl, &$primeiroPreviewNome, &$primeiroFonteUrl, &$primeiroFonteNome, &$primeiroFonteTipo, &$primeiroFonteTamanho, $pedido, $versao, $disk) {
            $ext = strtolower($file->getClientOriginalExtension());
            $origName = $file->getClientOriginalName();
            $size = $file->getSize();
            $ehImagem = in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);
            $ehPreview = $isExplicitPreview || $ehImagem;

            $folder = $ehPreview ? "previews/{$pedido->id}" : "artes/{$pedido->id}";
            $safeName = $pedido->id . '_v' . $versao . '_' . uniqid() . '.' . $ext;
            $path = $file->storeAs($folder, $safeName, $disk);
            $url = Storage::disk($disk)->url($path);

            $item = [
                'url'        => $url,
                'nome'       => $origName,
                'tipo'       => $ext === 'pdf' ? 'pdf' : ($ehImagem ? 'imagem' : 'fonte'),
                'extensao'   => $ext,
                'tamanho'    => $size,
                'eh_preview' => $ehPreview,
            ];
            $arquivosLista[] = $item;

            if ($ehPreview && !$primeiroPreviewUrl) {
                $primeiroPreviewUrl = $url;
                $primeiroPreviewNome = $origName;
            }

            if (!$ehPreview && !$primeiroFonteUrl) {
                $primeiroFonteUrl = $url;
                $primeiroFonteNome = $origName;
                // Coluna enum('pdf', 'imagem') no banco legado — mantém compatibilidade
                $primeiroFonteTipo = ($ext === 'pdf') ? 'pdf' : 'imagem';
                $primeiroFonteTamanho = $size;
            }
        };

        // Processa previews múltiplos ou único
        if ($request->hasFile('previews')) {
            foreach ($request->file('previews') as $prev) {
                $processarArquivo($prev, true);
            }
        }
        if ($request->hasFile('preview')) {
            $processarArquivo($request->file('preview'), true);
        }

        // Processa arquivos de produção/fonte múltiplos ou único
        if ($request->hasFile('arquivos')) {
            foreach ($request->file('arquivos') as $arq) {
                $processarArquivo($arq, false);
            }
        }
        if ($request->hasFile('arquivo')) {
            $processarArquivo($request->file('arquivo'), false);
        }

        // Se só tem preview e nenhum fonte, ou vice-versa, mantém consistência para o frontend
        if (!$primeiroPreviewUrl && $primeiroFonteUrl) {
            $primeiroPreviewUrl = $primeiroFonteUrl;
            $primeiroPreviewNome = $primeiroFonteNome;
        }

        $isFinal = filter_var($request->input('is_final', false), FILTER_VALIDATE_BOOLEAN);

        $temColunasNovas = false;
        try {
            $temColunasNovas = Schema::hasColumn('artes', 'arquivos');
        } catch (\Throwable $e) {
            $temColunasNovas = false;
        }

        // Se marcada como final, limpa o is_final de versões anteriores
        if ($isFinal && $temColunasNovas) {
            try {
                Arte::where('pedido_id', $pedido->id)->update(['is_final' => false]);
            } catch (\Throwable $e) {}
        }

        // Desativa versões anteriores e cria a nova como ativa
        Arte::where('pedido_id', $pedido->id)->update(['ativa' => false]);

        $arteData = [
            'pedido_id'       => $pedido->id,
            'versao'          => $versao,
            'arquivo_url'     => $primeiroFonteUrl ?? $primeiroPreviewUrl,
            'arquivo_nome'    => $primeiroFonteNome ?? $primeiroPreviewNome,
            'arquivo_tipo'    => $primeiroFonteTipo,
            'arquivo_tamanho' => $primeiroFonteTamanho,
            'preview_url'     => $primeiroPreviewUrl,
            'preview_nome'    => $primeiroPreviewNome,
            'ativa'           => true,
            'enviada_em'      => now(),
        ];

        if ($temColunasNovas) {
            $arteData['arquivos'] = !empty($arquivosLista) ? $arquivosLista : null;
            $arteData['is_final'] = $isFinal;
            $arteData['notas']    = $request->input('notas');
        }

        try {
            $arte = Arte::create($arteData);
        } catch (\Illuminate\Database\QueryException $e) {
            Log::warning("ArteController: Erro ao salvar arte com novas colunas, tentando fallback legado: " . $e->getMessage());
            unset($arteData['arquivos'], $arteData['is_final'], $arteData['notas']);
            $arte = Arte::create($arteData);
        }

        if ($isFinal) {
            $pedido->update(['status' => 'aprovado']);
        } elseif (!in_array($pedido->status, ['aprovado', 'finalizado'])) {
            $pedido->update(['status' => 'aguardando_aprovacao']);
        }

        return response()->json($arte, 201);
    }

    public function marcarFinal(Arte $arte)
    {
        $this->authorizePedido($arte->pedido);
        try {
            $arte->marcarComoFinal();
        } catch (\Throwable $e) {
            if ($arte->pedido && $arte->pedido->status !== 'finalizado') {
                $arte->pedido->update(['status' => 'aprovado']);
            }
        }
        return response()->json($arte->fresh());
    }

    public function desmarcarFinal(Arte $arte)
    {
        $this->authorizePedido($arte->pedido);
        try {
            $arte->desmarcarFinal();
        } catch (\Throwable $e) {
            $arte->update(['is_final' => false]);
            if ($arte->pedido && $arte->pedido->status === 'aprovado') {
                $arte->pedido->update(['status' => 'aguardando_aprovacao']);
            }
        }
        return response()->json($arte->fresh());
    }

    public function tornarAtiva(Arte $arte)
    {
        $this->authorizePedido($arte->pedido);
        $arte->tornarAtiva();
        return response()->json($arte->fresh());
    }

    public function destroy(Arte $arte)
    {
        // IDOR: verificar que o usuário tem acesso ao pedido desta arte
        $this->authorizePedido($arte->pedido);

        // Não permite deletar se for a única versão
        $total = Arte::where('pedido_id', $arte->pedido_id)->count();
        if ($total <= 1) {
            return response()->json(['message' => 'Não é possível remover a única versão da arte.'], 422);
        }

        $arte->delete();
        return response()->json(null, 204);
    }

    private function authorizePedido(Pedido $pedido): void
    {
        $user = auth()->user();
        if ($user->isAdmin()) return;
        if ($user->confeccao?->id !== $pedido->confeccao_id) abort(403);
    }
}
