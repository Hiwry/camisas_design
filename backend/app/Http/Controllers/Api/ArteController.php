<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Arte;
use App\Models\Pedido;
use Illuminate\Http\Request;
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
            'arquivo'  => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:20480',
            'preview'  => 'nullable|file|mimes:jpg,jpeg,png,webp|max:10240',
        ]);

        // Rejeita se nenhum arquivo foi enviado
        if (!$request->hasFile('arquivo') && !$request->hasFile('preview')) {
            return response()->json(['message' => 'Envie ao menos um arquivo ou preview.'], 422);
        }

        $versao = Arte::proximaVersao($pedido->id);
        $data = ['pedido_id' => $pedido->id, 'versao' => $versao];
        $disk = config('filesystems.default', 'public');

        // Upload do arquivo fonte (PDF, etc.)
        if ($request->hasFile('arquivo')) {
            $file = $request->file('arquivo');
            $extensao = $file->extension();
            $nomeSeguro = $pedido->id . '_v' . $versao . '_' . time() . '.' . $extensao;
            $path = $file->storeAs("artes/{$pedido->id}", $nomeSeguro, $disk);
            $data['arquivo_url']    = Storage::disk($disk)->url($path);
            $data['arquivo_nome']   = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME) . '.' . $extensao;
            $data['arquivo_tipo']   = $extensao === 'pdf' ? 'pdf' : 'imagem';
            $data['arquivo_tamanho']= $file->getSize();
        }

        // Upload do preview (imagem para visualização)
        if ($request->hasFile('preview')) {
            $prev = $request->file('preview');
            $extPrev = $prev->extension();
            $nomePrev = $pedido->id . '_v' . $versao . '_preview_' . time() . '.' . $extPrev;
            $path = $prev->storeAs("previews/{$pedido->id}", $nomePrev, $disk);
            $data['preview_url']  = Storage::disk($disk)->url($path);
            $data['preview_nome'] = $nomePrev;
        }

        // Desativa versões anteriores e cria a nova
        Arte::where('pedido_id', $pedido->id)->update(['ativa' => false]);
        $data['ativa'] = true;
        $data['enviada_em'] = now();

        $arte = Arte::create($data);

        // Move pedido para "aguardando aprovação" automaticamente (qualquer status exceto finalizado)
        if (!in_array($pedido->status, ['aprovado', 'finalizado'])) {
            $pedido->update(['status' => 'aguardando_aprovacao']);
        }

        return response()->json($arte, 201);
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
