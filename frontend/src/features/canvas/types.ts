export type LayerType = 'question' | 'student' | 'teacher' | 'revision'

export type ToolType =
  | 'pen' | 'highlighter' | 'eraser'
  | 'text' | 'line' | 'arrow'
  | 'rectangle' | 'circle'
  | 'coordinate_axes' | 'grid' | 'vector' | 'force_arrow'
  | 'point_label' | 'angle_marker'
  | 'equation'

export interface Point {
  x: number
  y: number
}

export interface CanvasStroke {
  id: string
  tool: ToolType
  points: Point[]
  colour: string
  width: number
  opacity: number
  layer: LayerType
  text?: string
  fontSize?: number
  equationLatex?: string
  equationSvg?: string
  created_at: string
}

export interface CanvasDocument {
  id: string
  layer: LayerType
  strokes: CanvasStroke[]
  version: number
  created_at: string
  updated_at: string
}

export interface RubricCriterion {
  id: string
  name: string
  description: string
  max_score: number
  score: number | null
  levels: RubricLevel[]
}

export interface RubricLevel {
  label: string
  description: string
  score: number
}

export interface CanvasState {
  activeTool: ToolType
  activeColour: string
  activeWidth: number
  activeOpacity: number
  activeLayer: LayerType
  zoom: number
  panOffset: Point
  isPanning: boolean
  strokes: CanvasStroke[]
  undoStack: CanvasStroke[][]
  redoStack: CanvasStroke[][]
  showGrid: boolean
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'
  isLocked: boolean
}
