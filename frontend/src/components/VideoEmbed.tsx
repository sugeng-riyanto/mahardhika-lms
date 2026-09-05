import { videoEmbedUrl } from '@/utils/videoEmbed'

interface VideoEmbedProps {
  url: string
  title?: string
}

export function VideoEmbed({ url, title }: VideoEmbedProps) {
  const embedUrl = videoEmbedUrl(url)
  if (!embedUrl) return null
  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black border border-navy-700">
      <iframe
        src={embedUrl}
        title={title || 'Video'}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}