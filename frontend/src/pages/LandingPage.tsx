import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Zap,
  Clock,
  Smartphone,
  Palette,
  Layers,
  Bot,
  Star,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  ExternalLink,
  MessageCircle,
  TrendingUp,
  Award,
  Shirt,
  Users,
} from 'lucide-react'

// Número de WhatsApp para contato direto
const WHATSAPP_LINK =
  'https://wa.me/558187624556?text=Ol%C3%A1!%20Gostaria%20de%20conhecer%20os%20planos%20e%20artes%20da%20Camiseta%20Design'

const SERVICOS = [
  {
    icon: Shirt,
    titulo: 'Sublimação Total',
    tag: 'Fardamentos Esportivos',
    desc: 'Uniformes completos de futebol, futsal, basquete, corrida e eSports com encaixes anatômicos e padrões 4K.',
    cor: '#d4a020',
  },
  {
    icon: Users,
    titulo: 'Interclasses & Terceirão',
    tag: 'Linha Escolar & Torcidas',
    desc: 'Camisetas personalizadas com mascotes vetoriais exclusivos, tipografia estilizada e nomes individuais.',
    cor: '#3b82f6',
  },
  {
    icon: Palette,
    titulo: 'Streetwear & Silk-Screen',
    tag: 'Moda & Autorais',
    desc: 'Criação de estampas com separação de cores para serigrafia, relevo 3D, cromia e simulação de tecido.',
    cor: '#ec4899',
  },
  {
    icon: Layers,
    titulo: 'Bordados & Corporativo',
    tag: 'Empresas & Uniformes',
    desc: 'Polos dry piquet, jalecos, jaquetas e bonés com matrizes de alta definição prontas para máquinas eletrônicas.',
    cor: '#10b981',
  },
  {
    icon: Sparkles,
    titulo: 'Vetorização Expressa',
    tag: 'Recriação Técnica',
    desc: 'Transformação de prints e fotos de logos antigos em arquivos vetoriais escaláveis e perfeitos (AI, CDR, PDF).',
    cor: '#8b5cf6',
  },
  {
    icon: Bot,
    titulo: 'Revisão com Inteligência Artificial',
    tag: 'Tecnologia Exclusiva',
    desc: 'Conferência automática por IA que compara a arte com a referência antes de ir para a impressora ou corte.',
    cor: '#f59e0b',
  },
]

const PLANOS = [
  {
    nome: 'START',
    sub: 'Para confecções e designers com demanda pontual',
    valor: '299',
    periodo: '/mês',
    artes: 'Até 10 artes no mês',
    sla: 'Entrega em até 48h úteis',
    destaque: false,
    badge: 'Início Rápido',
    itens: [
      '10 artes de camisetas ou fardamentos',
      'Painel Kanban visual de pedidos',
      'Link público de aprovação pelo celular',
      'Revisões inclusas até aprovação final',
      'Arquivos em PDF, CDR e PNG em alta',
      'Créditos para análise com IA',
    ],
  },
  {
    nome: 'PRO',
    sub: 'O mais escolhido por confecções de alto padrão',
    valor: '499',
    periodo: '/mês',
    artes: 'Até 20 artes no mês',
    sla: 'Entrega rápida em até 24h',
    destaque: true,
    badge: 'Mais Popular ⭐',
    itens: [
      '20 artes completas no mês',
      'Prioridade na fila de desenvolvimento',
      'SLA acelerado em 24h úteis',
      'Notificações em tempo real no WhatsApp',
      'Revisões ilimitadas com designer sênior',
      'Vetorização de logos simples inclusa',
      'Pacote extra de créditos de IA',
      'Suporte prioritário via WhatsApp',
    ],
  },
  {
    nome: 'VIP',
    sub: 'Para grandes confecções com grande volume diário',
    valor: '799',
    periodo: '/mês',
    artes: 'Até 35 artes no mês',
    sla: 'Entrega ultra expressa em até 12h',
    destaque: false,
    badge: 'Demanda Máxima',
    itens: [
      '35 artes completas por mês',
      'Fila de produção ultra prioritária (12h)',
      'Designers dedicados à sua confecção',
      'Mockups 3D ultrarrealistas inclusos',
      'Vetorização avançada de emblemas e marcas',
      'Canal VIP direto com diretor de arte',
      'Todas as novidades e templates antecipados',
    ],
  },
]

const DEPOIMENTOS = [
  {
    nome: 'Marcos Vinicius',
    empresa: 'SportWear Confecções — SP',
    texto:
      'Antes nós perdíamos dias inteiros esperando arte e os clientes ficavam cancelando pedidos. Com a Camiseta Design, meu cliente aprova no mesmo dia direto pelo celular. Reduzi o tempo de pré-produção em 70%!',
    rating: 5,
  },
  {
    nome: 'Juliana Castro',
    empresa: 'Elite Fardamentos — MG',
    texto:
      'O sistema de aprovação pública sem cadastro é genial. Eu mando o link pro diretor da atlética e ele mesmo confere tudo, escolhe se quer ajuste ou aprova. O revisor de IA já evitou que a gente errasse patrocinador!',
    rating: 5,
  },
  {
    nome: 'Rodrigo Medeiros',
    empresa: 'Impacto Sublimação — PE',
    texto:
      'A qualidade dos mockups e a separação dos arquivos vetorizados é impecável. O arquivo chega pronto pra estampar na impressora sublimática. Vale cada centavo do plano PRO.',
    rating: 5,
  },
]

const FAQS = [
  {
    pergunta: 'Como funciona a contratação e entrega das artes?',
    resposta:
      'Ao assinar um dos planos, você ganha acesso imediato ao painel. Você cadastra o pedido com as referências, nossa equipe cria a arte no prazo do seu plano e você recebe o mockup com link pronto para enviar ao cliente.',
  },
  {
    pergunta: 'Meu cliente precisa criar conta para aprovar a arte?',
    resposta:
      'Não! O link de aprovação é 100% público e protegido por token único. O seu cliente abre no celular, vê os detalhes da camiseta em alta definição e clica em "Aprovar Arte" ou solicita ajustes com comentários.',
  },
  {
    pergunta: 'Em quais formatos recebo os arquivos finais?',
    resposta:
      'Entregamos os arquivos prontos para a produção na confecção: CorelDRAW (CDR), Adobe Illustrator (AI), PDF Vetorial de alta precisão e imagens em PNG 300 DPI.',
  },
  {
    pergunta: 'E se eu precisar de mais artes além do meu plano mensal?',
    resposta:
      'Você pode comprar pacotes de artes avulsas extras a qualquer momento diretamente pelo seu painel no Shop Avulso com liberação imediata de créditos!',
  },
  {
    pergunta: 'Como funciona o Bot do WhatsApp?',
    resposta:
      'Nosso bot inteligente fica conectado ao sistema e avisa você ou seus clientes quando uma arte fica pronta, quando o cliente aprova ou quando há pedidos com prazo próximo de vencer.',
  },
]

export default function LandingPage() {
  const { user, token } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 font-sans selection:bg-[#d4a020] selection:text-black">

      {/* ── BACKGROUND GLOWS ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full blur-[140px] opacity-25"
          style={{ background: 'radial-gradient(circle, #d4a020 0%, #ff6b00 35%, transparent 70%)' }}
        />
        <div
          className="absolute top-[40%] -right-40 w-[600px] h-[600px] rounded-full blur-[160px] opacity-15"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, #8b5cf6 50%, transparent 80%)' }}
        />
        <div
          className="absolute bottom-20 -left-40 w-[500px] h-[500px] rounded-full blur-[140px] opacity-15"
          style={{ background: 'radial-gradient(circle, #10b981 0%, #059669 50%, transparent 80%)' }}
        />
      </div>

      {/* ── HEADER / NAVBAR ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070708]/80 border-b border-zinc-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img
                src="/logo.svg"
                alt="Camiseta Design"
                className="h-9 w-auto transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const img = e.currentTarget
                  img.onerror = null
                  img.src = '/logo.png'
                }}
              />
            </div>
            <div className="hidden sm:block">
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                Camiseta <span className="text-[#d4a020]">Design</span>
              </span>
              <span className="text-[10px] tracking-widest text-zinc-500 uppercase block font-semibold -mt-1">
                DesignFlow Platform
              </span>
            </div>
          </Link>

          {/* Links Desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#como-funciona" className="hover:text-white transition-colors">
              Como Funciona
            </a>
            <a href="#servicos" className="hover:text-white transition-colors">
              Especialidades
            </a>
            <Link to="/portfolio" className="hover:text-[#d4a020] transition-colors flex items-center gap-1">
              Portfólio <span className="text-[10px] bg-[#d4a020]/20 text-[#d4a020] px-1.5 py-0.5 rounded font-bold">2026</span>
            </Link>
            <a href="#planos" className="hover:text-white transition-colors">
              Planos & Preços
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              Dúvidas
            </a>
          </nav>

          {/* Ações / CTA */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>

            {token && user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black transition-all transform hover:scale-[1.02] shadow-[0_0_20px_rgba(212,160,32,0.3)]"
                style={{ background: 'linear-gradient(135deg, #d4a020, #e8b430)' }}
              >
                <span>Acessar Painel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black transition-all transform hover:scale-[1.02] shadow-[0_0_20px_rgba(212,160,32,0.3)]"
                style={{ background: 'linear-gradient(135deg, #d4a020, #e8b430)' }}
              >
                <span>Entrar na Conta</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Botão Menu Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Menu Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-800 bg-[#0e0e11] px-5 py-6 space-y-4 animate-in slide-in-from-top-2">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-zinc-300">
              <a
                href="#como-funciona"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-[#d4a020]"
              >
                Como Funciona
              </a>
              <a
                href="#servicos"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-[#d4a020]"
              >
                Especialidades
              </a>
              <Link
                to="/portfolio"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-[#d4a020] flex items-center justify-between"
              >
                <span>Portfólio / Catálogo</span>
                <span className="text-[10px] bg-[#d4a020]/20 text-[#d4a020] px-2 py-0.5 rounded font-bold">Novo</span>
              </Link>
              <a
                href="#planos"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-[#d4a020]"
              >
                Planos & Preços
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-[#d4a020]"
              >
                Perguntas Frequentes
              </a>
            </nav>

            <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2.5">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25"
              >
                <MessageCircle className="w-4 h-4" />
                Falar no WhatsApp
              </a>

              <Link
                to={token ? '/dashboard' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #d4a020, #e8b430)' }}
              >
                {token ? 'Ir para o Painel' : 'Entrar no Sistema'}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative z-10 pt-16 pb-24 lg:pt-28 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Texto Hero (7 colunas) */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">

              {/* Tag de Destaque */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#d4a020]/30 bg-[#d4a020]/10 text-[#d4a020] text-xs font-semibold shadow-inner">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#d4a020]" />
                <span>O ecossistema definitivo para Confecções e Designers</span>
              </div>

              {/* Headline Principal */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
                Artes Profissionais para Camisetas com{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4a020] via-[#f7cb59] to-[#ffffff]">
                  Aprovação em 1 Clique e IA.
                </span>
              </h1>

              {/* Descrição */}
              <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Elimine atrasos e retrabalho na sua confecção. Receba artes de fardamentos esportivos,
                sublimação e moda vetorizadas em alta precisão — e envie links interativos para o seu cliente
                aprovar direto pelo celular sem complicação.
              </p>

              {/* CTAs de Ação */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <a
                  href="#planos"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm text-black transition-all transform hover:-translate-y-0.5 shadow-[0_10px_30px_rgba(212,160,32,0.35)]"
                  style={{ background: 'linear-gradient(135deg, #d4a020, #e8b430)' }}
                >
                  <span>Ver Planos & Contratar</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <Link
                  to="/portfolio"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-zinc-300 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:text-white transition-all hover:bg-zinc-800/60"
                >
                  <Palette className="w-4 h-4 text-[#d4a020]" />
                  <span>Explorar Catálogo 2026</span>
                </Link>
              </div>

              {/* Micro-prova social */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-zinc-500 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Entrega em até 12h/24h</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Arquivos CDR, AI e PDF</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Sem fidelidade obrigatória</span>
                </div>
              </div>

            </div>

            {/* Visual Hero Mockup Interativo (5 colunas) */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-sm lg:max-w-none">

                {/* Efeito Glow atrás do card */}
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#d4a020]/40 to-amber-500/20 blur-xl opacity-70 group-hover:opacity-100 transition duration-1000" />

                {/* Card do Mockup estilo Mobile Aprovação */}
                <div className="relative rounded-2xl bg-[#111114] border border-zinc-800/90 p-5 shadow-2xl space-y-4">

                  {/* Header do Mockup */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#d4a020]/15 flex items-center justify-center text-[#d4a020] font-black text-xs">
                        CD
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">Pedido #1042 — Fênix Imperatriz</p>
                        <p className="text-[10px] text-zinc-500">Aprovação de Uniforme Titular</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Aguardando
                    </span>
                  </div>

                  {/* Imagem de Camiseta em Mockup */}
                  <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-zinc-950 border border-zinc-800/80 group">
                    <img
                      src="/portfolio/brasiliense_main.jpg"
                      alt="Prévia de Uniforme"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?auto=format&fit=crop&w=800&q=80'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-zinc-300">
                      <span className="font-semibold text-white">Sublimação Total 4K</span>
                      <span className="text-xs font-bold text-[#d4a020]">Dry-Fit UV50+</span>
                    </div>
                  </div>

                  {/* Mini-detalhes de especificações */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] py-1">
                    <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-zinc-500 block">Cores</span>
                      <span className="font-bold text-zinc-200">Preto & Ouro</span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-zinc-500 block">Gola</span>
                      <span className="font-bold text-zinc-200">V Transpassada</span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-zinc-500 block">SLA</span>
                      <span className="font-bold text-emerald-400">Pronta em 18h</span>
                    </div>
                  </div>

                  {/* Botões de Ação da Aprovação do Cliente */}
                  <div className="pt-1 space-y-2">
                    <button
                      type="button"
                      className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(16,185,129,0.3)]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprovar Arte Sem Alterações</span>
                    </button>
                    <button
                      type="button"
                      className="w-full py-2 rounded-xl font-semibold text-[11px] text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    >
                      Solicitar Ajuste ou Troca de Nome
                    </button>
                  </div>

                  {/* Notificação flutuante de WhatsApp */}
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <MessageCircle className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[10px] text-emerald-300 leading-tight">
                      <strong>WhatsApp Bot:</strong> Notificação enviada para o cliente com link de aprovação direta!
                    </p>
                  </div>

                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── NÚMEROS / MÉTRICAS ── */}
      <section className="relative z-10 border-y border-zinc-800/80 bg-[#0b0b0e]/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#d4a020]">+10.000</p>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">Artes Desenvolvidas</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-white">12 Horas</p>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">SLA Mínimo de Entrega</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400">99.4%</p>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">Aprovação de Primeira</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#d4a020]">100% Celular</p>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">Aprovação sem Login</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA (4 PASSOS) ── */}
      <section id="como-funciona" className="relative z-10 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Título da Seção */}
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold tracking-widest text-[#d4a020] uppercase">
              Fluxo Inteligente e Rápido
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Como funciona o ciclo de criação das suas artes
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Do envio da referência pelo WhatsApp ou painel até o arquivo pronto para estampar.
            </p>
          </div>

          {/* 4 Cards de Passo a Passo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                titulo: 'Envie a Ideia',
                desc: 'Mande uma foto, print da internet ou áudio com as orientações do seu cliente pelo painel ou WhatsApp.',
                badge: 'Entrada Fácil',
              },
              {
                num: '02',
                titulo: 'Criação & IA',
                desc: 'Nossos designers sêniores criam a arte e a inteligência artificial audita nomes, números e patrocinadores.',
                badge: 'Design Profissional',
              },
              {
                num: '03',
                titulo: 'Cliente Aprova',
                desc: 'Um link interativo exclusivo é enviado ao cliente para ele aprovar ou solicitar ajustes sem login.',
                badge: 'Sem Burocracia',
              },
              {
                num: '04',
                titulo: 'Arquivos Prontos',
                desc: 'Assim que aprovado, os vetores finais (CDR, AI, PDF) ficam disponíveis para imprimir e costurar.',
                badge: 'Produção Liberada',
              },
            ].map((p, i) => (
              <div
                key={i}
                className="relative rounded-2xl bg-[#111114] border border-zinc-800/80 p-6 space-y-4 hover:border-[#d4a020]/40 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-zinc-800 group-hover:text-[#d4a020]/40 transition-colors">
                    {p.num}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300">
                    {p.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-[#d4a020] transition-colors">
                  {p.titulo}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── ESPECIALIDADES / SERVIÇOS ── */}
      <section id="servicos" className="relative z-10 py-20 bg-[#09090c] border-y border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold tracking-widest text-[#d4a020] uppercase">
              O que criamos para você
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Especialistas em todas as linhas de confecção
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Não importa a técnica da sua estamparia: entregamos o arquivo técnico exato para sua máquina.
            </p>
          </div>

          {/* Grid de Serviços */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICOS.map((s, i) => {
              const Icon = s.icon
              return (
                <div
                  key={i}
                  className="rounded-2xl bg-[#111114] border border-zinc-800/80 p-6 space-y-4 hover:border-zinc-700 transition-all hover:bg-[#141418]"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${s.cor}15`, border: `1px solid ${s.cor}30` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: s.cor }} />
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                      {s.tag}
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">{s.titulo}</h3>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Botão Ver Catálogo */}
          <div className="mt-12 text-center">
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all"
            >
              <span>Ver Fotos e Detalhes dos Fardamentos no Catálogo</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#d4a020]" />
            </Link>
          </div>

        </div>
      </section>

      {/* ── PLANOS & PREÇOS ── */}
      <section id="planos" className="relative z-10 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold tracking-widest text-[#d4a020] uppercase">
              Investimento Inteligente
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Planos mensais para acelerar o seu faturamento
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Menos do que o custo de um estagiário e com a agilidade de um time sênior à sua disposição.
            </p>
          </div>

          {/* Grid de Planos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {PLANOS.map((plano, i) => (
              <div
                key={i}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all ${
                  plano.destaque
                    ? 'bg-[#15151a] border-2 border-[#d4a020] shadow-[0_0_40px_rgba(212,160,32,0.18)] lg:-translate-y-2'
                    : 'bg-[#111114] border border-zinc-800'
                }`}
              >
                {/* Badge Destaque */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                      plano.destaque
                        ? 'bg-[#d4a020] text-black font-extrabold shadow-sm'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {plano.badge}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#d4a020]" />
                    {plano.sla}
                  </span>
                </div>

                {/* Preço e Info */}
                <div className="space-y-3 mb-6">
                  <h3 className="text-2xl font-black text-white">{plano.nome}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">
                    {plano.sub}
                  </p>

                  <div className="pt-2 flex items-baseline gap-1">
                    <span className="text-xs text-zinc-400">R$</span>
                    <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                      {plano.valor}
                    </span>
                    <span className="text-xs text-zinc-400">{plano.periodo}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                    <span className="text-xs font-bold text-[#d4a020]">{plano.artes}</span>
                  </div>
                </div>

                {/* Lista de Recursos */}
                <div className="space-y-3 border-t border-zinc-800/80 pt-6 mb-8 flex-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    O que está incluso:
                  </p>
                  {plano.itens.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {/* Botão de Contratação */}
                <a
                  href={`${WHATSAPP_LINK}%20-%20Plano%20${plano.nome}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full py-3.5 rounded-xl font-bold text-xs text-center transition-all flex items-center justify-center gap-2 ${
                    plano.destaque
                      ? 'text-black shadow-[0_0_20px_rgba(212,160,32,0.3)] hover:opacity-95'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                  style={plano.destaque ? { background: 'linear-gradient(135deg, #d4a020, #e8b430)' } : {}}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Assinar Plano {plano.nome}</span>
                </a>
              </div>
            ))}
          </div>

          {/* Aviso sobre compras avulsas */}
          <div className="mt-12 text-center p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-bold text-white flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-[#d4a020]" />
              Precisa apenas de uma arte avulsa ou vetorização de logotipo?
            </p>
            <p className="text-xs text-zinc-400">
              Você pode contratar serviços avulsos a partir de R$ 35,00 sem mensalidade fixa.
            </p>
          </div>

        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="relative z-10 py-20 bg-[#09090c] border-y border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <span className="text-xs font-bold tracking-widest text-[#d4a020] uppercase">
              Depoimentos Reais
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Quem usa e confia na Camiseta Design
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEPOIMENTOS.map((d, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#111114] border border-zinc-800/80 p-6 flex flex-col justify-between space-y-4"
              >
                {/* Estrelas */}
                <div className="flex items-center gap-1 text-[#d4a020]">
                  {[...Array(d.rating)].map((_, s) => (
                    <Star key={s} className="w-4 h-4 fill-current" />
                  ))}
                </div>

                <p className="text-xs text-zinc-300 italic leading-relaxed">
                  "{d.texto}"
                </p>

                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-xs font-bold text-white">{d.nome}</p>
                  <p className="text-[10px] text-zinc-500">{d.empresa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ACCORDION ── */}
      <section id="faq" className="relative z-10 py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-14">
            <span className="text-xs font-bold tracking-widest text-[#d4a020] uppercase">
              Tire Suas Dúvidas
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <div
                  key={i}
                  className="rounded-xl bg-[#111114] border border-zinc-800/80 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-white hover:text-[#d4a020] transition-colors"
                  >
                    <span>{faq.pergunta}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#d4a020] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3">
                      {faq.resposta}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative z-10 py-20 bg-gradient-to-b from-[#111114] to-[#070708] border-t border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex p-3 rounded-2xl bg-[#d4a020]/10 border border-[#d4a020]/25 text-[#d4a020]">
            <Award className="w-8 h-8" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-2xl mx-auto leading-tight">
            Pronto para colocar a sua confecção em outro patamar?
          </h2>

          <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
            Comece hoje mesmo. Sem burocracia, com aprovação rápida e arquivos prontos para você faturar mais.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-bold text-sm text-black transition-all transform hover:scale-[1.02] shadow-[0_10px_30px_rgba(212,160,32,0.3)]"
              style={{ background: 'linear-gradient(135deg, #d4a020, #e8b430)' }}
            >
              <MessageCircle className="w-5 h-5" />
              <span>Chamar no WhatsApp Agora</span>
            </a>

            <Link
              to={token ? '/dashboard' : '/login'}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm text-white bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 transition-all"
            >
              <span>{token ? 'Ir para o Meu Painel' : 'Acessar Área do Cliente'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-zinc-900 bg-[#050506] py-12 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Camiseta Design" className="h-7 w-auto" onError={(e) => { e.currentTarget.src = '/logo.png' }} />
            <div>
              <p className="font-bold text-zinc-300">Camiseta Design</p>
              <p className="text-[10px] text-zinc-600">DesignFlow — Gestão de Artes & Produção</p>
            </div>
          </div>

          {/* Links Rodapé */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400">
            <Link to="/portfolio" className="hover:text-white transition-colors">Portfólio</Link>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <Link to="/login" className="hover:text-[#d4a020] transition-colors">Login</Link>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">Suporte WhatsApp</a>
          </div>

          {/* Copyright */}
          <p className="text-zinc-600 text-center md:text-right">
            © {new Date().getFullYear()} Camiseta Design. Todos os direitos reservados.
          </p>

        </div>
      </footer>

    </div>
  )
}
