import { useState } from 'react'
import {
  CreditCard, FileText, Plus, Search, Send, CheckCircle,
  XCircle, AlertCircle, Trash2, Eye, Download,
} from 'lucide-react'
import { exportToCSV, formatCurrency, formatDate, type CSVColumn } from '@/utils/csvExport'

const INVOICE_CSV_COLUMNS: CSVColumn[] = [
  { key: 'invoice_number', label: 'Invoice' },
  { key: 'user_email', label: 'User' },
  { key: 'amount', label: 'Amount', format: formatCurrency },
  { key: 'status', label: 'Status' },
  { key: 'due_date', label: 'Due Date', format: formatDate },
  { key: 'paid_at', label: 'Paid At', format: formatDate },
  { key: 'notes', label: 'Notes' },
]
import {
  useInvoices, useFinanceSummary, useCreateInvoice, useUpdateInvoice,
  useDeleteInvoice, useSendInvoice, useMarkPaidInvoice, useCancelInvoice,
} from '@/api/hooks'
import type { Invoice } from '@/api/hooks'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'text-gray-400', bg: 'bg-gray-800', icon: <FileText size={14} /> },
  sent: { label: 'Sent', color: 'text-cyan-400', bg: 'bg-cyan-900/30', icon: <Send size={14} /> },
  paid: { label: 'Paid', color: 'text-green-400', bg: 'bg-green-900/30', icon: <CheckCircle size={14} /> },
  overdue: { label: 'Overdue', color: 'text-red-400', bg: 'bg-red-900/30', icon: <AlertCircle size={14} /> },
  cancelled: { label: 'Cancelled', color: 'text-navy-400', bg: 'bg-navy-800', icon: <XCircle size={14} /> },
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

// ============================================================
// Invoice Form Modal
// ============================================================
function InvoiceFormModal({
  invoice, onClose, onSaved,
}: {
  invoice?: Invoice | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!invoice
  const createMutation = useCreateInvoice()
  const updateMutation = useUpdateInvoice()

  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '',
    user: invoice?.user || '',
    amount: invoice?.amount?.toString() || '',
    currency: invoice?.currency || 'IDR',
    status: invoice?.status || 'draft',
    due_date: invoice?.due_date?.split('T')[0] || '',
    notes: invoice?.notes || '',
  })
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.invoice_number || !form.user || !form.amount) {
      setError('Invoice number, user, and amount are required.')
      return
    }
    setError('')
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: invoice!.id, data: form as unknown as Partial<Invoice> })
      } else {
        await createMutation.mutateAsync(form as unknown as Partial<Invoice>)
      }
      onSaved()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save invoice'
      setError(msg)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">{isEdit ? 'Edit Invoice' : 'Create Invoice'}</h2>
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-navy-300 mb-1">Invoice Number *</label>
              <input
                className="input w-full"
                value={form.invoice_number}
                onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                placeholder="INV-2026-001"
                disabled={isEdit}
              />
            </div>
            <div>
              <label className="block text-sm text-navy-300 mb-1">User ID *</label>
              <input
                className="input w-full"
                value={form.user}
                onChange={e => setForm(f => ({ ...f, user: e.target.value }))}
                placeholder="User UUID"
                disabled={isEdit}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-navy-300 mb-1">Amount (IDR) *</label>
                <input
                  className="input w-full"
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="5000000"
                />
              </div>
              <div>
                <label className="block text-sm text-navy-300 mb-1">Due Date</label>
                <input
                  className="input w-full"
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-navy-300 mb-1">Notes</label>
              <textarea
                className="input w-full min-h-[80px]"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Invoice description..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary"
            >
              {isEdit ? 'Save Changes' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Invoice Detail Modal
// ============================================================
function InvoiceDetailModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const sendMutation = useSendInvoice()
  const markPaidMutation = useMarkPaidInvoice()
  const cancelMutation = useCancelInvoice()
  const deleteMutation = useDeleteInvoice()
  const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft

  const handleSend = async () => {
    await sendMutation.mutateAsync(invoice.id)
    onClose()
  }
  const handleMarkPaid = async () => {
    await markPaidMutation.mutateAsync(invoice.id)
    onClose()
  }
  const handleCancel = async () => {
    await cancelMutation.mutateAsync({ id: invoice.id, reason: 'Cancelled by admin' })
    onClose()
  }
  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      await deleteMutation.mutateAsync(invoice.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{invoice.invoice_number}</h2>
              <p className="text-navy-400 text-sm">{invoice.user_email}</p>
            </div>
            <span className={`px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1.5 ${cfg.bg} ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card bg-navy-800/50">
              <p className="text-navy-400 text-xs mb-1">Amount</p>
              <p className="text-white text-xl font-bold">{formatRupiah(Number(invoice.amount))}</p>
            </div>
            <div className="card bg-navy-800/50">
              <p className="text-navy-400 text-xs mb-1">Due Date</p>
              <p className="text-white text-lg">{invoice.due_date || 'No deadline'}</p>
            </div>
          </div>

          {invoice.notes && (
            <div className="mb-6">
              <p className="text-navy-400 text-xs mb-1">Notes</p>
              <p className="text-navy-200 text-sm">{invoice.notes}</p>
            </div>
          )}

          {invoice.paid_at && (
            <p className="text-green-400 text-sm mb-4">
              Paid on {new Date(invoice.paid_at).toLocaleDateString()}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'draft' && (
              <button onClick={handleSend} className="btn-primary flex items-center gap-1.5">
                <Send size={14} /> Send Invoice
              </button>
            )}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <button onClick={handleMarkPaid} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
                <CheckCircle size={14} /> Mark as Paid
              </button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <button onClick={handleCancel} className="bg-red-600/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
                <XCircle size={14} /> Cancel
              </button>
            )}
            <button onClick={handleDelete} className="btn-secondary text-red-400 flex items-center gap-1.5">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Finance Page
// ============================================================
export function FinancePage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter

  const { data: invoices = [], isLoading } = useInvoices(params)
  const { data: summary } = useFinanceSummary()

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CreditCard className="text-yellow-400" size={24} />
          <h1 className="page-title mb-0">Finance</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(invoices, INVOICE_CSV_COLUMNS, 'invoices')} className="btn-secondary flex items-center gap-1.5">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={() => setShowCreateForm(true)} className="btn-primary flex items-center gap-1.5">
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: formatRupiah(summary.total_amount), color: 'text-white' },
            { label: 'Paid', value: formatRupiah(summary.paid_amount), color: 'text-green-400' },
            { label: 'Pending', value: formatRupiah(summary.pending_amount), color: 'text-cyan-400' },
            { label: 'Overdue', value: formatRupiah(summary.overdue_amount), color: 'text-red-400' },
            { label: 'Draft', value: formatRupiah(summary.draft_amount), color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <p className="text-navy-400 text-xs mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" size={16} />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'draft', 'sent', 'paid', 'overdue', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === s
                  ? 'bg-cyan-600 text-white'
                  : 'bg-navy-800 text-navy-300 hover:bg-navy-700'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
          <p className="text-navy-400 mt-3">Loading invoices...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto text-navy-600 mb-3" size={48} />
          <h3 className="text-navy-400 text-lg">No invoices found</h3>
          <p className="text-navy-500 text-sm mt-1">Create your first invoice to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left py-3 px-4 text-navy-400 font-medium">Invoice</th>
                  <th className="text-left py-3 px-4 text-navy-400 font-medium">User</th>
                  <th className="text-right py-3 px-4 text-navy-400 font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-navy-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-navy-400 font-medium">Due Date</th>
                  <th className="text-right py-3 px-4 text-navy-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: Invoice) => {
                  const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft
                  const isOverdue = inv.status !== 'paid' && inv.status !== 'cancelled' && inv.due_date && new Date(inv.due_date) < new Date()
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-navy-800 hover:bg-navy-800/30 cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="py-3 px-4">
                        <span className="text-white font-medium">{inv.invoice_number}</span>
                      </td>
                      <td className="py-3 px-4 text-navy-300">{inv.user_email}</td>
                      <td className="py-3 px-4 text-right text-white font-medium">{formatRupiah(Number(inv.amount))}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </td>
                      <td className={`py-3 px-4 ${isOverdue ? 'text-red-400' : 'text-navy-300'}`}>
                        {inv.due_date || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedInvoice(inv) }}
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateForm && (
        <InvoiceFormModal onClose={() => setShowCreateForm(false)} onSaved={() => setShowCreateForm(false)} />
      )}
      {selectedInvoice && (
        <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  )
}
