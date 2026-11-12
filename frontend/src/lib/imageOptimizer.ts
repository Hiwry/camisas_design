/**
 * Otimiza imagens rasterizadas (PNG, JPG, WEBP, etc.) antes do upload.
 * Reduz prints/screenshots gigantes de área de transferência (ex: 8MB para ~200KB)
 * mantendo alta nitidez e resolução.
 * Arquivos não-imagem ou vetores (SVG, PDF, CDR, AI, PSD, etc.) são retornados intactos.
 */
export async function otimizarImagemUpload(
  file: File,
  maxDim = 2048,
  quality = 0.85
): Promise<File> {
  // Ignora vetores ou arquivos que não são imagens raster
  if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('icon')) {
    return file
  }

  // Se o arquivo já for leve (< 500 KB), não precisa reprocessar
  if (file.size < 500 * 1024) {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve(file)
        return
      }

      // Preenche fundo branco caso seja print ou PNG transparente
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      const outputType = 'image/jpeg'
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file)
            return
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '')
          const optimizedFile = new File([blob], `${baseName}.jpg`, {
            type: outputType,
            lastModified: Date.now(),
          })
          resolve(optimizedFile)
        },
        outputType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}
