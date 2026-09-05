import { useState, useMemo, type ReactNode } from 'react'
import { Check, ChevronRight, Eye, Save, Loader2, AlertCircle } from 'lucide-react'

/** A single checklist step. */
export interface WizardStep {
  id: string
  label: string
  /** If true the step is optional and won't block submission. */
  optional?: boolean
}

/** Every field definition the wizard renders. */
export interface WizardField {
  name: string
  label: string
  type: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'toggle' | 'url'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  helpText?: string
  /** Which step(s) this field belongs to (by step id). */
  step: string
}

interface ContentWizardProps {
  /** Title shown in the header. */
  title: string
  /** Checklist steps. */
  steps: WizardStep[]
  /** Fields rendered per step. */
  fields: WizardField[]
  /** Initial form values. */
  initialValues?: Record<string, unknown>
  /** Called on submit. Receives the merged form data. */
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  /** Close handler. */
  onClose: () => void
  /** Optional live preview renderer. Receives current form data. */
  preview?: (data: Record<string, unknown>) => ReactNode
  /** Show as full-screen overlay (default true). */
  fullScreen?: boolean
}

/**
 * ContentWizard — a 1-to-2-page content creation flow with:
 *  - Checklist at the top showing which steps are complete
 *  - Inline form for the current step
 *  - Live preview panel (optional)
 *  - Responsive: preview collapses to a modal on mobile
 */
export function ContentWizard({
  title,
  steps,
  fields,
  initialValues = {},
  onSubmit,
  onClose,
  preview,
  fullScreen = true,
}: ContentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const step = steps[currentStep]

  // Fields for the current step
  const stepFields = useMemo(
    () => fields.filter((f) => f.step === step?.id),
    [fields, step],
  )

  // Which steps are "done" (all required fields filled)
  const stepStatus = useMemo(() => {
    return steps.map((s) => {
      const sFields = fields.filter((f) => f.step === s.id && f.required)
      if (sFields.length === 0) return true // optional step or no required fields
      return sFields.every((f) => {
        const v = formData[f.name]
        return v !== undefined && v !== null && String(v).trim() !== ''
      })
    })
  }, [steps, fields, formData])

  const completedCount = stepStatus.filter(Boolean).length
  const allRequiredDone = stepStatus.every(Boolean)

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    for (const f of fields) {
      if (f.required) {
        const v = formData[f.name]
        if (v === undefined || v === null || String(v).trim() === '') {
          errs[f.name] = `${f.label} is required`
        }
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    // Validate current step fields
    const stepErrs: Record<string, string> = {}
    for (const f of stepFields) {
      if (f.required) {
        const v = formData[f.name]
        if (v === undefined || v === null || String(v).trim() === '') {
          stepErrs[f.name] = `${f.label} is required`
        }
      }
    }
    setErrors(stepErrs)
    if (Object.keys(stepErrs).length === 0 && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSubmit(formData)
      onClose()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={fullScreen
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
      : 'relative'
    }>
      <div className="bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl w-full max-w-5xl mx-auto max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-navy-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <span className="text-[10px] text-navy-500 bg-navy-800 px-2 py-0.5 rounded-full">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {preview && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                  showPreview
                    ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
                    : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
                }`}
              >
                <Eye size={12} />
                Preview
              </button>
            )}
            <button onClick={onClose} className="text-navy-400 hover:text-white p-1 text-lg" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Form area */}
          <div className={`flex-1 flex flex-col min-w-0 ${showPreview && preview ? 'border-r border-navy-700' : ''}`}>
            {/* Checklist */}
            <div className="px-5 py-3 border-b border-navy-800 flex-shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto">
                {steps.map((s, i) => {
                  const done = stepStatus[i]
                  const isCurrent = i === currentStep
                  return (
                    <button
                      key={s.id}
                      onClick={() => setCurrentStep(i)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isCurrent
                          ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-700/50'
                          : done
                            ? 'bg-green-900/20 text-green-400 border border-green-700/30'
                            : 'bg-navy-800 text-navy-400 border border-navy-700 hover:text-navy-200'
                      }`}
                    >
                      {done ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px]">
                          {i + 1}
                        </span>
                      )}
                      <span>{s.label}</span>
                      {s.optional && <span className="text-[9px] opacity-60">(opt)</span>}
                    </button>
                  )
                })}
                {/* Progress bar */}
                <div className="ml-auto flex items-center gap-2 text-[10px] text-navy-500">
                  <div className="w-16 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all"
                      style={{ width: `${(completedCount / steps.length) * 100}%` }}
                    />
                  </div>
                  {completedCount}/{steps.length}
                </div>
              </div>
            </div>

            {/* Form fields for current step */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="max-w-2xl space-y-4">
                {stepFields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-navy-300 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={String(formData[field.name] ?? '')}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        className="input-field w-full"
                      >
                        <option value="">Select...</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={String(formData[field.name] ?? '')}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="input-field w-full min-h-[100px]"
                        rows={4}
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
                          {formData[field.name] ? 'Published' : 'Draft'}
                        </span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        value={String(formData[field.name] ?? '')}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="input-field w-full"
                      />
                    )}
                    {field.helpText && (
                      <p className="text-xs text-navy-500 mt-1">{field.helpText}</p>
                    )}
                    {errors[field.name] && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={10} /> {errors[field.name]}
                      </p>
                    )}
                  </div>
                ))}

                {stepFields.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-navy-400">No fields in this step.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer navigation */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-navy-700 flex-shrink-0">
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className="px-4 py-2 text-sm text-navy-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={saving || !allRequiredDone}
                    className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live preview */}
          {showPreview && preview && (
            <div className="w-[420px] flex-shrink-0 overflow-y-auto bg-navy-950 hidden lg:block">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={14} className="text-cyan-400" />
                  <h3 className="text-xs font-semibold text-navy-300 uppercase tracking-wider">
                    Recipient Preview
                  </h3>
                </div>
                <div className="bg-navy-900 rounded-xl border border-navy-700 p-4">
                  {preview(formData)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile preview modal */}
        {showPreview && preview && (
          <div className="lg:hidden fixed inset-0 z-[60] bg-black/80 flex items-end justify-center p-4">
            <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700 sticky top-0 bg-navy-900">
                <h3 className="text-sm font-semibold text-white">Recipient Preview</h3>
                <button onClick={() => setShowPreview(false)} className="text-navy-400 hover:text-white">×</button>
              </div>
              <div className="p-4">{preview(formData)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
