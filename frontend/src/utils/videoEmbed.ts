export interface VideoLink {
  provider: 'youtube' | 'gdrive'
  file_id: string
}

/**
 * Google Drive links work for both videos AND PDFs.
 * The /preview endpoint renders an inline preview for any file type.
 */
export function parseVideoUrl(url: string): VideoLink | null {
  try {
    const u = new URL(url.trim())
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let id = ''
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1)
      else if (u.pathname === '/watch') id = u.searchParams.get('v') || ''
      else if (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || ''
      return id ? { provider: 'youtube', file_id: id } : null
    }
    if (u.hostname.includes('drive.google.com')) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/)
      const id = m ? m[1] : (u.searchParams.get('id') || '')
      return id ? { provider: 'gdrive', file_id: id } : null
    }
    return null
  } catch {
    return null
  }
}

export function videoEmbedUrl(url: string): string | null {
  const parsed = parseVideoUrl(url)
  if (!parsed) return null
  return parsed.provider === 'youtube'
    ? `https://www.youtube.com/embed/${parsed.file_id}`
    : `https://drive.google.com/file/d/${parsed.file_id}/preview`
}

/**
 * Check if a URL is a Google Drive link (video or PDF).
 * Google Drive's /preview endpoint renders both inline.
 */
export function isGoogleDriveUrl(url: string): boolean {
  return parseVideoUrl(url)?.provider === 'gdrive'
}

/**
 * Check if a URL is any embeddable video (YouTube or Google Drive).
 */
export function isEmbeddableVideo(url: string): boolean {
  return parseVideoUrl(url) !== null
}

/**
 * For Google Drive links, return the /preview embed URL
 * which works for both videos and PDFs.
 */
export function driveEmbedUrl(url: string): string | null {
  const parsed = parseVideoUrl(url)
  if (!parsed || parsed.provider !== 'gdrive') return null
  return `https://drive.google.com/file/d/${parsed.file_id}/preview`
}