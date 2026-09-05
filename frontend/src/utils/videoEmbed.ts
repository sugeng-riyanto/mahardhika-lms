export interface VideoLink {
  provider: 'youtube' | 'gdrive'
  video_id: string
}

export function parseVideoUrl(url: string): VideoLink | null {
  try {
    const u = new URL(url.trim())
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let id = ''
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1)
      else if (u.pathname === '/watch') id = u.searchParams.get('v') || ''
      else if (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || ''
      return id ? { provider: 'youtube', video_id: id } : null
    }
    if (u.hostname.includes('drive.google.com')) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/)
      const id = m ? m[1] : (u.searchParams.get('id') || '')
      return id ? { provider: 'gdrive', video_id: id } : null
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
    ? `https://www.youtube.com/embed/${parsed.video_id}`
    : `https://drive.google.com/file/d/${parsed.video_id}/preview`
}