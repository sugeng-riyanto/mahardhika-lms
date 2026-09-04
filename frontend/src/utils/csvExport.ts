/**
 * Reusable CSV export utility.
 *
 * Usage:
 *   import { exportToCSV } from '@/utils/csvExport'
 *   exportToCSV(users, [{ key: 'email', label: 'Email' }, { key: 'full_name', label: 'Name' }], 'users')
 */

export interface CSVColumn<T = unknown> {
  key: string
  label: string
  format?: (value: unknown, row: T) => string
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current == null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}

/**
 * Build the CSV text (header + data rows) for the given columns.
 *
 * Pure — exposed separately from exportToCSV so tests can assert the exact
 * rows and header without triggering a browser download.
 */
export function buildCSV<T>(
  data: T[],
  columns: CSVColumn<T>[]
): string {
  // Build header row
  const header = columns.map(col => escapeCSV(col.label)).join(',')

  // Build data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const rawValue = getNestedValue(row, col.key)
      const value = col.format ? col.format(rawValue, row) : String(rawValue ?? '')
      return escapeCSV(value)
    }).join(',')
  })

  return [header, ...rows].join('\n')
}

export function exportToCSV<T>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string
): void {
  const csv = buildCSV(data, columns)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Format a date string for CSV export.
 */
export function formatDate(value: unknown): string {
  if (!value || typeof value !== 'string') return ''
  return new Date(value).toLocaleDateString('id-ID')
}

/**
 * Format a boolean for CSV export.
 */
export function formatBoolean(value: unknown): string {
  return value ? 'Yes' : 'No'
}

/**
 * Format a currency amount for CSV export.
 */
export function formatCurrency(value: unknown): string {
  const num = Number(value)
  if (isNaN(num)) return ''
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
}
