import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Pen, Highlighter, Eraser, Type, Minus, ArrowRight, Square, Circle,
  Grid3X3, ArrowUpRight, Compass, RotateCcw, RotateCw, ZoomIn, ZoomOut,
  Maximize2, Save, Lock, Unlock, Layers, AlertTriangle, Sigma,
  Download, FileImage, FileText, ChevronDown
} from 'lucide-react'
import type { CanvasStroke, CanvasState, LayerType, ToolType, Point } from './types'
import { exportCanvasAsPng, exportCanvasAsPdf } from './canvasExport'

const LAYER_META: Record<LayerType, { label: string; colour: string; bg: string; readonly: boolean }> = {
  question: { label: 'Question', colour: 'text-blue-400', bg: 'bg-blue-900/30', readonly: true },
  student: { label: 'Student Work', colour: 'text-green-400', bg: 'bg-green-900/30', readonly: false },
  teacher: { label: 'Teacher Feedback', colour: 'text-purple-400', bg: 'bg-purple-900/30', readonly: false },
  revision: { label: 'Student Revision', colour: 'text-orange-400', bg: 'bg-orange-900/30', readonly: false },
}

const TOOL_GROUPS = [
  {
    label: 'Drawing',
    tools: [
      { id: 'pen' as ToolType, icon: Pen, label: 'Pen' },
      { id: 'highlighter' as ToolType, icon: Highlighter, label: 'Highlighter' },
      { id: 'eraser' as ToolType, icon: Eraser, label: 'Eraser' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { id: 'text' as ToolType, icon: Type, label: 'Text' },
      { id: 'line' as ToolType, icon: Minus, label: 'Line' },
      { id: 'arrow' as ToolType, icon: ArrowRight, label: 'Arrow' },
      { id: 'rectangle' as ToolType, icon: Square, label: 'Rectangle' },
      { id: 'circle' as ToolType, icon: Circle, label: 'Circle' },
    ],
  },
  {
    label: 'Math/Physics',
    tools: [
      { id: 'coordinate_axes' as ToolType, icon: Compass, label: 'Axes' },
      { id: 'grid' as ToolType, icon: Grid3X3, label: 'Grid' },
      { id: 'vector' as ToolType, icon: ArrowUpRight, label: 'Vector' },
      { id: 'force_arrow' as ToolType, icon: ArrowRight, label: 'Force' },
      { id: 'point_label' as ToolType, icon: Type, label: 'Point' },
      { id: 'angle_marker' as ToolType, icon: Compass, label: 'Angle' },
      { id: 'equation' as ToolType, icon: Sigma, label: 'Equation' },
    ],
  },
]

const COLOURS = ['#ffffff', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']
const WIDTHS = [2, 4, 6, 10]

const MOCK_STROKES: CanvasStroke[] = [
  { id: 's1', tool: 'text', points: [{ x: 80, y: 60 }], colour: '#3b82f6', width: 2, opacity: 1, layer: 'question', text: 'Q1: A force of 20N acts on a 5kg block. Calculate the acceleration.', fontSize: 18, created_at: '2026-08-24T10:00:00Z' },
  { id: 's2', tool: 'text', points: [{ x: 80, y: 100 }], colour: '#3b82f6', width: 2, opacity: 1, layer: 'question', text: "Use Newton's Second Law: F = ma", fontSize: 16, created_at: '2026-08-24T10:01:00Z' },
  { id: 's3', tool: 'text', points: [{ x: 80, y: 170 }], colour: '#22c55e', width: 2, opacity: 1, layer: 'student', text: 'Given: F = 20N, m = 5kg', fontSize: 16, created_at: '2026-08-25T14:00:00Z' },
  { id: 's4', tool: 'text', points: [{ x: 80, y: 200 }], colour: '#22c55e', width: 2, opacity: 1, layer: 'student', text: 'Formula: F = ma  →  a = F/m', fontSize: 16, created_at: '2026-08-25T14:01:00Z' },
  { id: 's5', tool: 'text', points: [{ x: 80, y: 230 }], colour: '#22c55e', width: 2, opacity: 1, layer: 'student', text: 'a = 20 / 5 = 4 m/s²', fontSize: 16, created_at: '2026-08-25T14:02:00Z' },
  { id: 's6', tool: 'pen', points: [{ x: 350, y: 160 }, { x: 350, y: 260 }], colour: '#22c55e', width: 3, opacity: 1, layer: 'student', created_at: '2026-08-25T14:03:00Z' },
  { id: 's7', tool: 'text', points: [{ x: 360, y: 210 }], colour: '#22c55e', width: 2, opacity: 1, layer: 'student', text: 'F = 20N ↓', fontSize: 14, created_at: '2026-08-25T14:04:00Z' },
  { id: 's8', tool: 'rectangle', points: [{ x: 310, y: 270 }, { x: 390, y: 310 }], colour: '#22c55e', width: 2, opacity: 1, layer: 'student', created_at: '2026-08-25T14:05:00Z' },
  { id: 's9', tool: 'text', points: [{ x: 335, y: 295 }], colour: '#22c55e', width: 1, opacity: 1, layer: 'student', text: '5kg', fontSize: 12, created_at: '2026-08-25T14:06:00Z' },
  { id: 's10', tool: 'highlighter', points: [{ x: 75, y: 225 }, { x: 250, y: 225 }], colour: '#8b5cf6', width: 20, opacity: 0.3, layer: 'teacher', created_at: '2026-08-26T09:00:00Z' },
  { id: 's11', tool: 'text', points: [{ x: 80, y: 310 }], colour: '#8b5cf6', width: 2, opacity: 1, layer: 'teacher', text: '✓ Correct calculation! Remember to include units in your final answer.', fontSize: 14, created_at: '2026-08-26T09:01:00Z' },
  { id: 's12', tool: 'pen', points: [{ x: 400, y: 230 }, { x: 430, y: 230 }, { x: 430, y: 260 }, { x: 400, y: 260 }, { x: 400, y: 230 }], colour: '#8b5cf6', width: 2, opacity: 1, layer: 'teacher', created_at: '2026-08-26T09:02:00Z' },
  { id: 's13', tool: 'text', points: [{ x: 440, y: 248 }], colour: '#8b5cf6', width: 2, opacity: 1, layer: 'teacher', text: 'Good diagram!', fontSize: 12, created_at: '2026-08-26T09:03:00Z' },
]

function generateId(): string {
  return `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

interface AnnotationCanvasProps {
  isTeacher?: boolean
  isLocked?: boolean
  onSave?: (strokes: Record<LayerType, CanvasStroke[]>) => void
  documentVersion?: number
  serverVersion?: number
}

export function AnnotationCanvas({
  isTeacher = false,
  isLocked = false,
  onSave,
  documentVersion = 1,
  serverVersion,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  const [canvasSize] = useState({ width: 900, height: 500 })
  const [state, setState] = useState<CanvasState>({
    activeTool: 'pen',
    activeColour: isTeacher ? '#8b5cf6' : '#22c55e',
    activeWidth: 2,
    activeOpacity: 1,
    activeLayer: isTeacher ? 'teacher' : 'student',
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    isPanning: false,
    strokes: [...MOCK_STROKES],
    undoStack: [],
    redoStack: [],
    showGrid: true,
    saveStatus: 'saved',
    isLocked,
  })

  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [shapeStart, setShapeStart] = useState<Point | null>(null)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textPosition, setTextPosition] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [showEquationInput, setShowEquationInput] = useState(false)
  const [equationPosition, setEquationPosition] = useState<Point | null>(null)
  const [equationLatex, setEquationLatex] = useState('')
  const equationInputRef = useRef<HTMLInputElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          // Redo
          setState((prev) => {
            if (prev.redoStack.length === 0) return prev
            const nextStrokes = prev.redoStack[prev.redoStack.length - 1]
            return {
              ...prev,
              strokes: nextStrokes,
              redoStack: prev.redoStack.slice(0, -1),
              undoStack: [...prev.undoStack, prev.strokes],
            }
          })
        } else {
          // Undo
          setState((prev) => {
            if (prev.undoStack.length === 0) return prev
            const lastStrokes = prev.undoStack[prev.undoStack.length - 1]
            return {
              ...prev,
              strokes: lastStrokes,
              undoStack: prev.undoStack.slice(0, -1),
              redoStack: [...prev.redoStack, prev.strokes],
            }
          })
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        triggerSave()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        handleExportPng()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        handleExportPdf()
      } else if (e.key === 'p' && !e.ctrlKey) {
        setState((prev) => ({ ...prev, activeTool: 'pen' }))
      } else if (e.key === 'h' && !e.ctrlKey) {
        setState((prev) => ({ ...prev, activeTool: 'highlighter' }))
      } else if (e.key === 'e' && !e.ctrlKey) {
        setState((prev) => ({ ...prev, activeTool: 'eraser' }))
      } else if (e.key === 't' && !e.ctrlKey) {
        setState((prev) => ({ ...prev, activeTool: 'text' }))
      } else if (e.key === 'l' && !e.ctrlKey) {
        setState((prev) => ({ ...prev, activeTool: 'line' }))
      } else if (e.key === 'g' && !e.ctrlKey) {
        setState((prev) => ({ ...prev, showGrid: !prev.showGrid }))
      } else if (e.key === 'q' && !e.ctrlKey) {
        setState((prev) => ({ ...prev, activeTool: 'equation' }))
      } else if (e.key === 'Escape') {
        setShowTextInput(false)
        setTextValue('')
        setShowEquationInput(false)
        setEquationLatex('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Autosave with debounce (2 seconds after last change)
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      triggerSave()
    }, 2000)
  }, [])

  // Trigger save after undo/redo or new strokes
  useEffect(() => {
    if (state.saveStatus === 'unsaved') {
      scheduleAutosave()
    }
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [state.strokes, state.saveStatus, scheduleAutosave])

  const triggerSave = () => {
    setState((prev) => ({ ...prev, saveStatus: 'saving' }))
    // Group strokes by layer
    const layered: Record<string, CanvasStroke[]> = {}
    for (const s of state.strokes) {
      if (!layered[s.layer]) layered[s.layer] = []
      layered[s.layer].push(s)
    }
    onSave?.(layered as Record<LayerType, CanvasStroke[]>)
    setTimeout(() => {
      setState((prev) => ({ ...prev, saveStatus: 'saved' }))
    }, 800)
  }

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Background
    ctx.fillStyle = '#0a0f1e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    if (state.showGrid) {
      ctx.strokeStyle = 'rgba(100, 120, 160, 0.08)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= canvas.width; x += 30) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y <= canvas.height; y += 30) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }

    // Layer order: question bottom, then student, revision, teacher on top
    const layerOrder: LayerType[] = ['question', 'student', 'revision', 'teacher']

    for (const layer of layerOrder) {
      const layerStrokes = state.strokes.filter((s) => s.layer === layer)

      for (const stroke of layerStrokes) {
        ctx.globalAlpha = stroke.opacity
        ctx.strokeStyle = stroke.colour
        ctx.fillStyle = stroke.colour
        ctx.lineWidth = stroke.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (stroke.tool === 'text' && stroke.text && stroke.points[0]) {
          ctx.font = `${stroke.fontSize || 14}px "Inter", system-ui, sans-serif`
          ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y)
          continue
        }

        if (stroke.tool === 'highlighter') {
          ctx.globalAlpha = 0.3
          ctx.lineWidth = stroke.width
        }

        if (stroke.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out'
        }

        if (stroke.points.length < 2) continue

        const pts = stroke.points

        switch (stroke.tool) {
          case 'pen':
          case 'highlighter':
          case 'eraser': {
            ctx.beginPath()
            ctx.moveTo(pts[0].x, pts[0].y)
            for (let i = 1; i < pts.length; i++) {
              const xc = (pts[i - 1].x + pts[i].x) / 2
              const yc = (pts[i - 1].y + pts[i].y) / 2
              ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc)
            }
            ctx.stroke()
            break
          }
          case 'line': {
            ctx.beginPath()
            ctx.moveTo(pts[0].x, pts[0].y)
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
            ctx.stroke()
            break
          }
          case 'arrow': {
            const sx = pts[0].x, sy = pts[0].y
            const ex = pts[pts.length - 1].x, ey = pts[pts.length - 1].y
            const angle = Math.atan2(ey - sy, ex - sx)
            const headLen = 14
            ctx.beginPath()
            ctx.moveTo(sx, sy)
            ctx.lineTo(ex, ey)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(ex, ey)
            ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6))
            ctx.moveTo(ex, ey)
            ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6))
            ctx.stroke()
            break
          }
          case 'rectangle': {
            const x = Math.min(pts[0].x, pts[pts.length - 1].x)
            const y = Math.min(pts[0].y, pts[pts.length - 1].y)
            const w = Math.abs(pts[pts.length - 1].x - pts[0].x)
            const h = Math.abs(pts[pts.length - 1].y - pts[0].y)
            ctx.strokeRect(x, y, w, h)
            break
          }
          case 'circle': {
            const cx = (pts[0].x + pts[pts.length - 1].x) / 2
            const cy = (pts[0].y + pts[pts.length - 1].y) / 2
            const rx = Math.abs(pts[pts.length - 1].x - pts[0].x) / 2
            const ry = Math.abs(pts[pts.length - 1].y - pts[0].y) / 2
            ctx.beginPath()
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
            ctx.stroke()
            break
          }
          case 'vector': {
            const vsx = pts[0].x, vsy = pts[0].y
            const vex = pts[pts.length - 1].x, vey = pts[pts.length - 1].y
            const vangle = Math.atan2(vey - vsy, vex - vsx)
            const vlen = Math.hypot(vex - vsx, vey - vsy)
            ctx.beginPath()
            ctx.moveTo(vsx, vsy)
            ctx.lineTo(vex, vey)
            ctx.stroke()
            const hLen = Math.min(14, vlen * 0.25)
            ctx.beginPath()
            ctx.moveTo(vex, vey)
            ctx.lineTo(vex - hLen * Math.cos(vangle - 0.4), vey - hLen * Math.sin(vangle - 0.4))
            ctx.moveTo(vex, vey)
            ctx.lineTo(vex - hLen * Math.cos(vangle + 0.4), vey - hLen * Math.sin(vangle + 0.4))
            ctx.stroke()
            const midX = (vsx + vex) / 2
            const midY = (vsy + vey) / 2
            ctx.font = '11px "Inter", system-ui, sans-serif'
            ctx.fillText('v', midX + 8, midY - 8)
            break
          }
          case 'force_arrow': {
            const fsx = pts[0].x, fsy = pts[0].y
            const fex = pts[pts.length - 1].x, fey = pts[pts.length - 1].y
            const fangle = Math.atan2(fey - fsy, fex - fsx)
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(fsx, fsy)
            ctx.lineTo(fex, fey)
            ctx.stroke()
            const fhLen = 18
            ctx.beginPath()
            ctx.moveTo(fex, fey)
            ctx.lineTo(fex - fhLen * Math.cos(fangle - 0.35), fey - fhLen * Math.sin(fangle - 0.35))
            ctx.lineTo(fex - fhLen * Math.cos(fangle + 0.35), fey - fhLen * Math.sin(fangle + 0.35))
            ctx.closePath()
            ctx.fill()
            break
          }
          case 'coordinate_axes': {
            const ax = pts[0].x, ay = pts[0].y
            const axLen = pts.length > 1 ? Math.abs(pts[1].x - pts[0].x) : 120
            const ayLen = pts.length > 1 ? Math.abs(pts[1].y - pts[0].y) : 120
            ctx.beginPath()
            ctx.moveTo(ax - 10, ay)
            ctx.lineTo(ax + axLen, ay)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(ax + axLen, ay)
            ctx.lineTo(ax + axLen - 8, ay - 5)
            ctx.moveTo(ax + axLen, ay)
            ctx.lineTo(ax + axLen - 8, ay + 5)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(ax, ay + 10)
            ctx.lineTo(ax, ay - ayLen)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(ax, ay - ayLen)
            ctx.lineTo(ax - 5, ay - ayLen + 8)
            ctx.moveTo(ax, ay - ayLen)
            ctx.lineTo(ax + 5, ay - ayLen + 8)
            ctx.stroke()
            ctx.font = 'bold 13px "Inter", system-ui, sans-serif'
            ctx.fillText('x', ax + axLen + 6, ay + 5)
            ctx.fillText('y', ax + 8, ay - ayLen + 4)
            for (let t = 30; t < axLen; t += 30) {
              ctx.beginPath()
              ctx.moveTo(ax + t, ay - 3)
              ctx.lineTo(ax + t, ay + 3)
              ctx.stroke()
            }
            for (let t = 30; t < ayLen; t += 30) {
              ctx.beginPath()
              ctx.moveTo(ax - 3, ay - t)
              ctx.lineTo(ax + 3, ay - t)
              ctx.stroke()
            }
            break
          }
          case 'point_label': {
            if (pts[0]) {
              ctx.beginPath()
              ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2)
              ctx.fill()
              ctx.font = 'bold 13px "Inter", system-ui, sans-serif'
              ctx.fillText(stroke.text || 'P', pts[0].x + 8, pts[0].y - 8)
            }
            break
          }
          case 'angle_marker': {
            if (pts.length >= 2) {
              const p0 = pts[0], p1 = pts[pts.length - 1]
              const r = 30
              const a1 = Math.atan2(p0.y - p1.y, p0.x - p1.x)
              ctx.beginPath()
              ctx.arc(p1.x, p1.y, r, a1, 0, false)
              ctx.stroke()
              ctx.font = '11px "Inter", system-ui, sans-serif'
              ctx.fillText('θ', p1.x + r * 0.7, p1.y - r * 0.3)
            }
            break
          }
          case 'equation': {
            if (stroke.equationSvg && pts[0]) {
              // Render KaTeX HTML to an offscreen div, then draw to canvas
              const div = document.createElement('div')
              div.innerHTML = stroke.equationSvg
              div.style.position = 'absolute'
              div.style.left = '-9999px'
              div.style.top = '-9999px'
              div.style.color = stroke.colour
              div.style.fontSize = `${stroke.fontSize || 18}px`
              document.body.appendChild(div)

              try {
                // Use html2canvas-like approach: render via foreignObject SVG
                const w = div.offsetWidth + 20
                const h = div.offsetHeight + 10
                const svgStr = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><foreignObject width='${w}' height='${h}'>
                  <div xmlns='http://www.w3.org/1999/xhtml' style='color:${stroke.colour};font-size:${stroke.fontSize || 18}px'>${stroke.equationSvg}</div>
                </foreignObject></svg>`
                const img = new Image()
                const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
                const url = URL.createObjectURL(svgBlob)
                img.onload = () => {
                  ctx.drawImage(img, pts[0].x, pts[0].y - h)
                  URL.revokeObjectURL(url)
                  document.body.removeChild(div)
                  // Trigger re-render after async image load
                  renderCanvas()
                }
                img.onerror = () => {
                  // Fallback: draw as plain text
                  ctx.font = `${stroke.fontSize || 18}px "Inter", system-ui, sans-serif`
                  ctx.fillText(stroke.equationLatex || '', pts[0].x, pts[0].y)
                  URL.revokeObjectURL(url)
                  document.body.removeChild(div)
                }
                img.src = url
              } catch {
                ctx.font = `${stroke.fontSize || 18}px "Inter", system-ui, sans-serif`
                ctx.fillText(stroke.equationLatex || '', pts[0].x, pts[0].y)
                document.body.removeChild(div)
              }
            }
            break
          }
        }

        ctx.globalCompositeOperation = 'source-over'
      }
    }

    ctx.globalAlpha = 1

    // Draw current stroke preview
    if (isDrawing && currentStroke.length > 0) {
      const tool = state.activeTool
      const colour = state.activeTool === 'eraser' ? '#0a0f1e' : state.activeColour
      ctx.strokeStyle = tool === 'highlighter' ? state.activeColour : colour
      ctx.fillStyle = state.activeColour
      ctx.lineWidth = state.activeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = tool === 'highlighter' ? 0.3 : state.activeOpacity

      if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
        ctx.beginPath()
        ctx.moveTo(currentStroke[0].x, currentStroke[0].y)
        for (let i = 1; i < currentStroke.length; i++) {
          const xc = (currentStroke[i - 1].x + currentStroke[i].x) / 2
          const yc = (currentStroke[i - 1].y + currentStroke[i].y) / 2
          ctx.quadraticCurveTo(currentStroke[i - 1].x, currentStroke[i - 1].y, xc, yc)
        }
        ctx.stroke()
      } else if (shapeStart && currentStroke.length > 0) {
        const end = currentStroke[currentStroke.length - 1]
        if (tool === 'line' || tool === 'arrow' || tool === 'vector' || tool === 'force_arrow') {
          ctx.beginPath()
          ctx.moveTo(shapeStart.x, shapeStart.y)
          ctx.lineTo(end.x, end.y)
          ctx.stroke()
          if (tool === 'arrow' || tool === 'vector') {
            const angle = Math.atan2(end.y - shapeStart.y, end.x - shapeStart.x)
            const hl = 14
            ctx.beginPath()
            ctx.moveTo(end.x, end.y)
            ctx.lineTo(end.x - hl * Math.cos(angle - 0.4), end.y - hl * Math.sin(angle - 0.4))
            ctx.moveTo(end.x, end.y)
            ctx.lineTo(end.x - hl * Math.cos(angle + 0.4), end.y - hl * Math.sin(angle + 0.4))
            ctx.stroke()
          }
        } else if (tool === 'rectangle') {
          const x = Math.min(shapeStart.x, end.x)
          const y = Math.min(shapeStart.y, end.y)
          ctx.strokeRect(x, y, Math.abs(end.x - shapeStart.x), Math.abs(end.y - shapeStart.y))
        } else if (tool === 'circle') {
          const rx = Math.abs(end.x - shapeStart.x) / 2
          const ry = Math.abs(end.y - shapeStart.y) / 2
          const cx = (shapeStart.x + end.x) / 2
          const cy = (shapeStart.y + end.y) / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }
  }, [state, isDrawing, currentStroke, shapeStart])

  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  // Touch/stylus event helpers


  const activeLayerMeta = LAYER_META[state.activeLayer]
  const isLayerLocked = activeLayerMeta.readonly || state.isLocked

  // Text tool: show input on click
  const handleTextClick = (pt: Point) => {
    setTextPosition(pt)
    setTextValue('')
    setShowTextInput(true)
    setTimeout(() => textInputRef.current?.focus(), 50)
  }

  // Equation tool: show LaTeX input on click
  const handleEquationClick = (pt: Point) => {
    setEquationPosition(pt)
    setEquationLatex('')
    setShowEquationInput(true)
    setTimeout(() => equationInputRef.current?.focus(), 50)
  }

  const confirmEquation = () => {
    if (!equationLatex.trim() || !equationPosition) {
      setShowEquationInput(false)
      return
    }
    // Render LaTeX to SVG string via KaTeX
    let svgHtml = ''
    try {
      svgHtml = (window as unknown as { katex?: typeof katex }).katex?.renderToString(equationLatex, {
        displayMode: true,
        throwOnError: false,
        output: 'html',
      }) || ''
    } catch {
      svgHtml = equationLatex
    }

    const newStroke: CanvasStroke = {
      id: generateId(),
      tool: 'equation',
      points: [equationPosition],
      colour: state.activeColour,
      width: state.activeWidth,
      opacity: state.activeOpacity,
      layer: state.activeLayer,
      equationLatex: equationLatex,
      equationSvg: svgHtml,
      fontSize: state.activeWidth >= 6 ? 24 : 18,
      created_at: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      strokes: [...prev.strokes, newStroke],
      undoStack: [...prev.undoStack, prev.strokes],
      redoStack: [],
      saveStatus: 'unsaved',
    }))
    setShowEquationInput(false)
    setEquationLatex('')
    setEquationPosition(null)
  }

  const confirmText = () => {
    if (!textValue.trim() || !textPosition) {
      setShowTextInput(false)
      return
    }
    const newStroke: CanvasStroke = {
      id: generateId(),
      tool: 'text',
      points: [textPosition],
      colour: state.activeColour,
      width: state.activeWidth,
      opacity: state.activeOpacity,
      layer: state.activeLayer,
      text: textValue,
      fontSize: state.activeWidth >= 6 ? 18 : 14,
      created_at: new Date().toISOString(),
    }
    setState((prev) => ({
      ...prev,
      strokes: [...prev.strokes, newStroke],
      undoStack: [...prev.undoStack, prev.strokes],
      redoStack: [],
      saveStatus: 'unsaved',
    }))
    setShowTextInput(false)
    setTextValue('')
    setTextPosition(null)
  }

  // Drawing handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isLayerLocked) return
    // Capture pointer for stylus pressure support
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const pt = { x: e.nativeEvent.offsetX * (canvasSize.width / (e.target as HTMLElement).clientWidth), y: e.nativeEvent.offsetY * (canvasSize.height / (e.target as HTMLElement).clientHeight) }

    if (state.activeTool === 'text') {
      handleTextClick(pt)
      return
    }

    if (state.activeTool === 'equation') {
      handleEquationClick(pt)
      return
    }

    setIsDrawing(true)
    if (['line', 'arrow', 'rectangle', 'circle', 'vector', 'force_arrow', 'coordinate_axes', 'point_label', 'angle_marker'].includes(state.activeTool)) {
      setShapeStart(pt)
      setCurrentStroke([pt])
    } else {
      setCurrentStroke([pt])
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const pt = { x: e.nativeEvent.offsetX * (canvasSize.width / (e.target as HTMLElement).clientWidth), y: e.nativeEvent.offsetY * (canvasSize.height / (e.target as HTMLElement).clientHeight) }
    setCurrentStroke((prev) => [...prev, pt])
  }

  const handlePointerUp = () => {
    if (!isDrawing || currentStroke.length === 0) {
      setIsDrawing(false)
      return
    }

    const newStroke: CanvasStroke = {
      id: generateId(),
      tool: state.activeTool,
      points: state.activeTool === 'point_label' ? [currentStroke[0]] : currentStroke,
      colour: state.activeTool === 'eraser' ? '#0a0f1e' : state.activeColour,
      width: state.activeWidth,
      opacity: state.activeTool === 'highlighter' ? 0.3 : state.activeOpacity,
      layer: state.activeLayer,
      text: state.activeTool === 'point_label' ? 'P' : undefined,
      created_at: new Date().toISOString(),
    }

    setState((prev) => ({
      ...prev,
      strokes: [...prev.strokes, newStroke],
      undoStack: [...prev.undoStack, prev.strokes],
      redoStack: [],
      saveStatus: 'unsaved',
    }))

    setIsDrawing(false)
    setCurrentStroke([])
    setShapeStart(null)
  }

  const undo = () => {
    setState((prev) => {
      if (prev.undoStack.length === 0) return prev
      const lastStrokes = prev.undoStack[prev.undoStack.length - 1]
      return {
        ...prev,
        strokes: lastStrokes,
        undoStack: prev.undoStack.slice(0, -1),
        redoStack: [...prev.redoStack, prev.strokes],
      }
    })
  }

  const redo = () => {
    setState((prev) => {
      if (prev.redoStack.length === 0) return prev
      const nextStrokes = prev.redoStack[prev.redoStack.length - 1]
      return {
        ...prev,
        strokes: nextStrokes,
        redoStack: prev.redoStack.slice(0, -1),
        undoStack: [...prev.undoStack, prev.strokes],
      }
    })
  }

  const handleManualSave = () => {
    triggerSave()
  }

  const handleExportPng = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      await exportCanvasAsPng(canvas, 'akademi-canvas.png')
    } catch (err) {
      console.error('PNG export failed:', err)
    }
    setShowExportMenu(false)
  }

  const handleExportPdf = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      await exportCanvasAsPdf(canvas, 'akademi-canvas.pdf')
    } catch (err) {
      console.error('PDF export failed:', err)
    }
    setShowExportMenu(false)
  }

  // Keyboard shortcut display
  const shortcuts = [
    { key: 'P', label: 'Pen' },
    { key: 'H', label: 'Highlighter' },
    { key: 'E', label: 'Eraser' },
    { key: 'T', label: 'Text' },
    { key: 'L', label: 'Line' },
    { key: 'Q', label: 'Equation' },
    { key: 'G', label: 'Grid' },
    { key: 'Ctrl+Z', label: 'Undo' },
    { key: 'Ctrl+S', label: 'Save' },
    { key: 'Ctrl+Shift+P', label: 'PNG' },
    { key: 'Ctrl+Shift+F', label: 'PDF' },
  ]

  return (
    <div className="flex gap-4">
      {/* Text input overlay */}
      {showTextInput && textPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 w-96 shadow-2xl">
            <p className="text-sm font-medium text-white mb-2">Add Text</p>
            <input
              ref={textInputRef}
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmText()
                if (e.key === 'Escape') { setShowTextInput(false); setTextValue('') }
              }}
              placeholder="Type your text..."
              className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowTextInput(false); setTextValue('') }} className="btn-secondary text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-cyan-400">Cancel</button>
              <button onClick={confirmText} className="btn-primary text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-cyan-400">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Equation input overlay */}
      {showEquationInput && equationPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 w-[28rem] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Sigma size={18} className="text-cyan-400" />
              <p className="text-sm font-medium text-white">LaTeX Equation</p>
            </div>
            <input
              ref={equationInputRef}
              type="text"
              value={equationLatex}
              onChange={(e) => setEquationLatex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmEquation()
                if (e.key === 'Escape') { setShowEquationInput(false); setEquationLatex('') }
              }}
              placeholder="e.g. E = mc^2, \frac{a}{b}, \int_0^1 f(x)dx"
              className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 mb-2"
            />
            {/* Preview */}
            {equationLatex.trim() && (
              <div className="bg-navy-800 border border-navy-700 rounded-lg p-3 mb-3">
                <p className="text-[10px] text-navy-500 mb-1">Preview:</p>
                <div
                  className="text-white text-center py-2 overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      try {
                        return (window as unknown as { katex?: typeof katex }).katex?.renderToString(equationLatex, {
                          displayMode: true,
                          throwOnError: false,
                        }) || equationLatex
                      } catch {
                        return equationLatex
                      }
                    })(),
                  }}
                />
              </div>
            )}
            {/* Quick-insert buttons */}
            <div className="flex flex-wrap gap-1 mb-3">
              {[
                { label: 'a/b', tex: '\\frac{a}{b}' },
                { label: '√x', tex: '\\sqrt{x}' },
                { label: 'x²', tex: 'x^2' },
                { label: '∑', tex: '\\sum_{i=1}^{n}' },
                { label: '∫', tex: '\\int_{0}^{1}' },
                { label: '∞', tex: '\\infty' },
                { label: '±', tex: '\\pm' },
                { label: '→', tex: '\\rightarrow' },
                { label: '≤', tex: '\\leq' },
                { label: 'Δ', tex: '\\Delta' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setEquationLatex((prev) => prev + item.tex)}
                  className="px-2 py-1 text-xs bg-navy-800 border border-navy-700 rounded text-navy-300 hover:text-white hover:border-cyan-700 transition-colors font-mono"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowEquationInput(false); setEquationLatex('') }} className="btn-secondary text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-cyan-400">Cancel</button>
              <button onClick={confirmEquation} className="btn-primary text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-cyan-400">Add Equation</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="w-14 bg-navy-900 border border-navy-700 rounded-xl flex flex-col items-center py-2 gap-1 flex-shrink-0">
        {TOOL_GROUPS.map((group) => (
          <div key={group.label} className="w-full">
            <div className="px-1 py-0.5">
              {group.tools.map((tool) => {
                const Icon = tool.icon
                const isActive = state.activeTool === tool.id
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      const defaultLayer = isTeacher ? 'teacher' : 'student'
                      const toolLayer = isActive ? state.activeLayer : defaultLayer
                      setState((prev) => ({
                        ...prev,
                        activeTool: tool.id,
                        activeLayer: ['coordinate_axes', 'grid', 'vector', 'force_arrow', 'point_label', 'angle_marker'].includes(tool.id) && !isTeacher
                          ? 'student' : toolLayer,
                      }))
                    }}
                    className={`w-full p-1.5 rounded-lg text-xs transition-colors mb-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isActive ? 'bg-cyan-900/50 text-cyan-400' : 'text-navy-400 hover:text-white hover:bg-navy-800'
                    }`}
                    title={`${tool.label} (${shortcuts.find(s => s.label.toLowerCase() === tool.label.toLowerCase())?.key || ''})`}
                    aria-pressed={isActive}
                    aria-label={`${tool.label} tool`}
                    disabled={isLayerLocked}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
            <div className="w-8 h-px bg-navy-700 mx-auto my-1" />
          </div>
        ))}

        {/* Colours */}
        <div className="flex flex-col gap-0.5 px-1">
          {COLOURS.map((colour) => (
            <button
              key={colour}
              onClick={() => setState((prev) => ({ ...prev, activeColour: colour }))}
              className={`w-5 h-5 rounded-full border-2 mx-auto ${
                state.activeColour === colour ? 'border-white scale-125' : 'border-navy-700 hover:border-navy-400'
              }`}
              style={{ backgroundColor: colour }}
              disabled={isLayerLocked}
            />
          ))}
        </div>

        {/* Widths */}
        <div className="w-8 h-px bg-navy-700 mx-auto my-1" />
        <div className="flex flex-col gap-1 px-1">
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setState((prev) => ({ ...prev, activeWidth: w }))}
              className={`w-8 h-6 rounded flex items-center justify-center ${
                state.activeWidth === w ? 'bg-navy-700' : 'hover:bg-navy-800'
              }`}
            >
              <div className="rounded-full bg-current" style={{ width: w + 2, height: w + 2, color: state.activeColour }} />
            </button>
          ))}
        </div>
      </div>

      {/* Canvas + controls */}
      <div className="flex-1 flex flex-col gap-3">
        {/* Conflict warning */}
        {conflictWarning && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-400">
            <AlertTriangle size={14} />
            {conflictWarning}
            <button onClick={() => setConflictWarning(null)} className="ml-auto text-yellow-500 hover:text-white">✕</button>
          </div>
        )}

        {/* Layer switcher + controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1">
            {(Object.keys(LAYER_META) as LayerType[]).map((layer) => {
              const meta = LAYER_META[layer]
              const isActive = state.activeLayer === layer
              const isReadonly = meta.readonly
              return (
                <button
                  key={layer}
                  onClick={() => setState((prev) => ({ ...prev, activeLayer: layer }))}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? `${meta.bg} ${meta.colour} border-current/20`
                      : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
                  }`}
                >
                  <Layers size={12} />
                  {meta.label}
                  {isReadonly && <Lock size={10} className="opacity-50" />}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={undo} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors" title="Undo (Ctrl+Z)" disabled={state.undoStack.length === 0}>
              <RotateCcw size={14} />
            </button>
            <button onClick={redo} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors" title="Redo (Ctrl+Shift+Z)" disabled={state.redoStack.length === 0}>
              <RotateCw size={14} />
            </button>
            <div className="w-px h-5 bg-navy-700 mx-1" />
            <button onClick={() => setState((p) => ({ ...p, showGrid: !p.showGrid }))} className={`p-1.5 rounded-lg transition-colors ${state.showGrid ? 'text-cyan-400 bg-navy-800' : 'text-navy-400 hover:text-white'}`} title="Toggle grid (G)">
              <Grid3X3 size={14} />
            </button>
            <div className="w-px h-5 bg-navy-700 mx-1" />
            <button onClick={() => setState((p) => ({ ...p, zoom: Math.min(3, p.zoom + 0.25) }))} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors" title="Zoom in">
              <ZoomIn size={14} />
            </button>
            <span className="text-xs text-navy-400 w-10 text-center">{Math.round(state.zoom * 100)}%</span>
            <button onClick={() => setState((p) => ({ ...p, zoom: Math.max(0.25, p.zoom - 0.25) }))} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors" title="Zoom out">
              <ZoomOut size={14} />
            </button>
            <button onClick={() => setState((p) => ({ ...p, zoom: 1 }))} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors" title="Reset zoom">
              <Maximize2 size={14} />
            </button>
            <div className="w-px h-5 bg-navy-700 mx-1" />

            {/* Save status indicator */}
            <button
              onClick={handleManualSave}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                state.saveStatus === 'saved'
                  ? 'bg-green-900/30 text-green-400 border-green-700/50'
                  : state.saveStatus === 'saving'
                  ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50'
                  : 'bg-navy-800 text-navy-300 border-navy-700 hover:text-white'
              }`}
            >
              <Save size={12} />
              {state.saveStatus === 'saved' ? 'Saved' : state.saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 bg-navy-800 text-navy-300 border-navy-700 hover:text-white"
                title="Export canvas"
              >
                <Download size={12} />
                Export
                <ChevronDown size={10} />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-navy-800 border border-navy-700 rounded-xl shadow-xl z-50 py-1">
                    <button
                      onClick={handleExportPng}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-navy-300 hover:text-white hover:bg-navy-700 transition-colors"
                    >
                      <FileImage size={14} className="text-green-400" />
                      Export as PNG
                    </button>
                    <button
                      onClick={handleExportPdf}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-navy-300 hover:text-white hover:bg-navy-700 transition-colors"
                    >
                      <FileText size={14} className="text-red-400" />
                      Export as PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Version indicator */}
            <span className="text-[10px] text-navy-500 px-1">v{documentVersion}</span>

            <button
              onClick={() => setState((p) => ({ ...p, isLocked: !p.isLocked }))}
              className={`p-1.5 rounded-lg transition-colors ${state.isLocked ? 'text-red-400 bg-red-900/20' : 'text-navy-400 hover:text-white hover:bg-navy-800'}`}
              title={state.isLocked ? 'Unlock canvas' : 'Lock canvas'}
            >
              {state.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        </div>

        {/* Active tool indicator + shortcuts */}
        <div className="flex items-center gap-3 text-xs text-navy-400">
          <span>Tool: <span className="text-white">{state.activeTool.replace('_', ' ')}</span></span>
          <span>Layer: <span className={activeLayerMeta.colour}>{activeLayerMeta.label}</span></span>
          {isLayerLocked && (
            <span className="text-yellow-400 flex items-center gap-1">
              <Lock size={10} />
              {activeLayerMeta.readonly ? 'Read-only layer' : 'Canvas locked'}
            </span>
          )}
          {serverVersion && serverVersion > documentVersion && (
            <button
              onClick={() => setConflictWarning('Another user modified this canvas. Click to refresh.')}
              className="text-yellow-400 flex items-center gap-1 hover:text-yellow-300"
            >
              <AlertTriangle size={10} />
              Version conflict
            </button>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative border border-navy-700 rounded-xl overflow-hidden bg-navy-950"
          style={{ cursor: isLayerLocked ? 'not-allowed' : state.activeTool === 'eraser' ? 'cell' : 'crosshair' }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="w-full touch-none"
            role="img"
            aria-label="Annotation canvas for drawing and writing math-physics solutions"
            aria-roledescription="Drawing canvas with keyboard shortcuts"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Lock overlay */}
          {state.isLocked && (
            <div className="absolute inset-0 bg-navy-950/40 flex items-center justify-center">
              <div className="bg-navy-900/90 border border-navy-700 rounded-lg px-4 py-2 flex items-center gap-2">
                <Lock size={16} className="text-red-400" />
                <span className="text-sm text-white">Canvas is locked (submitted)</span>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="flex items-center gap-3 text-[10px] text-navy-600">
          {shortcuts.map((s) => (
            <span key={s.key}>
              <kbd className="px-1 py-0.5 bg-navy-800 rounded border border-navy-700 text-navy-400">{s.key}</kbd>
              {' '}{s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
