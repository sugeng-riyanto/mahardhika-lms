import { CreditCard, FileText, TrendingUp, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFinanceSummary } from '@/api/hooks'

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  paid: { text: 'text-green-400', bg: 'bg-green-900/30' },
  sent: { text: 'text-cyan-400', bg: 'bg-cyan-900/30' },
  overdue: { text: 'text-red-400', bg: 'bg-red-900/30' },
  draft: { text: 'text-gray-400', bg: 'bg-gray-800' },
  cancelled: { text: 'text-navy-400', bg: 'bg-navy-800' },
}

function formatRupiah(amount: number): string {
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}K`
  return `Rp ${amount.toLocaleString()}`
}

export function TreasurerDashboard() {
  const { data: summary, isLoading } = useFinanceSummary()

  const stats = summary ? [
    { label: 'Total Revenue', value: formatRupiah(summary.total_amount), icon: <TrendingUp size={20} />, color: 'text-green-400', bg: 'bg-green-900/30' },
    { label: 'Paid', value: formatRupiah(summary.paid_amount), icon: <CheckCircle size={20} />, color: 'text-green-400', bg: 'bg-green-900/30' },
    { label: 'Pending', value: formatRupiah(summary.pending_amount), icon: <Clock size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    { label: 'Overdue', value: formatRupiah(summary.overdue_amount), icon: <AlertCircle size={20} />, color: 'text-red-400', bg: 'bg-red-900/30' },
  ] : []

  const recentInvoices = summary?.recent_invoices || []

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="text-yellow-400" size={24} />
        <h1 className="page-title mb-0">Treasurer Dashboard</h1>
      </div>

      <p className="page-subtitle">Finance overview and payment management</p>

      {/* RBAC notice */}
      <div className="p-3 bg-navy-800/50 rounded-lg mb-6 border border-navy-700">
        <p className="text-sm text-navy-300">
          <strong className="text-yellow-400">Finance Role:</strong> You can view invoices, payment status, and financial summaries.
          Academic records, student responses, and safeguarding information are not accessible through this role.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-navy-400 mt-3">Loading finance data...</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="card">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <span className={stat.color}>{stat.icon}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-sm text-navy-400">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Status Breakdown */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-8">
              {Object.entries(summary.status_counts).map(([st, count]) => {
                const cfg = STATUS_COLORS[st] || STATUS_COLORS.draft
                return (
                  <div key={st} className={`card text-center ${cfg.bg}`}>
                    <p className={`text-2xl font-bold ${cfg.text}`}>{count as number}</p>
                    <p className="text-sm text-navy-400 capitalize">{st}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Recent Invoices + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Invoices</h2>
              {recentInvoices.length === 0 ? (
                <p className="text-navy-500 text-sm">No invoices yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentInvoices.map((inv) => {
                    const cfg = STATUS_COLORS[inv.status] || STATUS_COLORS.draft
                    return (
                      <div key={inv.id} className="flex items-center justify-between py-2 border-b border-navy-700 last:border-0">
                        <div>
                          <p className="text-sm text-white">{inv.invoice_number}</p>
                          <p className="text-xs text-navy-400">{inv.notes}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white">{formatRupiah(Number(inv.amount))}</p>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <Link to="/finance" className="block mt-4 text-sm text-cyan-400 hover:text-cyan-300">
                View all invoices →
              </Link>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link to="/finance" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
                  <FileText size={16} className="inline mr-2 text-cyan-400" />
                  View invoices and payments →
                </Link>
                <Link to="/reports" className="block p-3 rounded-lg hover:bg-navy-700 transition-colors text-sm text-navy-200">
                  <TrendingUp size={16} className="inline mr-2 text-cyan-400" />
                  Financial reports →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
