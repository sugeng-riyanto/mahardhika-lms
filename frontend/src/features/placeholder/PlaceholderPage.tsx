import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Construction className="text-yellow-400" size={24} />
        <h1 className="page-title mb-0">{title}</h1>
      </div>

      <div className="card">
        <div className="text-center py-12">
          <Construction className="mx-auto text-yellow-500/50 mb-4" size={48} />
          <h2 className="text-lg font-semibold text-white mb-2">Under Construction</h2>
          <p className="text-navy-400 max-w-md mx-auto">
            {description || `The ${title} feature is currently being developed as part of Milestone 1. Check back soon!`}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <span className="text-yellow-400 text-sm">🚧 Milestone 1 — Foundation</span>
          </div>
        </div>
      </div>
    </div>
  )
}
