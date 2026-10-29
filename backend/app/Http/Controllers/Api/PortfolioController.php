<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortfolioItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PortfolioController extends Controller
{
    /**
     * Listar itens do portfólio (acessível pública e internamente)
     */
    public function index(Request $request)
    {
        $query = PortfolioItem::query();

        // Se não for admin logado pedindo todos, só mostra os ativos
        $user = auth('sanctum')->user();
        if (!$user || $user->role !== 'admin' || !$request->boolean('incluir_inativos')) {
            $query->where('ativo', true);
        }

        // Filtro por categoria (Segmento: esportivos, empresas, eventos)
        if ($request->filled('categoria') && $request->categoria !== 'todos') {
            $query->where('categoria', $request->categoria);
        }

        // Filtro por serviço/técnica (sublimacao, serigrafia, bordado, logos)
        if ($request->filled('servico') && $request->servico !== 'todos') {
            $query->where('servico', $request->servico);
        }

        // Filtro por destaque
        if ($request->boolean('destaque_only')) {
            $query->where('destaque', true);
        }

        // Busca textual por título, subtítulo, cliente ou tags
        if ($request->filled('busca')) {
            $termo = '%' . $request->busca . '%';
            $query->where(function ($q) use ($termo) {
                $q->where('titulo', 'like', $termo)
                  ->orWhere('subtitulo', 'like', $termo)
                  ->orWhere('cliente', 'like', $termo)
                  ->orWhere('tecido', 'like', $termo)
                  ->orWhere('descricao', 'like', $termo);
            });
        }

        // Ordenação
        $query->orderBy('destaque', 'desc')
              ->orderBy('ordem', 'asc')
              ->orderBy('id', 'desc');

        $itens = $query->get();

        // Métricas resumidas do portfólio
        $metricas = [
            'total'          => PortfolioItem::where('ativo', true)->count(),
            'destaques'      => PortfolioItem::where('ativo', true)->where('destaque', true)->count(),
            'total_curtidas' => PortfolioItem::where('ativo', true)->sum('curtidas'),
            'categorias'     => PortfolioItem::where('ativo', true)
                                    ->select('categoria')
                                    ->selectRaw('count(*) as count')
                                    ->groupBy('categoria')
                                    ->pluck('count', 'categoria'),
            'servicos'       => PortfolioItem::where('ativo', true)
                                    ->select('servico')
                                    ->selectRaw('count(*) as count')
                                    ->groupBy('servico')
                                    ->pluck('count', 'servico'),
        ];

        return response()->json([
            'itens'    => $itens,
            'metricas' => $metricas,
        ]);
    }

    /**
     * Exibir detalhes de um item do portfólio
     */
    public function show(PortfolioItem $portfolio)
    {
        return response()->json($portfolio);
    }

    /**
     * Incrementar curtidas no item do portfólio (público)
     */
    public function curtir(PortfolioItem $portfolio)
    {
        $portfolio->increment('curtidas');
        return response()->json([
            'success'  => true,
            'curtidas' => $portfolio->curtidas,
        ]);
    }

    /**
     * Criar novo item no portfólio (somente Admin)
     */
    public function store(Request $request)
    {
        $request->validate([
            'titulo'           => 'required|string|max:150',
            'categoria'        => 'required|string|max:60',
            'servico'          => 'nullable|string|max:60',
            'subtitulo'        => 'nullable|string|max:180',
            'descricao'        => 'nullable|string',
            'imagem_principal' => 'nullable|string',
            'imagem_arquivo'   => 'nullable|image|max:10240',
            'galeria_arquivos.*' => 'nullable|image|max:10240',
            'cliente'          => 'nullable|string|max:100',
            'ano'              => 'nullable|string|max:10',
            'tecido'           => 'nullable|string|max:100',
            'tecnica'          => 'nullable|string|max:100',
            'cores'            => 'nullable',
            'tags'             => 'nullable',
            'destaque'         => 'nullable|boolean',
            'ordem'            => 'nullable|integer',
            'ativo'            => 'nullable|boolean',
        ]);

        $disk = config('filesystems.default', 'public');
        $imagemPrincipal = $request->imagem_principal;

        // Se fez upload de imagem principal
        if ($request->hasFile('imagem_arquivo')) {
            $file = $request->file('imagem_arquivo');
            $path = $file->store('portfolio', $disk);
            $imagemPrincipal = Storage::disk($disk)->url($path);
        }

        if (empty($imagemPrincipal)) {
            return response()->json([
                'message' => 'Forneça uma URL de imagem principal ou faça o upload de um arquivo.',
            ], 422);
        }

        // Galeria de imagens
        $galeria = [];
        if ($request->filled('galeria')) {
            $galeria = is_array($request->galeria) ? $request->galeria : json_decode($request->galeria, true) ?? [];
        }

        // Se fez upload de imagens adicionais para a galeria
        if ($request->hasFile('galeria_arquivos')) {
            foreach ($request->file('galeria_arquivos') as $gFile) {
                $gPath = $gFile->store('portfolio', $disk);
                $galeria[] = Storage::disk($disk)->url($gPath);
            }
        }

        // Processar cores e tags
        $cores = $request->cores;
        if (is_string($cores)) {
            $cores = json_decode($cores, true) ?? array_filter(array_map('trim', explode(',', $cores)));
        }

        $tags = $request->tags;
        if (is_string($tags)) {
            $tags = json_decode($tags, true) ?? array_filter(array_map('trim', explode(',', $tags)));
        }

        $item = PortfolioItem::create([
            'titulo'           => $request->titulo,
            'categoria'        => $request->categoria,
            'servico'          => $request->servico ?? 'sublimacao',
            'subtitulo'        => $request->subtitulo,
            'descricao'        => $request->descricao,
            'imagem_principal' => $imagemPrincipal,
            'galeria'          => !empty($galeria) ? $galeria : [$imagemPrincipal],
            'cliente'          => $request->cliente ?? 'Cliente Especial',
            'ano'              => $request->ano ?? date('Y'),
            'tecido'           => $request->tecido ?? 'Dry-Fit UV50+',
            'tecnica'          => $request->tecnica ?? 'Sublimação Total',
            'cores'            => $cores ?? ['#000000', '#d4a020', '#ffffff'],
            'tags'             => $tags ?? [$request->categoria],
            'destaque'         => $request->boolean('destaque'),
            'ordem'            => $request->ordem ?? 0,
            'ativo'            => $request->has('ativo') ? $request->boolean('ativo') : true,
            'curtidas'         => 0,
        ]);

        return response()->json($item, 201);
    }

    /**
     * Atualizar item no portfólio (somente Admin)
     */
    public function update(Request $request, PortfolioItem $portfolio)
    {
        $request->validate([
            'titulo'           => 'sometimes|required|string|max:150',
            'categoria'        => 'sometimes|required|string|max:60',
            'servico'          => 'nullable|string|max:60',
            'subtitulo'        => 'nullable|string|max:180',
            'descricao'        => 'nullable|string',
            'imagem_principal' => 'nullable|string',
            'imagem_arquivo'   => 'nullable|image|max:10240',
            'cliente'          => 'nullable|string|max:100',
            'ano'              => 'nullable|string|max:10',
            'tecido'           => 'nullable|string|max:100',
            'tecnica'          => 'nullable|string|max:100',
            'cores'            => 'nullable',
            'tags'             => 'nullable',
            'destaque'         => 'nullable|boolean',
            'ordem'            => 'nullable|integer',
            'ativo'            => 'nullable|boolean',
        ]);

        $disk = config('filesystems.default', 'public');
        $data = $request->only([
            'titulo', 'categoria', 'servico', 'subtitulo', 'descricao', 'cliente',
            'ano', 'tecido', 'tecnica', 'destaque', 'ordem', 'ativo'
        ]);

        if ($request->hasFile('imagem_arquivo')) {
            $file = $request->file('imagem_arquivo');
            $path = $file->store('portfolio', $disk);
            $data['imagem_principal'] = Storage::disk($disk)->url($path);
        } elseif ($request->filled('imagem_principal')) {
            $data['imagem_principal'] = $request->imagem_principal;
        }

        if ($request->has('cores')) {
            $cores = $request->cores;
            $data['cores'] = is_string($cores) ? (json_decode($cores, true) ?? array_filter(array_map('trim', explode(',', $cores)))) : $cores;
        }

        if ($request->has('tags')) {
            $tags = $request->tags;
            $data['tags'] = is_string($tags) ? (json_decode($tags, true) ?? array_filter(array_map('trim', explode(',', $tags)))) : $tags;
        }

        if ($request->has('galeria')) {
            $galeria = $request->galeria;
            $data['galeria'] = is_string($galeria) ? json_decode($galeria, true) : $galeria;
        }

        $portfolio->update($data);

        return response()->json($portfolio);
    }

    /**
     * Alternar destaque do item (somente Admin)
     */
    public function toggleDestaque(PortfolioItem $portfolio)
    {
        $portfolio->update(['destaque' => !$portfolio->destaque]);
        return response()->json([
            'success'  => true,
            'destaque' => $portfolio->destaque,
        ]);
    }

    /**
     * Alternar visibilidade/ativo (somente Admin)
     */
    public function toggleAtivo(PortfolioItem $portfolio)
    {
        $portfolio->update(['ativo' => !$portfolio->ativo]);
        return response()->json([
            'success' => true,
            'ativo'   => $portfolio->ativo,
        ]);
    }

    /**
     * Excluir item do portfólio (somente Admin)
     */
    public function destroy(PortfolioItem $portfolio)
    {
        $portfolio->delete();
        return response()->json(['message' => 'Trabalho removido com sucesso.']);
    }
}
