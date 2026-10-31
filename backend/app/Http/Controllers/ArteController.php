<?php

namespace App\Http\Controllers;

use App\Models\Arte;
use App\Models\Pedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ArteController extends Controller
{
    public function index(Request $request, Pedido $pedido): JsonResponse
    {
        $this->authorizeAccess($request, $pedido);

        $artes = $pedido->artes()->with('ultimaAprovacao')->get();

        return response()->json($artes);
    }

    public function store(Request $request, Pedido $pedido): JsonResponse
    {
        $this->authorizeAccess($request, $pedido);

        $request->validate([
            'arquivo_preview' => 'required|file|mimes:jpg,jpeg,png,webp|max:10240',  // 10MB — imagem de visualização
            'arquivo_fonte'   => 'nullable|file|max:51200',                           // 50MB — PDF/CDR/AI/PSD etc.
            'notas'           => 'nullable|string|max:1000',
        ]);

        $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';

        // Desativar versão atual
        $pedido->artes()->where('ativa', true)->update(['ativa' => false]);

        // Calcular próxima versão
        $proximaVersao = ($pedido->artes()->max('versao') ?? 0) + 1;

        // Upload da imagem de preview (obrigatória)
        $preview      = $request->file('arquivo_preview');
        $previewPath  = $preview->store("pedidos/{$pedido->id}/previews", $disk);

        $arteData = [
            'pedido_id'    => $pedido->id,
            'versao'       => $proximaVersao,
            'preview_url'  => Storage::disk($disk)->url($previewPath),
            'preview_nome' => $preview->getClientOriginalName(),
            'notas'        => $request->notas,
            'ativa'        => true,
            'enviada_em'   => now(),
        ];

        // Upload do arquivo fonte (opcional — PDF, CDR, AI, PSD, etc.)
        if ($request->hasFile('arquivo_fonte')) {
            $fonte      = $request->file('arquivo_fonte');
            $fontePath  = $fonte->store("pedidos/{$pedido->id}/fontes", $disk);

            $arteData['arquivo_url']      = Storage::disk($disk)->url($fontePath);
            $arteData['arquivo_nome']     = $fonte->getClientOriginalName();
            $arteData['arquivo_tipo']     = $fonte->getClientOriginalExtension();
            $arteData['arquivo_tamanho']  = $fonte->getSize();
        }

        $arte = Arte::create($arteData);

        // Mover pedido para aguardando_aprovacao automaticamente
        $pedido->update(['status' => 'aguardando_aprovacao']);

        return response()->json($arte, 201);
    }

    public function destroy(Request $request, Pedido $pedido, Arte $arte): JsonResponse
    {
        if ($arte->pedido_id !== $pedido->id) {
            abort(404);
        }

        $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';

        // Remover preview do storage
        if ($arte->preview_url) {
            $previewPath = str_replace(Storage::disk($disk)->url(''), '', $arte->preview_url);
            Storage::disk($disk)->delete($previewPath);
        }

        // Remover arquivo fonte do storage (se existir)
        if ($arte->arquivo_url) {
            $fontePath = str_replace(Storage::disk($disk)->url(''), '', $arte->arquivo_url);
            Storage::disk($disk)->delete($fontePath);
        }

        $arte->delete();

        return response()->json(['message' => 'Arte removida.']);
    }

    private function authorizeAccess(Request $request, Pedido $pedido): void
    {
        $user = $request->user();
        if ($user->isConfeccao() && $pedido->confeccao_id !== $user->confeccao->id) {
            abort(403, 'Acesso negado.');
        }
    }
}
