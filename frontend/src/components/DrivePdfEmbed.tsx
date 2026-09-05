import { driveEmbedUrl } from '@/utils/videoEmbed'
import { FileText, ExternalLink } from 'lucide-react'

interface DrivePdfEmbedProps {
  url: string
  title?: string
}

/**
 * Renders a Google Drive PDF inline using the /preview endpoint.
 * Works with URLs like:
 *   https://drive.google.com/file/d/{id}/view
 *   https://drive.google.com/open?id={id}
 *   https://drive.google.com/file/d/{id}/preview
 */
export function DrivePdfEmbed({ url, title }: DrivePdfEmbedProps) {
  const embedUrl = driveEmbedUrl(url)

  if (!embedUrl) return null

  return (
    <div className="w-full rounded-lg overflow-hidden border border-navy-700 bg-navy-900">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-navy-800 border-b border-navy-700">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-red-400" />
          <span className="text-sm text-navy-200 font-medium truncate max-w-xs">
            {title || 'PDF Document'}
          </span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          Open <ExternalLink size={12} />
        </a>
      </div>

      {/* PDF viewer iframe */}
      <div className="w-full" style={{ minHeight: '600px' }}>
        <iframe
          src={embedUrl}
          title={title || 'PDF Document'}
          className="w-full border-0"
          style={{ height: '600px' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        />
      </div>
    </div>
  )
}
