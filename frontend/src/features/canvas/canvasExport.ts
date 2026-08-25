/**
 * Canvas export utilities — PNG and PDF.
 *
 * PNG: Uses canvas.toBlob() for high-quality raster export.
 * PDF: Generates a minimal valid PDF with the canvas image embedded.
 *      No external library required — builds raw PDF syntax.
 */

/**
 * Export the canvas as a PNG file and trigger download.
 */
export function exportCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename = 'akademi-canvas.png',
): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate PNG blob'))
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        resolve()
      },
      'image/png',
      1.0, // Maximum quality
    )
  })
}

/**
 * Export the canvas as a PDF file and trigger download.
 *
 * Generates a single-page PDF with the canvas image embedded as a JPEG.
 * The PDF is A4-landscape by default, scaled to fit the canvas aspect ratio.
 */
export function exportCanvasAsPdf(
  canvas: HTMLCanvasElement,
  filename = 'akademi-canvas.pdf',
): Promise<void> {
  return new Promise((resolve, _reject) => {
    // Get JPEG data URL from canvas (better compression for PDF)
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const jpegBase64 = jpegDataUrl.split(',')[1]

    // Decode base64 to binary
    const binaryStr = atob(jpegBase64)
    const jpegBytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      jpegBytes[i] = binaryStr.charCodeAt(i)
    }

    // Calculate page size — use canvas aspect ratio, scaled to fit A4
    const canvasAspect = canvas.width / canvas.height
    // A4 in points: 595 x 842
    const pageWidth = 595
    const pageHeight = 842
    const margin = 40

    const maxWidth = pageWidth - 2 * margin
    const maxHeight = pageHeight - 2 * margin - 40 // 40pt for header

    let imgWidth: number
    let imgHeight: number
    if (canvasAspect > maxWidth / maxHeight) {
      imgWidth = maxWidth
      imgHeight = maxWidth / canvasAspect
    } else {
      imgHeight = maxHeight
      imgWidth = maxHeight * canvasAspect
    }

    const imgX = (pageWidth - imgWidth) / 2
    const imgY = pageHeight - margin - imgHeight // PDF Y is from bottom

    // Build minimal PDF
    const pdf = buildPdf({
      pageWidth,
      pageHeight,
      jpegBytes,
      imgX,
      imgY,
      imgWidth,
      imgHeight,
      title: filename.replace('.pdf', ''),
    })

    // Trigger download
    const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    resolve()
  })
}

interface PdfOptions {
  pageWidth: number
  pageHeight: number
  jpegBytes: Uint8Array
  imgX: number
  imgY: number
  imgWidth: number
  imgHeight: number
  title: string
}

/**
 * Build a minimal valid PDF file with a single page containing the image.
 */
function buildPdf(opts: PdfOptions): Uint8Array {
  const encoder = new TextEncoder()
  const parts: (Uint8Array | string)[] = []

  function add(str: string) {
    parts.push(str)
  }

  function addBytes(bytes: Uint8Array) {
    parts.push(bytes)
  }

  // PDF Header
  add('%PDF-1.4\n')

  // Object 1: Catalog
  const obj1Offset = getTotalSize(parts)
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  // Object 2: Pages
  const obj2Offset = getTotalSize(parts)
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  // Object 3: Page
  const obj3Offset = getTotalSize(parts)
  add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${opts.pageWidth} ${opts.pageHeight}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`)

  // Object 4: Content stream
  const contentStream = `q\n${opts.imgWidth} 0 0 ${opts.imgHeight} ${opts.imgX} ${opts.imgY} cm\n/Img Do\nQ\n`
  const contentBytes = encoder.encode(contentStream)
  const obj4Offset = getTotalSize(parts)
  add(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`)
  addBytes(contentBytes)
  add('\nendstream\nendobj\n')

  // Object 5: Image XObject (JPEG)
  const obj5Offset = getTotalSize(parts)
  add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${opts.pageWidth} /Height ${opts.pageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${opts.jpegBytes.length} >>\nstream\n`)
  addBytes(opts.jpegBytes)
  add('\nendstream\nendobj\n')

  // Cross-reference table
  const xrefOffset = getTotalSize(parts)
  add('xref\n')
  add('0 6\n')
  add('0000000000 65535 f \n')
  add(`${String(obj1Offset).padStart(10, '0')} 00000 n \n`)
  add(`${String(obj2Offset).padStart(10, '0')} 00000 n \n`)
  add(`${String(obj3Offset).padStart(10, '0')} 00000 n \n`)
  add(`${String(obj4Offset).padStart(10, '0')} 00000 n \n`)
  add(`${String(obj5Offset).padStart(10, '0')} 00000 n \n`)

  // Trailer
  add('trailer\n<< /Size 6 /Root 1 0 R >>\n')
  add(`startxref\n${xrefOffset}\n`)
  add('%%EOF\n')

  // Combine all parts into a single Uint8Array
  const totalLen = getTotalSize(parts)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const part of parts) {
    if (typeof part === 'string') {
      const bytes = encoder.encode(part)
      result.set(bytes, offset)
      offset += bytes.length
    } else {
      result.set(part, offset)
      offset += part.length
    }
  }

  return result
}

function getTotalSize(parts: (Uint8Array | string)[]): number {
  const encoder = new TextEncoder()
  let total = 0
  for (const part of parts) {
    total += typeof part === 'string' ? encoder.encode(part).length : part.length
  }
  return total
}
