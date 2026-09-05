import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Loader2, Bot, User, GraduationCap, BookOpen, Award, Calendar } from 'lucide-react'
import { apiClient } from '@/api/client'

interface Message {
  role: 'user' | 'ai'
  text: string
  timestamp: Date
}

interface MelanyAssistantProps {
  contextType?: 'chat' | 'camp' | 'pathway' | 'certificate' | 'registration'
}

const QUICK_ACTIONS = [
  { icon: Calendar, label: 'Info Camp 2027', message: 'Ceritakan tentang program Camp 2027' },
  { icon: GraduationCap, label: 'University Pathways', message: 'Apa saja program universitas yang tersedia?' },
  { icon: BookOpen, label: 'Akses Materi', message: 'Bagaimana cara mengakses materi pembelajaran?' },
  { icon: Award, label: 'Sertifikat', message: 'Bagaimana cara mendapatkan sertifikat?' },
]

export function MelanyAssistant({ contextType = 'chat' }: MelanyAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (message?: string) => {
    const text = message || input.trim()
    if (!text || isLoading) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', text, timestamp: new Date() },
    ])
    setInput('')
    setIsLoading(true)

    try {
      const res = await apiClient.post<{ success: boolean; response: string }>(
        '/ai/melany-chat/',
        {
          context_type: contextType,
          message: text,
        }
      )

      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: res.response, timestamp: new Date() },
      ])
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Terjadi kesalahan. Silakan coba lagi.'
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: errorMsg, timestamp: new Date() },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-cyan-600 hover:bg-cyan-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-50 flex items-center gap-2 group"
        title="Tanya Melany AI"
      >
        <MessageSquare size={24} />
        <span className="font-semibold hidden group-hover:inline-block transition-all">
          Melany AI
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[550px] bg-navy-900 border border-navy-700 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-cyan-600 to-teal-600 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <div>
            <h3 className="font-bold text-sm">Melany AI</h3>
            <p className="text-xs opacity-80">Dharma Mardika Ecosystem</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-white/20 p-1 rounded transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-navy-950">
        {messages.length === 0 && (
          <div className="text-center mt-6 space-y-4">
            <Bot size={48} className="mx-auto text-cyan-400" />
            <p className="text-sm text-navy-300 font-medium">
              Halo! Saya Melany AI 👋
            </p>
            <p className="text-xs text-navy-500 px-4">
              Saya membantu Anda menavigasi ekosistem Dharma Mardika - Camp, University Pathways, Materials, dan Sertifikat.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.message)}
                  className="flex items-center gap-2 p-2 bg-navy-800 rounded border border-navy-700 hover:border-cyan-400 text-navy-300 text-xs transition-colors text-left"
                >
                  <action.icon size={14} className="text-cyan-400 shrink-0" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg text-sm flex gap-2 ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none'
                  : 'bg-navy-800 text-navy-200 rounded-bl-none border border-navy-700'
              }`}
            >
              {msg.role === 'ai' && <Bot size={16} className="flex-shrink-0 mt-0.5 text-cyan-400" />}
              {msg.role === 'user' && <User size={16} className="flex-shrink-0 mt-0.5" />}
              <div className="whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-navy-800 p-3 rounded-lg rounded-bl-none border border-navy-700 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-cyan-400" />
              <span className="text-xs text-navy-400">Melany sedang berpikir...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-navy-700 bg-navy-900">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan tentang Camp, Universitas, Materi, atau Sertifikat..."
            rows={2}
            className="flex-1 p-2 text-sm bg-navy-800 border border-navy-700 rounded-md text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="bg-cyan-600 hover:bg-cyan-700 text-white p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-navy-600 mt-1 text-center">
          Enter untuk kirim
        </p>
      </div>
    </div>
  )
}
