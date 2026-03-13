/* ══════════════════════════════════════════
   AutoEstoque · imageCompressor.js
   Comprime imagens para WebP antes do upload
══════════════════════════════════════════ */

async function compressImageToWebP(file, opts = {}) {
  const {
    quality   = 0.80,
    maxWidth  = 1280,
    maxHeight = 960,
  } = opts

  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Arquivo inválido: precisa ser uma imagem.'))
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        let { width, height } = img

        // Redimensiona mantendo proporção
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width))
          width  = maxWidth
        }
        if (height > maxHeight) {
          width  = Math.round(width * (maxHeight / height))
          height = maxHeight
        }

        const canvas  = document.createElement('canvas')
        canvas.width  = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'  // fundo branco para PNGs transparentes
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Falha ao converter para WebP.'))

            const baseName = file.name.replace(/\.[^.]+$/, '')
            const fileName = `${baseName}_${Date.now()}.webp`
            const ratio    = ((1 - blob.size / file.size) * 100).toFixed(1)

            resolve({ blob, fileName, originalSize: file.size, compressedSize: blob.size, ratio: `${ratio}% menor` })
          },
          'image/webp',
          quality
        )
      }

      img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
      img.src = e.target.result
    }

    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}