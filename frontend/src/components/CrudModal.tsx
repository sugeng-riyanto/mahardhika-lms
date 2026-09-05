import { useState, useEffect } from 'react'
import { X, Save, Trash2, Loader2 } from 'lucide-react'

export interface CrudField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'toggle' | 'file'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  readOnly?: boolean
  helpText?: string
  accept?: string
}

interface CrudModalProps {
  isOpen: boolean
  mode: 'create' | 'edit' | 'delete' | 'view'
  title: string
  fields?: CrudField[]
  data?: Record<string, unknown>
  onSave?: (data: Record<string, unknown>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

export function CrudModal({
  isOpen,
  mode,
  title,
  fields = [],
  data = {},
  onSave,
  onDelete,
  onClose,
  isLoading = false,
}: CrudModalProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(data)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFormData(data)
  }, [data])

  if (!isOpen) return null

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setSaving(true)
    try {
      await onDelete()
      onClose()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'create' && `Create ${title}`}
            {mode === 'edit' && `Edit ${title}`}
            {mode === 'delete' && `Delete ${title}`}
            {mode === 'view' && `${title} Details`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-navy-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {mode === 'delete' ? (
            <div className="text-center py-4">
              <Trash2 className="mx-auto text-red-400 mb-4" size={48} />
              <p className="text-red-300 text-lg font-medium mb-2">
                Are you sure you want to delete this {title.toLowerCase()}?
              </p>
              <p className="text-navy-400 text-sm">
                This action cannot be undone.
              </p>
            </div>
          ) : mode === 'view' ? (
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.name} className="flex justify-between items-center py-2 border-b border-navy-800">
                  <span className="text-sm text-navy-400">{field.label}</span>
                  <span className="text-sm text-white font-medium">
                    {String(formData[field.name] ?? '—')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-navy-300 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={String(formData[field.name] ?? '')}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      disabled={field.readOnly}
                      className="input-field w-full"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'file' ? (
                    <input
                      type="file"
                      accept={field.accept}
                      onChange={(e) => handleChange(field.name, e.target.files?.[0] ?? null)}
                      className="input-field w-full file:mr-3 file:rounded-md file:border-0 file:bg-navy-700 file:px-3 file:py-1 file:text-sm file:text-white"
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={String(formData[field.name] ?? '')}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      disabled={field.readOnly}
                      className="input-field w-full min-h-[80px]"
                      rows={3}
                    />
                  ) : field.type === 'toggle' ? (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          formData[field.name] ? 'bg-cyan-600' : 'bg-navy-700'
                        }`}
                        onClick={() => handleChange(field.name, !formData[field.name])}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            formData[field.name] ? 'translate-x-5' : ''
                          }`}
                        />
                      </div>
                      <span className="text-sm text-navy-300">
                        {formData[field.name] ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  ) : (
                    <input
                      type={field.type}
                      value={String(formData[field.name] ?? '')}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      disabled={field.readOnly}
                      readOnly={field.readOnly}
                      className="input-field w-full"
                    />
                  )}
                  {field.helpText && (
                    <p className="text-xs text-navy-500 mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-navy-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-navy-400 hover:text-white transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          {mode === 'delete' ? (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="btn-danger flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete
            </button>
          ) : mode !== 'view' ? (
            <button
              onClick={handleSubmit}
              disabled={saving || isLoading}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
