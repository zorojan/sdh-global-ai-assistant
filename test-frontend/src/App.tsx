import React, { useState, useRef, useEffect } from 'react'
import { GeminiLiveClient } from './gemini-live-client'
import { OpenAIRealtimeClient } from './openai-realtime-client'

type Provider = 'gemini' | 'openai'
type Mode = 'chat' | 'audio'

interface Message {
  id: string
  text: string
  sender: 'user' | 'ai'
  timestamp: number
}

interface Agent {
  id: string
  name: string
  personality: string
  language: string
  voice: string
  body_color?: string
}

const API_URL = 'http://localhost:3001'

function App() {
  const [provider, setProvider] = useState<Provider>('gemini')
  const [mode, setMode] = useState<Mode>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  // Audio clients
  const geminiClientRef = useRef<GeminiLiveClient | null>(null)
  const openaiClientRef = useRef<OpenAIRealtimeClient | null>(null)
  const [apiKeys, setApiKeys] = useState<{gemini: string, openai: string}>({
    gemini: '',
    openai: ''
  })

  // Load agents and API keys on component mount
  useEffect(() => {
    loadAgents()
    loadApiKeys()
  }, [])

  const loadAgents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/agents`)
      if (response.ok) {
        const agentsData = await response.json()
        if (agentsData.length > 0) {
          setSelectedAgent(agentsData[0])
        }
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const loadApiKeys = async () => {
    try {
      console.log('🔄 Loading API keys from backend...')
      const response = await fetch(`${API_URL}/api/settings/api-keys`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const apiKeysData = await response.json()
      console.log('📦 Loaded API keys:', apiKeysData)
      
      const geminiKey = apiKeysData.gemini || ''
      const openaiKey = apiKeysData.openai || ''
      
      console.log('🔑 Found keys:', {
        gemini: geminiKey ? `${geminiKey.substring(0, 10)}...` : 'NOT FOUND',
        openai: openaiKey ? `${openaiKey.substring(0, 10)}...` : 'NOT FOUND'
      })
      
      setApiKeys({ gemini: geminiKey, openai: openaiKey })
      
      if (!geminiKey && !openaiKey) {
        setError('No API keys found! Please configure them in admin panel: http://localhost:3000')
      }
    } catch (error) {
      console.error('❌ Failed to load API keys:', error)
      setError(`Failed to load API keys: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure backend is running on port 3001.`)
    }
  }

  const sendChatMessage = async (message: string) => {
    if (!message.trim()) return

    setIsLoading(true)
    setError(null)
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString() + '_user',
      text: message,
      sender: 'user',
      timestamp: Date.now()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch(`${API_URL}/api/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          agentId: selectedAgent?.id || 'default'
        })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMessage: Message = {
          id: Date.now().toString() + '_ai',
          text: data.response,
          sender: 'ai',
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setError(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMessage.trim() && !isLoading) {
      sendChatMessage(inputMessage)
      setInputMessage('')
    }
  }

  const startAudioSession = async () => {
    try {
      setError(null)
      setIsLoading(true)

      console.log('🔑 API Keys:', apiKeys)
      console.log('🤖 Provider:', provider)
      
      const apiKey = provider === 'gemini' ? apiKeys.gemini : apiKeys.openai
      if (!apiKey || apiKey.trim() === '') {
        // Try to reload API keys
        console.log('🔄 Reloading API keys...')
        await loadApiKeys()
        const reloadedKey = provider === 'gemini' ? apiKeys.gemini : apiKeys.openai
        if (!reloadedKey || reloadedKey.trim() === '') {
          throw new Error(`${provider} API key not found. Please configure it in admin panel.`)
        }
        console.log('✅ API key loaded after reload')
      } else {
        console.log('✅ API key found:', apiKey.substring(0, 10) + '...')
      }

      // Initialize appropriate client
      if (provider === 'gemini') {
        geminiClientRef.current = new GeminiLiveClient(apiKey)
        
        geminiClientRef.current.onMessage((message: string) => {
          const aiMessage: Message = {
            id: Date.now().toString() + '_ai_voice',
            text: message,
            sender: 'ai',
            timestamp: Date.now()
          }
          setMessages(prev => [...prev, aiMessage])
        })
        
        geminiClientRef.current.onError((error: string) => {
          setError(`Gemini Live: ${error}`)
        })
        
        await geminiClientRef.current.connect(selectedAgent)
        await geminiClientRef.current.startRecording()
        
      } else {
        openaiClientRef.current = new OpenAIRealtimeClient(apiKey)
        
        openaiClientRef.current.onMessage((message: string) => {
          const aiMessage: Message = {
            id: Date.now().toString() + '_ai_voice',
            text: message,
            sender: 'ai',
            timestamp: Date.now()
          }
          setMessages(prev => [...prev, aiMessage])
        })
        
        openaiClientRef.current.onError((error: string) => {
          setError(`OpenAI Realtime: ${error}`)
        })
        
        await openaiClientRef.current.connect(selectedAgent)
        await openaiClientRef.current.startRecording()
      }
      
      setIsListening(true)
      
      // Add connection status message
      const statusMessage: Message = {
        id: Date.now().toString() + '_status',
        text: `🎤 ${provider === 'gemini' ? 'Gemini Live' : 'OpenAI Realtime'} voice session started`,
        sender: 'ai',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, statusMessage])
      
    } catch (error) {
      console.error('Audio session failed:', error)
      setError(`Voice session failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const stopAudioSession = () => {
    try {
      if (geminiClientRef.current) {
        geminiClientRef.current.disconnect()
        geminiClientRef.current = null
      }
      
      if (openaiClientRef.current) {
        openaiClientRef.current.disconnect()
        openaiClientRef.current = null
      }
      
      setIsListening(false)
      
      // Add disconnection message
      const statusMessage: Message = {
        id: Date.now().toString() + '_status',
        text: `🔇 Voice session ended`,
        sender: 'ai',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, statusMessage])
      
    } catch (error) {
      console.error('Stop audio session error:', error)
    }
  }

  const toggleVoiceMode = () => {
    if (isListening) {
      stopAudioSession()
    } else {
      startAudioSession()
    }
  }

  const clearMessages = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div className="container">
      <h1>🤖 SDH AI Test - Gemini & OpenAI</h1>
      
      {error && (
        <div className="error">
          ⚠️ {error}
        </div>
      )}

      {/* Provider Selection */}
      <div className="provider-selector">
        <button 
          className={`provider-button ${provider === 'gemini' ? 'active' : ''}`}
          onClick={() => setProvider('gemini')}
        >
          🤖 Gemini Live
        </button>
        <button 
          className={`provider-button ${provider === 'openai' ? 'active' : ''}`}
          onClick={() => setProvider('openai')}
        >
          ⚡ OpenAI Realtime
        </button>
      </div>

      {/* Mode Selection */}
      <div className="mode-selector">
        <button 
          className={`mode-button ${mode === 'chat' ? 'active' : ''}`}
          onClick={() => setMode('chat')}
        >
          💬 Text Chat
        </button>
        <button 
          className={`mode-button ${mode === 'audio' ? 'active' : ''}`}
          onClick={() => setMode('audio')}
        >
          🎤 Voice Mode
        </button>
      </div>

      {/* Agent Selection */}
      {selectedAgent && (
        <div className="status">
          Current Agent: <strong>{selectedAgent.name}</strong> 
          ({selectedAgent.language}) - {provider === 'gemini' ? '🤖 Gemini' : '⚡ OpenAI'}
        </div>
      )}

      {/* API Key Status */}
      <div className="status">
        🔑 API Keys: 
        Gemini {apiKeys.gemini ? '✅' : '❌'} | 
        OpenAI {apiKeys.openai ? '✅' : '❌'} 
        {(!apiKeys.gemini || !apiKeys.openai) && (
          <>
            {' '}
            <button 
              onClick={loadApiKeys}
              style={{
                background: 'rgba(255,255,255,0.2)', 
                border: '1px solid white', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔄 Reload Keys
            </button>
          </>
        )}
      </div>

      {/* Chat Messages */}
      <div className="chat-container">
        {messages.length === 0 ? (
          <div className="status">
            👋 Welcome! Choose your AI provider and start chatting or use voice mode.
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.sender}`}>
              {message.text}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="message ai">
            <em>🤔 {provider === 'gemini' ? 'Gemini' : 'OpenAI'} is thinking...</em>
          </div>
        )}
      </div>

      {/* Input Interface */}
      {mode === 'chat' ? (
        <form onSubmit={handleSendMessage} className="input-container">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Ask ${provider === 'gemini' ? 'Gemini' : 'OpenAI'} anything...`}
            className="message-input"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="send-button"
            disabled={isLoading || !inputMessage.trim()}
          >
            {isLoading ? '⏳' : '📤'} Send
          </button>
        </form>
      ) : (
        <div className="input-container">
          <button 
            onClick={toggleVoiceMode}
            className={`voice-button ${isListening ? 'listening' : ''}`}
            disabled={isLoading}
          >
            {isListening ? '🔴 Stop Recording' : '🎤 Start Voice Chat'}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="input-container">
        <button 
          onClick={clearMessages}
          className="mode-button"
          style={{ flex: 1 }}
        >
          🗑️ Clear Messages
        </button>
      </div>
    </div>
  )
}

export default App