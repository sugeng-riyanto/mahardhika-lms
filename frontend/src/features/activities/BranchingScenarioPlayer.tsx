/**
 * Branching Scenario Player — Interactive decision-path learning.
 *
 * Stores the scenario graph in ActivityDefinition.content as:
 * {
 *   start_node: string,
 *   nodes: {
 *     [id: string]: {
 *       id: string,
 *       type: 'decision' | 'content' | 'outcome',
 *       title: string,
 *       content: string,
 *       image_url?: string,
 *       choices?: [{ id: string, text: string, next_node: string, feedback?: string }],
 *       outcome?: 'success' | 'partial' | 'failure',
 *       score?: number,
 *       feedback?: string,
 *     }
 *   }
 * }
 *
 * The player tracks the user's path, records each decision, and
 * computes a final score based on the outcome node reached.
 */
import { useState, useCallback, useMemo } from 'react'
import {
  ArrowRight, Trophy, XCircle,
  Map, RotateCcw, ChevronRight, AlertCircle, Star,
} from 'lucide-react'

export interface ScenarioNode {
  id: string
  type: 'decision' | 'content' | 'outcome'
  title: string
  content: string
  image_url?: string
  choices?: Array<{
    id: string
    text: string
    next_node: string
    feedback?: string
  }>
  outcome?: 'success' | 'partial' | 'failure'
  score?: number
  feedback?: string
}

export interface ScenarioGraph {
  start_node: string
  nodes: Record<string, ScenarioNode>
}

interface PathEntry {
  node_id: string
  choice_id?: string
  timestamp: string
}

interface BranchingScenarioPlayerProps {
  graph: ScenarioGraph
  activityTitle: string
  onComplete: (result: { path: PathEntry[]; score: number; maxScore: number; outcome: string }) => void
  showMap?: boolean
}

export function BranchingScenarioPlayer({
  graph,
  activityTitle,
  onComplete,
  showMap = true,
}: BranchingScenarioPlayerProps) {
  const [currentNodeId, setCurrentNodeId] = useState(graph.start_node)
  const [path, setPath] = useState<PathEntry[]>([])
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [showPathMap, setShowPathMap] = useState(false)

  const currentNode = graph.nodes[currentNodeId]

  // Calculate max possible score (sum of all outcome node scores)
  const maxScore = useMemo(() => {
    return Object.values(graph.nodes)
      .filter(n => n.type === 'outcome')
      .reduce((sum, n) => sum + (n.score || 0), 0)
  }, [graph])

  // Build path names for the map
  const visitedNodes = useMemo(() => new Set(path.map(p => p.node_id)), [path])

  const handleChoice = useCallback((choiceId: string) => {
    if (!currentNode || !currentNode.choices) return
    setSelectedChoice(choiceId)
    setShowFeedback(true)
  }, [currentNode])

  const handleContinue = useCallback(() => {
    if (!currentNode || !currentNode.choices || !selectedChoice) return

    const choice = currentNode.choices.find(c => c.id === selectedChoice)
    if (!choice) return

    // Record the path entry
    const entry: PathEntry = {
      node_id: currentNodeId,
      choice_id: selectedChoice,
      timestamp: new Date().toISOString(),
    }

    const newPath = [...path, entry]
    setPath(newPath)

    // Move to next node
    const nextNode = graph.nodes[choice.next_node]
    if (nextNode) {
      setCurrentNodeId(choice.next_node)
      setSelectedChoice(null)
      setShowFeedback(false)

      // If next node is an outcome, complete
      if (nextNode.type === 'outcome') {
        setCompleted(true)
        onComplete({
          path: newPath,
          score: nextNode.score || 0,
          maxScore,
          outcome: nextNode.outcome || 'unknown',
        })
      }
    }
  }, [currentNode, currentNodeId, selectedChoice, path, graph, maxScore, onComplete])

  const handleRestart = useCallback(() => {
    setCurrentNodeId(graph.start_node)
    setPath([])
    setSelectedChoice(null)
    setShowFeedback(false)
    setCompleted(false)
  }, [graph])

  if (!currentNode) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-white text-lg">Scenario node not found.</p>
        <p className="text-navy-400 text-sm mt-2">The scenario graph is invalid or missing the start node.</p>
      </div>
    )
  }

  // Outcome screen
  if (completed && currentNode.type === 'outcome') {
    const outcomeConfig = {
      success: { icon: <Trophy size={48} className="text-yellow-400" />, color: 'green', label: 'Success!' },
      partial: { icon: <Star size={48} className="text-orange-400" />, color: 'yellow', label: 'Partially Complete' },
      failure: { icon: <XCircle size={48} className="text-red-400" />, color: 'red', label: 'Outcome' },
      unknown: { icon: <Trophy size={48} className="text-navy-400" />, color: 'navy', label: 'Complete' },
    }
    const config = outcomeConfig[currentNode.outcome as keyof typeof outcomeConfig] || outcomeConfig.unknown

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-8 text-center">
          {config.icon}
          <h2 className="text-2xl font-bold text-white mt-4 mb-2">{config.label}</h2>
          <p className="text-navy-400 text-sm mb-2">{activityTitle}</p>

          {currentNode.title && (
            <h3 className="text-lg font-semibold text-white mt-4 mb-2">{currentNode.title}</h3>
          )}
          <p className="text-navy-300 mb-6">{currentNode.content}</p>

          {currentNode.feedback && (
            <div className={`bg-${config.color}-900/20 border border-${config.color}-700/30 rounded-lg p-4 mb-6 text-left`}>
              <p className={`text-${config.color}-300 text-sm`}>{currentNode.feedback}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-navy-900 rounded-lg p-4">
              <p className="text-3xl font-bold text-cyan-400">{currentNode.score || 0}</p>
              <p className="text-navy-400 text-sm">Score</p>
            </div>
            <div className="bg-navy-900 rounded-lg p-4">
              <p className="text-3xl font-bold text-purple-400">{path.length}</p>
              <p className="text-navy-400 text-sm">Decisions Made</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 py-3 bg-navy-700 hover:bg-navy-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} /> Try Different Path
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Path map sidebar
  const pathMapContent = (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Map size={14} /> Your Path
        </h3>
        <button
          onClick={() => setShowPathMap(!showPathMap)}
          className="text-navy-400 hover:text-white text-xs"
        >
          {showPathMap ? 'Hide' : 'Show'}
        </button>
      </div>
      {showPathMap && (
        <div className="space-y-2">
          {path.map((entry, i) => {
            const node = graph.nodes[entry.node_id]
            const choice = node?.choices?.find(c => c.id === entry.choice_id)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-5 h-5 bg-cyan-900/50 rounded-full flex items-center justify-center text-cyan-400 font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate">{node?.title || entry.node_id}</p>
                  {choice && (
                    <p className="text-navy-400 truncate">→ {choice.text}</p>
                  )}
                </div>
              </div>
            )
          })}
          {/* Current node */}
          <div className="flex items-center gap-2 text-xs">
            <div className="w-5 h-5 bg-green-900/50 rounded-full flex items-center justify-center text-green-400 font-bold shrink-0">
              {path.length + 1}
            </div>
            <p className="text-green-400 font-medium truncate">{currentNode.title || currentNodeId}</p>
          </div>
        </div>
      )}
    </div>
  )

  // Decision node
  if (currentNode.type === 'decision' || currentNode.type === 'content') {
    const selectedChoiceData = currentNode.choices?.find(c => c.id === selectedChoice)

    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-navy-800 border border-navy-700 rounded-xl px-4 py-3">
          <div>
            <h1 className="text-white font-semibold text-sm">{activityTitle}</h1>
            <p className="text-navy-400 text-xs">Step {path.length + 1} • {visitedNodes.size} nodes visited</p>
          </div>
        </div>

        {showMap && pathMapContent}

        {/* Content node */}
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
          {currentNode.title && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-medium text-cyan-400 uppercase px-2 py-1 bg-cyan-900/30 rounded">
                {currentNode.type === 'content' ? 'Scene' : 'Decision'}
              </span>
              <span className="text-xs font-medium text-purple-400 uppercase px-2 py-1 bg-purple-900/30 rounded">
                {currentNode.title}
              </span>
            </div>
          )}

          {currentNode.image_url && (
            <img
              src={currentNode.image_url}
              alt={currentNode.title}
              className="w-full rounded-lg mb-4 max-h-64 object-cover"
            />
          )}

          <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">{currentNode.content}</p>

          {/* Feedback from previous choice */}
          {showFeedback && selectedChoiceData?.feedback && (
            <div className="mt-4 bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-4">
              <p className="text-cyan-300 text-sm italic">💬 {selectedChoiceData.feedback}</p>
            </div>
          )}
        </div>

        {/* Choices */}
        {currentNode.choices && currentNode.choices.length > 0 && (
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">What do you do?</h3>
            <div className="space-y-3">
              {currentNode.choices.map((choice) => {
                const isSelected = selectedChoice === choice.id
                const isClickable = !showFeedback || !selectedChoice
                return (
                  <button
                    key={choice.id}
                    onClick={() => isClickable && handleChoice(choice.id)}
                    disabled={!isClickable}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-900/20 text-white'
                        : isClickable
                          ? 'border-navy-600 bg-navy-900 text-navy-300 hover:border-navy-500 hover:text-white cursor-pointer'
                          : 'border-navy-700 bg-navy-900/50 text-navy-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold shrink-0 ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-400'
                          : 'border-navy-600 text-navy-400'
                      }`}>
                        {isSelected ? '✓' : choice.id.toUpperCase()}
                      </span>
                      <span className="flex-1">{choice.text}</span>
                      {isClickable && (
                        <ChevronRight size={16} className="text-navy-500 shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Continue button */}
        {showFeedback && selectedChoice && (
          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-semibold transition-all"
            >
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}

// ── Scenario Builder for Instructors ────────────────────────

export interface ScenarioBuilderNode {
  id: string
  type: 'decision' | 'content' | 'outcome'
  title: string
  content: string
  image_url?: string
  choices?: Array<{
    id: string
    text: string
    next_node: string
    feedback?: string
  }>
  outcome?: 'success' | 'partial' | 'failure'
  score?: number
  feedback?: string
}

export function createEmptyScenario(): ScenarioGraph {
  const startId = 'node_1'
  return {
    start_node: startId,
    nodes: {
      [startId]: {
        id: startId,
        type: 'decision',
        title: 'Introduction',
        content: 'Describe the scenario...',
        choices: [],
      },
    },
  }
}

export function addNodeToScenario(
  graph: ScenarioGraph,
  sourceNodeId: string,
  choiceId: string,
): ScenarioGraph {
  const newId = `node_${Object.keys(graph.nodes).length + 1}`
  const sourceNode = graph.nodes[sourceNodeId]
  if (!sourceNode) return graph

  const newNode: ScenarioNode = {
    id: newId,
    type: 'decision',
    title: 'New Decision',
    content: 'What happens next?',
    choices: [],
  }

  // Update the choice to point to new node
  const updatedChoices = (sourceNode.choices || []).map(c =>
    c.id === choiceId ? { ...c, next_node: newId } : c
  )

  return {
    ...graph,
    nodes: {
      ...graph.nodes,
      [sourceNodeId]: { ...sourceNode, choices: updatedChoices },
      [newId]: newNode,
    },
  }
}

export function addOutcomeToScenario(
  graph: ScenarioGraph,
  sourceNodeId: string,
  choiceId: string,
  outcome: 'success' | 'partial' | 'failure',
  score: number,
): ScenarioGraph {
  const newId = `outcome_${Object.keys(graph.nodes).length + 1}`
  const sourceNode = graph.nodes[sourceNodeId]
  if (!sourceNode) return graph

  const outcomeNode: ScenarioNode = {
    id: newId,
    type: 'outcome',
    title: outcome === 'success' ? 'Success!' : outcome === 'partial' ? 'Partial Success' : 'Failure',
    content: outcome === 'success'
      ? 'Great job! You made the right decision.'
      : outcome === 'partial'
        ? 'You could have done better.'
        : 'That wasn\'t the best choice.',
    outcome,
    score,
  }

  const updatedChoices = (sourceNode.choices || []).map(c =>
    c.id === choiceId ? { ...c, next_node: newId } : c
  )

  return {
    ...graph,
    nodes: {
      ...graph.nodes,
      [sourceNodeId]: { ...sourceNode, choices: updatedChoices },
      [newId]: outcomeNode,
    },
  }
}
