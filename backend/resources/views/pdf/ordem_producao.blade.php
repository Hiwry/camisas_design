<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Ordem de Produção - {{ $grupo->nome }}</title>
    <style>
        @page {
            margin: 20px 25px;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            line-height: 1.3;
        }
        .header {
            border-bottom: 2px solid #e7b32c;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .header-title {
            font-size: 18px;
            font-weight: bold;
            color: #111;
            text-transform: uppercase;
            margin: 0;
        }
        .header-subtitle {
            font-size: 12px;
            color: #555;
            margin-top: 3px;
        }
        .info-grid {
            width: 100%;
            margin-bottom: 15px;
        }
        .info-grid td {
            vertical-align: top;
            padding: 4px 6px;
            background: #f8f8f9;
            border: 1px solid #e2e4e8;
        }
        .info-label {
            font-size: 9px;
            text-transform: uppercase;
            font-weight: bold;
            color: #71717a;
            display: block;
        }
        .info-val {
            font-size: 11px;
            font-weight: bold;
            color: #18181b;
        }
        .section-title {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            color: #111;
            border-bottom: 1px solid #ddd;
            padding-bottom: 3px;
            margin-top: 15px;
            margin-bottom: 8px;
        }
        table.tabela {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        table.tabela th {
            background-color: #27272a;
            color: #ffffff;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            padding: 5px 6px;
            text-align: left;
            border: 1px solid #27272a;
        }
        table.tabela td {
            padding: 5px 6px;
            border: 1px solid #e4e4e7;
            font-size: 10px;
        }
        table.tabela tr:nth-child(even) {
            background-color: #fbfbfb;
        }
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge-status {
            background-color: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
        }
        .badge-duplicado {
            background-color: #fee2e2;
            color: #b91c1c;
            font-weight: bold;
        }
        .totais-box {
            display: inline-block;
            background: #f4f4f5;
            border: 1px solid #d4d4d8;
            padding: 5px 10px;
            margin-right: 10px;
            margin-bottom: 6px;
            text-align: center;
        }
        .totais-box .num {
            font-size: 13px;
            font-weight: bold;
            color: #18181b;
        }
        .totais-box .lbl {
            font-size: 9px;
            color: #71717a;
            text-transform: uppercase;
        }
        .footer {
            margin-top: 25px;
            border-top: 1px solid #ddd;
            padding-top: 8px;
            font-size: 9px;
            color: #71717a;
            text-align: center;
        }
    </style>
</head>
<body>

    <!-- Cabeçalho -->
    <div class="header">
        <table style="width: 100%;">
            <tr>
                <td>
                    <h1 class="header-title">Ordem de Produção & Separação</h1>
                    <div class="header-subtitle">Grupo: <strong>{{ $grupo->nome }}</strong></div>
                </td>
                <td style="text-align: right; vertical-align: top;">
                    <span class="badge badge-status">{{ strtoupper(str_replace('_', ' ', $grupo->status)) }}</span>
                    <div style="font-size: 10px; color: #71717a; margin-top: 4px;">
                        Gerado em: {{ date('d/m/Y H:i') }}
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Informações do Grupo, Cliente e Confecção -->
    <table class="info-grid">
        <tr>
            <td style="width: 35%;">
                <span class="info-label">Cliente / Responsável</span>
                <span class="info-val">
                    {{ $grupo->cliente_nome ?? $grupo->user?->name ?? 'Não informado' }}
                    @if(!empty($grupo->cliente_whatsapp))
                        <span style="font-size: 10px; color: #555; font-weight: normal;">({{ $grupo->cliente_whatsapp }})</span>
                    @endif
                </span>
            </td>
            <td style="width: 35%;">
                <span class="info-label">Confecção Responsável</span>
                <span class="info-val">
                    {{ $grupo->confeccao?->nome ?? 'Própria / Não definida' }}
                </span>
            </td>
            <td style="width: 15%;">
                <span class="info-label">Total de Peças</span>
                <span class="info-val" style="color: #b45309; font-size: 13px;">{{ $totalPecas }}</span>
            </td>
            <td style="width: 15%;">
                <span class="info-label">Prazo Limite</span>
                <span class="info-val">
                    {{ $grupo->prazo_limite ? date('d/m/Y', strtotime($grupo->prazo_limite)) : 'Sem prazo' }}
                </span>
            </td>
        </tr>
    </table>

    <!-- Totais por Tamanho e por Modelo -->
    <div class="section-title">Resumo dos Totais</div>
    <div style="margin-bottom: 12px;">
        <span style="font-size: 10px; font-weight: bold; color: #555; display: block; margin-bottom: 4px;">POR TAMANHO:</span>
        @forelse($porTamanho as $tam => $qtd)
            <div class="totais-box">
                <div class="num">{{ $qtd }}</div>
                <div class="lbl">{{ $tam }}</div>
            </div>
        @empty
            <span style="color: #999; font-size: 10px;">Nenhum participante.</span>
        @endforelse
    </div>

    <div style="margin-bottom: 12px;">
        <span style="font-size: 10px; font-weight: bold; color: #555; display: block; margin-bottom: 4px;">POR MODELO:</span>
        @forelse($porModelo as $mod => $qtd)
            <div class="totais-box">
                <div class="num">{{ $qtd }}</div>
                <div class="lbl">{{ $mod }}</div>
            </div>
        @empty
            <span style="color: #999; font-size: 10px;">Nenhum participante.</span>
        @endforelse
    </div>

    <!-- Lista Completa de Produção / Participantes -->
    <div class="section-title">Lista de Separação / Participantes ({{ count($listaNomesNumeros) }})</div>
    <table class="tabela">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">Nome Completo</th>
                <th style="width: 18%;">Modelo</th>
                <th style="width: 10%;">Cor</th>
                <th style="width: 8%; text-align: center;">Tam</th>
                <th style="width: 6%; text-align: center;">Qtd</th>
                <th style="width: 15%;">Nome na Camisa</th>
                <th style="width: 13%; text-align: center;">Nº Camisa</th>
            </tr>
        </thead>
        <tbody>
            @forelse($listaNomesNumeros as $idx => $p)
                <tr>
                    <td style="text-align: center; color: #71717a;">{{ $idx + 1 }}</td>
                    <td>
                        <strong>{{ $p['nome_completo'] }}</strong>
                        @if(!empty($p['observacao']))
                            <div style="font-size: 8.5px; color: #71717a; font-style: italic;">Obs: {{ $p['observacao'] }}</div>
                        @endif
                        @if(!empty($p['apelido']))
                            <div style="font-size: 8.5px; color: #555;">Apelido: {{ $p['apelido'] }}</div>
                        @endif
                        @if(!empty($p['frase_costas']))
                            <div style="font-size: 8.5px; color: #555;">Frase: {{ $p['frase_costas'] }}</div>
                        @endif
                    </td>
                    <td>{{ $p['modelo'] }}</td>
                    <td>{{ $p['cor'] }}</td>
                    <td style="text-align: center; font-weight: bold;">{{ $p['tamanho'] }}</td>
                    <td style="text-align: center; font-weight: bold;">{{ $p['quantidade'] }}</td>
                    <td>{{ $p['nome_camisa'] ?: '—' }}</td>
                    <td style="text-align: center;">
                        @if(!empty($p['numero_camisa']))
                            <span class="{{ $p['numero_duplicado'] ? 'badge badge-duplicado' : '' }}">
                                {{ $p['numero_camisa'] }}
                                @if($p['numero_duplicado'])
                                    (duplicado)
                                @endif
                            </span>
                        @else
                            —
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="8" style="text-align: center; padding: 20px; color: #888;">
                        Nenhum participante preencheu este grupo até o momento.
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Camisas Design — Sistema de Gestão de Grupos e Produção de Camisetas Personalizadas
    </div>

</body>
</html>

