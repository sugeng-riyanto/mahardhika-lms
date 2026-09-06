import { useRef, useState } from 'react'
import { Upload, FileText, X, Loader2, AlertCircle, ImageIcon } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export interface ExamPdfResult {
  pdfName: string
  pages: string[] // data URLs, page order
}

interface ExamPdfUploaderProps {
  pdfName: string
  pages: string[]
  onChange: (result: ExamPdfResult) => void
  onClear: () => void
}

const MAX_PAGE_WIDTH = 1400

export function ExamPdfUploader({ pdfName, pages, onChange, onClear }: ExamPdfUploaderProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const buffer = await file.arrayBuffer()
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise
      const rendered: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(2, MAX_PAGE_WIDTH / Math.max(base.width, 1))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas not supported')
        await page.render({ canvasContext: ctx, viewport }).promise
        rendered.push(canvas.toDataURL('image/jpeg', 0.72))
        page.cleanup()
      }
      onChange({ pdfName: file.name, pages: rendered })
    } catch (err) {
      setError(err instanceof Error ? `Failed to read PDF: ${err.message}` : 'Failed to read PDF')
    } finally {
      setBusy(false)
    }
  }

  if (pages.length > 0) {
    return (
      <div className="border border-navy-700 rounded-lg p-3 bg-navy-800/40">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white flex items-center gap-2">
            <FileText size={16} className="text-cyan-400" />
            {pdfName || 'Exam paper'}
            <span className="text-xs text-navy-400">· {pages.length} page{pages.length !== 1 ? 's' : ''}</span>
          </p>
          <button
            type="button"
            onClick={onClear}
            className="p-1 text-navy-400 hover:text-red-400 transition-colors"
            aria-label="Remove PDF"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {pages.map((p, i) => (
            <div key={i} className="relative rounded border border-navy-700 overflow-hidden bg-navy-900">
              <img src={p} alt={`Exam page ${i + 1}`} className="w-full h-auto" />
              <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1.5 py-0.5">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-navy-500 mt-2 flex items-center gap-1">
          <ImageIcon size={12} /> Pages are rendered as images — students see them in the exam viewer.
        </p>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full border-2 border-dashed border-navy-600 hover:border-cyan-500 rounded-lg p-6 text-center transition-colors disabled:opacity-50"
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2 text-navy-300">
            <Loader2 size={20} className="animate-spin" /> Rendering pages…
          </span>
        ) : (
          <span className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-cyan-400" />
            <span className="text-sm text-navy-200">Upload the exam PDF</span>
            <span className="text-xs text-navy-500">Each page becomes an image shown in the exam viewer</span>
          </span>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}