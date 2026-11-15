export type RotMode = 'none' | '180' | '360'

export interface NestItem {
  id: number
  name: string
  url: string
  img: HTMLImageElement          // PNG original (usado na exportação em alta qualidade)
  src: HTMLCanvasElement         // versão reduzida (máscaras e prévia)
  proc: HTMLCanvasElement | null // src com fundo branco removido, se pedido
  frac: number                   // fração opaca da imagem
  bbW: number                    // fração da largura ocupada pelo conteúdo
  bbH: number
  widthCm: number
  qty: number
  rot: RotMode
  noDpi: boolean
}

export interface NestCfg {
  roll: number     // largura do rolo (cm)
  margin: number   // margem nas bordas (cm)
  gap: number      // espaço entre peças (cm)
  cell: number     // tamanho da célula do encaixe (mm)
  time: number     // tempo de busca (s)
  step: number     // passo do giro em 360° (graus)
  ignWhite: boolean
}

export interface Placement {
  it: NestItem
  angle: number
  cx: number // centro da peça (cm, dentro da área útil)
  cy: number
}

export interface NestResult {
  pl: Placement[]
  lenCm: number
  cfg: NestCfg
}

export interface MaskRot {
  angle: number
  wm: number
  hm: number
  data: Uint8Array
  ox: number
  oy: number
}
