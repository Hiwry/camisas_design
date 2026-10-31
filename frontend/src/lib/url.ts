/**
 * Normaliza e resolve URLs de mídia/storage enviadas pelo backend.
 * Suporta URLs absolutas com hosts locais/desatualizados,
 * caminhos relativos (/storage/...) e URLs externas (S3, Cloudflare R2, blobs, etc).
 */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url) return ''

  // Blobs locais do navegador e data URIs não devem ser alterados
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url
  }

  // URLs externas puras (ex: Cloudflare R2, AWS S3, Unsplash) que não sejam do storage local
  if (/^https?:\/\//i.test(url) && !url.includes('/storage/')) {
    return url
  }

  // Se contiver caminho para o storage do Laravel (/storage/...)
  if (url.includes('/storage/')) {
    const storagePath = url.substring(url.indexOf('/storage/'))

    // 1. Se VITE_API_URL tiver um origin absoluto explícito configurado (ex: http://localhost:8000/api)
    const viteApi = import.meta.env.VITE_API_URL
    if (viteApi && /^https?:\/\//i.test(viteApi)) {
      const origin = viteApi.replace(/\/api\/?$/, '')
      return `${origin}${storagePath}`
    }

    // 2. Se a URL gravada tiver http://localhost ou http://127.0.0.1 mas estivermos acessando por IP na rede ou domínio
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
      const currentHost = window.location.hostname
      if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        try {
          const parsed = new URL(url)
          parsed.hostname = currentHost
          return parsed.toString()
        } catch {
          // segue para fallback relativo
        }
      }
    }

    // 3. Retorna o caminho relativo que funcionará com o proxy do Vite ou Nginx/Apache em produção
    return storagePath
  }

  return url
}

