import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import KanbanPage from '@/pages/KanbanPage'
import PedidosPage from '@/pages/PedidosPage'
import PedidoDetalhe from '@/pages/PedidoDetalhe'
import ConfeccoesPage from '@/pages/ConfeccoesPage'
import AprovacaoPublica from '@/pages/AprovacaoPublica'
import RevisaoArtePage from '@/pages/RevisaoArtePage'
import WhatsAppPage from '@/pages/WhatsAppPage'
import ShopPage from '@/pages/ShopPage'
import GerenciarShopPage from '@/pages/GerenciarShopPage'
import PortfolioPage from '@/pages/PortfolioPage'
import Layout from '@/components/layout/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/pedidos" replace />
  return <>{children}</>
}

// Portfólio inteligente: abre público para visitantes e com layout para logados
function PortfolioRoute() {
  const token = useAuthStore((s) => s.token)
  if (token) {
    return (
      <Layout>
        <PortfolioPage />
      </Layout>
    )
  }
  return <PortfolioPage isPublic />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Rotas Públicas ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/inicio" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/aprovar/:token" element={<AprovacaoPublica />} />
        <Route path="/portfolio" element={<PortfolioRoute />} />
        <Route path="/catalogo" element={<PortfolioPage isPublic />} />

        {/* ── Rotas Privadas (Sistema com Sidebar) ── */}
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <DashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/kanban"
            element={
              <AdminRoute>
                <KanbanPage />
              </AdminRoute>
            }
          />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/pedidos/:id" element={<PedidoDetalhe />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/revisar-arte" element={<RevisaoArtePage />} />
          <Route
            path="/whatsapp"
            element={
              <AdminRoute>
                <WhatsAppPage />
              </AdminRoute>
            }
          />
          <Route
            path="/confeccoes"
            element={
              <AdminRoute>
                <ConfeccoesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/shop/produtos"
            element={
              <AdminRoute>
                <GerenciarShopPage />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
