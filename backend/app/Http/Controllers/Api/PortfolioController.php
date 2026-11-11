<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortfolioItem;
use App\Models\PortfolioCategoria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

        $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
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

        // Garantir que a imagem principal esteja no início da galeria
        if (!empty($imagemPrincipal) && !in_array($imagemPrincipal, $galeria)) {
            array_unshift($galeria, $imagemPrincipal);
        }
        $galeria = array_values(array_unique(array_filter($galeria)));
        if (empty($galeria)) {
            $galeria = [$imagemPrincipal];
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
            'galeria'          => 'nullable',
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

        $disk = in_array(config('filesystems.default'), ['r2', 's3']) ? config('filesystems.default') : 'public';
        $data = $request->only([
            'titulo', 'categoria', 'servico', 'subtitulo', 'descricao', 'cliente',
            'ano', 'tecido', 'tecnica', 'destaque', 'ordem', 'ativo'
        ]);

        $imagemPrincipal = $portfolio->imagem_principal;
        if ($request->hasFile('imagem_arquivo')) {
            $file = $request->file('imagem_arquivo');
            $path = $file->store('portfolio', $disk);
            $imagemPrincipal = Storage::disk($disk)->url($path);
            $data['imagem_principal'] = $imagemPrincipal;
        } elseif ($request->filled('imagem_principal')) {
            $imagemPrincipal = $request->imagem_principal;
            $data['imagem_principal'] = $imagemPrincipal;
        }

        // Galeria de imagens
        $galeria = null;
        if ($request->has('galeria')) {
            $rawGaleria = $request->galeria;
            $galeria = is_string($rawGaleria) ? (json_decode($rawGaleria, true) ?? []) : (is_array($rawGaleria) ? $rawGaleria : []);
        } elseif ($portfolio->galeria) {
            $galeria = is_array($portfolio->galeria) ? $portfolio->galeria : (json_decode($portfolio->galeria, true) ?? []);
        } else {
            $galeria = [$imagemPrincipal];
        }

        // Se fez upload de novas imagens para a galeria
        if ($request->hasFile('galeria_arquivos')) {
            foreach ($request->file('galeria_arquivos') as $gFile) {
                $gPath = $gFile->store('portfolio', $disk);
                $galeria[] = Storage::disk($disk)->url($gPath);
            }
        }

        // Garantir que a imagem principal esteja na galeria (e na 1ª posição se for nova/diferente)
        if (!empty($imagemPrincipal)) {
            if (!in_array($imagemPrincipal, $galeria)) {
                array_unshift($galeria, $imagemPrincipal);
            }
        }

        $galeria = array_values(array_unique(array_filter($galeria)));
        if (!empty($galeria)) {
            $data['galeria'] = $galeria;
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

    // ═══════════════════════════════════════════════════════════
    // GESTÃO DE CATEGORIAS E SERVIÇOS DO PORTFÓLIO
    // ═══════════════════════════════════════════════════════════

    /**
     * Listar categorias e serviços (Público / Admin)
     */
    public function listarCategorias(Request $request)
    {
        $user = auth('sanctum')->user();
        $isAdm = $user && $user->role === 'admin';

        $query = PortfolioCategoria::query()->orderBy('ordem', 'asc')->orderBy('id', 'asc');
        if (!$isAdm && !$request->boolean('todas')) {
            $query->where('ativo', true);
        }

        $todas = $query->get();

        // Contagens por slug em portfolio_itens
        $contagensCategorias = PortfolioItem::select('categoria')
            ->selectRaw('count(*) as count')
            ->groupBy('categoria')
            ->pluck('count', 'categoria');

        $contagensServicos = PortfolioItem::select('servico')
            ->selectRaw('count(*) as count')
            ->groupBy('servico')
            ->pluck('count', 'servico');

        $categorias = $todas->where('tipo', 'segmento')->values()->map(function ($cat) use ($contagensCategorias) {
            $cat->total_itens = $contagensCategorias[$cat->slug] ?? 0;
            return $cat;
        });

        $servicos = $todas->where('tipo', 'servico')->values()->map(function ($srv) use ($contagensServicos) {
            $srv->total_itens = $contagensServicos[$srv->slug] ?? 0;
            return $srv;
        });

        return response()->json([
            'categorias' => $categorias,
            'servicos'   => $servicos,
            'todas'      => $todas,
        ]);
    }

    /**
     * Criar categoria ou serviço (somente Admin)
     */
    public function storeCategoria(Request $request)
    {
        $request->validate([
            'nome'  => 'required|string|max:100',
            'slug'  => 'nullable|string|max:100',
            'tipo'  => 'required|in:segmento,servico',
            'ordem' => 'nullable|integer',
            'ativo' => 'nullable|boolean',
        ]);

        $slug = !empty($request->slug)
            ? Str::slug($request->slug)
            : Str::slug($request->nome);

        // Se o slug já existir, adiciona sufixo numérico
        $originalSlug = $slug;
        $counter = 1;
        while (PortfolioCategoria::where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$counter}";
            $counter++;
        }

        $maxOrdem = PortfolioCategoria::where('tipo', $request->tipo)->max('ordem') ?? 0;

        $categoria = PortfolioCategoria::create([
            'nome'  => trim($request->nome),
            'slug'  => $slug,
            'tipo'  => $request->tipo,
            'ordem' => $request->has('ordem') ? (int) $request->ordem : $maxOrdem + 1,
            'ativo' => $request->has('ativo') ? $request->boolean('ativo') : true,
        ]);

        return response()->json($categoria, 201);
    }

    /**
     * Atualizar categoria ou serviço (somente Admin)
     */
    public function updateCategoria(Request $request, PortfolioCategoria $categoria)
    {
        $request->validate([
            'nome'  => 'sometimes|required|string|max:100',
            'slug'  => 'nullable|string|max:100',
            'tipo'  => 'nullable|in:segmento,servico',
            'ordem' => 'nullable|integer',
            'ativo' => 'nullable|boolean',
        ]);

        $dados = [];
        if ($request->has('nome')) {
            $dados['nome'] = trim($request->nome);
        }

        if ($request->filled('slug')) {
            $slug = Str::slug($request->slug);
            // Verifica se o slug pertence a outro
            if ($slug !== $categoria->slug && PortfolioCategoria::where('slug', $slug)->where('id', '!=', $categoria->id)->exists()) {
                return response()->json(['message' => 'Este identificador (slug) já está em uso.'], 422);
            }
            $dados['slug'] = $slug;
        }

        if ($request->has('tipo')) {
            $dados['tipo'] = $request->tipo;
        }

        if ($request->has('ordem')) {
            $dados['ordem'] = (int) $request->ordem;
        }

        if ($request->has('ativo')) {
            $dados['ativo'] = $request->boolean('ativo');
        }

        // Se o slug foi alterado, atualiza também os itens que usavam o slug antigo
        $slugAntigo = $categoria->slug;
        $categoria->update($dados);

        if (!empty($dados['slug']) && $dados['slug'] !== $slugAntigo) {
            $campo = $categoria->tipo === 'segmento' ? 'categoria' : 'servico';
            PortfolioItem::where($campo, $slugAntigo)->update([$campo => $dados['slug']]);
        }

        return response()->json($categoria);
    }

    /**
     * Excluir categoria ou serviço (somente Admin)
     */
    public function destroyCategoria(PortfolioCategoria $categoria)
    {
        $campo = $categoria->tipo === 'segmento' ? 'categoria' : 'servico';
        $totalVinculados = PortfolioItem::where($campo, $categoria->slug)->count();

        // Se houver trabalhos vinculados, podemos reatribuir ou avisar
        if ($totalVinculados > 0 && !request()->boolean('forcar')) {
            return response()->json([
                'message' => "Esta categoria possui {$totalVinculados} trabalho(s) vinculado(s). Confirme para desvincular ou excluir.",
                'total_vinculados' => $totalVinculados,
            ], 409);
        }

        $categoria->delete();
        return response()->json(['message' => 'Categoria removida com sucesso.']);
    }
}
