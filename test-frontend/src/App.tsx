

import React, { useState, useRef, useEffect } from 'react';
import { GeminiLiveClient } from './gemini-live-client-new';
import { OpenAIRealtimeClient } from './openai-realtime-client-simple';
import './App.css';

// Тип для лога AI-запроса
interface AIRequestLog {
  timestamp: number;
  provider: string;
  mode: string;
  model: string;
  endpoint: string;
  prompt: string;
  params?: any;
  response?: string;
}

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
  system_prompt?: string
  voice_language?: string
  knowledge_base?: string
}

interface DiagnosticsData {
  // Models
  gemini_model?: string
  message_dialog_model?: string
  default_model?: string
  openai_model?: string
  
  // Languages
  default_language?: string
  gemini_default_language?: string
  realtime_language?: string
  openai_chat_language?: string
  
  // Company info
  company_name?: string
  company_description?: string
  company_website?: string
  company_documents?: string
  
  // AI Provider
  ai_provider?: string
  
  // Current agent data
  current_agent?: Agent
}

const API_URL = 'http://localhost:3001'

function App() {
  const [aiRequestLogs, setAIRequestLogs] = useState<AIRequestLog[]>([]);
  const [initialSessionLogs, setInitialSessionLogs] = useState<AIRequestLog[]>([]);
  const [provider, setProvider] = useState<Provider>('gemini')
  const [mode, setMode] = useState<Mode>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData>({})
  const [showDiagnostics, setShowDiagnostics] = useState(true)

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
    loadDiagnosticsData()
  }, [])

  // Update diagnostics when agent or provider changes
  useEffect(() => {
    updateCurrentDiagnostics()
  }, [selectedAgent, provider, mode])

  // Helper to compute the actual model selected for a provider+mode
  const computeModelFor = (prov: Provider, m: Mode) => {
    if (prov === 'gemini') {
      if (m === 'audio') {
        return diagnostics.default_model || diagnostics.gemini_model || 'gemini-2.5-flash-preview-native-audio-dialog'
      }
      // chat
      return diagnostics.message_dialog_model || diagnostics.gemini_model || 'gemini-2.5-flash'
    }
    // openai
    return diagnostics.openai_model || (m === 'audio' ? 'gpt-4o-realtime-preview' : 'gpt-4o-mini')
  }

  // Helper to compute the TTS model (for Gemini) or general tts model setting
  const computeTTSModel = (prov: Provider) => {
    if (prov === 'gemini') {
      // prefer explicit gemini tts setting, then a general default_tts_model, otherwise fallbacks
      // common admin key names we might have: gemini_tts_model, default_tts_model
      // try a few possibilities from diagnostics
      return (
        (diagnostics as any).gemini_tts_model ||
        (diagnostics as any).default_tts_model ||
        (diagnostics as any).openai_tts_model ||
        'gemini-2.5-flash'
      )
    }
    // for OpenAI use configured tts or default
    return (diagnostics as any).openai_tts_model || (diagnostics as any).default_tts_model || 'gpt-4o-mini-tts'
  }

  const loadAgents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/agents`)
      if (response.ok) {
        const agentsData = await response.json()
        setAgents(agentsData)
        if (agentsData.length > 0) {
          setSelectedAgent(agentsData[0])
        }
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const loadDiagnosticsData = async () => {
    try {
      console.log('🔍 Loading diagnostics data...')
      
      // Load all settings via the new public endpoint
      const response = await fetch(`${API_URL}/api/settings/diagnostics`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Diagnostics data loaded:', data)
        setDiagnostics(data)
      } else {
        console.warn('Diagnostics endpoint not available, using limited data')
      }
    } catch (error) {
      console.error('Failed to load diagnostics:', error)
    }
  }

  const updateCurrentDiagnostics = () => {
    if (selectedAgent) {
      setDiagnostics(prev => ({
        ...prev,
        current_agent: selectedAgent
      }))
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

  // Логируем initial payload при смене режима или агента
  useEffect(() => {
    if (!selectedAgent) return;
    const model = computeModelFor(provider, mode);
    const systemPrompt = selectedAgent?.system_prompt || '';
    const logEntry: AIRequestLog = {
      timestamp: Date.now(),
      provider,
      mode,
      model,
      endpoint: provider === 'gemini' ? (mode === 'chat' ? 'Gemini Chat' : 'Gemini Audio') : (mode === 'chat' ? 'OpenAI Chat' : 'OpenAI Audio'),
      prompt: systemPrompt,
      params: {
        agentId: selectedAgent?.id,
        agentName: selectedAgent?.name,
        language: selectedAgent?.language,
        model,
        ttsModel: computeTTSModel(provider)
      }
    };
    setInitialSessionLogs(prev => [logEntry, ...prev.slice(0, 9)]);
  }, [provider, mode, selectedAgent]);

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

    // Формируем лог запроса
    const chatModel = computeModelFor(provider, 'chat')
    const systemPrompt = selectedAgent?.system_prompt || ''
    const fullPrompt = `${systemPrompt}\nUser: ${message}`
    const logEntry: AIRequestLog = {
      timestamp: Date.now(),
      provider,
      mode: 'chat',
      model: chatModel,
      endpoint: provider === 'gemini' ? 'Gemini Chat' : 'OpenAI Chat',
      prompt: fullPrompt,
      params: {
        agentId: selectedAgent?.id,
        agentName: selectedAgent?.name,
        language: selectedAgent?.language,
        model: chatModel
      }
    }

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
        // Добавляем лог с ответом
        setAIRequestLogs(prev => [
          {
            ...logEntry,
            response: data.response
          },
          ...prev.slice(0, 9)
        ])
      } else {
        setAIRequestLogs(prev => [logEntry, ...prev.slice(0, 9)])
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

      // Log the connect-time payload (one-time initial payload sent to provider)
      try {
          const connectModel = computeModelFor(provider, 'audio')
          const ttsModel = computeTTSModel(provider)
            const systemPrompt = selectedAgent?.system_prompt || ''
            const connectLog: AIRequestLog = {
              timestamp: Date.now(),
              provider,
              mode: 'audio',
              model: connectModel,
              endpoint: provider === 'gemini' ? 'Gemini Connect' : 'OpenAI Connect',
              prompt: systemPrompt,
              params: {
                agentId: selectedAgent?.id,
                agentName: selectedAgent?.name,
                language: selectedAgent?.language,
                model: connectModel,
                ttsModel
              }
            }
            setAIRequestLogs(prev => [connectLog, ...prev.slice(0, 9)])
      } catch (err) {
        console.warn('Failed to log connect payload:', err)
      }

      // Initialize appropriate client
      if (provider === 'gemini') {
        geminiClientRef.current = new GeminiLiveClient(apiKey)
        
        geminiClientRef.current!.onMessage((message: string) => {
          const aiMessage: Message = {
            id: Date.now().toString() + '_ai_voice',
            text: message,
            sender: 'ai',
            timestamp: Date.now()
          }
          setMessages(prev => [...prev, aiMessage])
        })
        
        geminiClientRef.current!.onError((error: string) => {
          setError(`Gemini Live: ${error}`)
        })
        
        await geminiClientRef.current!.connect(selectedAgent, { model: computeModelFor(provider, 'audio'), ttsModel: computeTTSModel(provider) })
        await geminiClientRef.current!.startRecording()
        
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
        
        await openaiClientRef.current.connect()
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

      {/* Agent Selector */}
      <div className="agent-selector" style={{ marginBottom: 12 }}>
        <label htmlFor="agent-select" style={{ marginRight: 8, fontWeight: 500 }}>Agent:</label>
        <select
          id="agent-select"
          value={selectedAgent?.id || ''}
          onChange={e => {
            const agentId = e.target.value;
            setSelectedAgent(prev => agents.find((a: Agent) => a.id === agentId) || prev);
          }}
          style={{ padding: '6px 12px', borderRadius: 6, fontSize: 14 }}
        >
          {agents && agents.length > 0 ? (
            agents.map((agent: Agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.language})
              </option>
            ))
          ) : (
            <option value="">No agents</option>
          )}
        </select>
      </div>

      {/* Current Agent Status */}
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

      {/* Initial Session Log */}
      {initialSessionLogs.length > 0 && (
        <div className="ai-request-log" style={{margin: '18px 0', background: '#e8f0ff', border: '1px solid #7da0d0', borderRadius: 8, padding: 12}}>
          <h3 style={{margin: '0 0 8px 0', fontSize: 15}}>🟦 Initial Session Log (last 10)</h3>
          {initialSessionLogs.map((log, idx) => (
            <div key={log.timestamp + '-' + idx} style={{marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #eee'}}>
              <div style={{fontSize: 12, color: '#336'}}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.provider.toUpperCase()} / {log.mode} / <b>{log.model}</b>
              </div>
              <div style={{fontSize: 12}}><b>Endpoint:</b> {log.endpoint}</div>
              <div style={{fontSize: 12}}><b>Initial System Prompt:</b> <span style={{color:'#333'}}>{log.prompt}</span></div>
              {log.params && (
                <div style={{fontSize: 12}}><b>Params:</b> {JSON.stringify(log.params)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI Request Log */}
      {aiRequestLogs.length > 0 && (
        <div className="ai-request-log" style={{margin: '18px 0', background: '#f6f6f6', border: '1px solid #ccc', borderRadius: 8, padding: 12}}>
          <h3 style={{margin: '0 0 8px 0', fontSize: 15}}>📝 AI Request Log (last 10)</h3>
          {aiRequestLogs.map((log, idx) => (
            <div key={log.timestamp + '-' + idx} style={{marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #eee'}}>
              <div style={{fontSize: 12, color: '#888'}}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.provider.toUpperCase()} / {log.mode} / <b>{log.model}</b>
              </div>
              <div style={{fontSize: 12}}><b>Endpoint:</b> {log.endpoint}</div>
              <div style={{fontSize: 12}}><b>Prompt:</b> <span style={{color:'#333'}}>{log.prompt}</span></div>
              {log.params && (
                <div style={{fontSize: 12}}><b>Params:</b> {JSON.stringify(log.params)}</div>
              )}
              {log.response && (
                <div style={{fontSize: 12, color: '#0a0'}}><b>Response:</b> {log.response}</div>
              )}
            </div>
          ))}
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
        <button 
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="mode-button"
          style={{ flex: 1 }}
        >
          {showDiagnostics ? '🔍 Hide Debug' : '🔍 Show Debug'}
        </button>
      </div>

      {/* Diagnostics Panel */}
      {showDiagnostics && (
        <div className="diagnostics-panel">
          <h3>🔍 Debug Info - Current Configuration</h3>
          
          <div className="diagnostics-grid">
            {/* Current Context */}
            <div className="diagnostics-section">
              <h4>📋 Current Context</h4>
              <div className="diagnostics-item">
                <strong>AI Provider:</strong> {provider} ({diagnostics.ai_provider || 'unknown'})
              </div>
              <div className="diagnostics-item">
                <strong>Mode:</strong> {mode}
              </div>
              <div className="diagnostics-item">
                <strong>Agent:</strong> {selectedAgent?.name || 'none'} ({selectedAgent?.id || 'none'})
              </div>
            </div>

            {/* Models Configuration */}
            <div className="diagnostics-section">
              <h4>🤖 Models</h4>
              <div className="diagnostics-item">
                <strong>Chat Model ({provider}):</strong> {
                  provider === 'gemini' 
                    ? (diagnostics.message_dialog_model || diagnostics.gemini_model || 'default')
                    : (diagnostics.openai_model || 'default')
                }
              </div>
              <div className="diagnostics-item">
                <strong>Audio Model ({provider}):</strong> {
                  provider === 'gemini' 
                    ? (diagnostics.default_model || 'gemini-2.5-flash-preview-native-audio-dialog')
                    : (diagnostics.openai_model || 'gpt-4o-realtime-preview')
                }
              </div>
              <div className="diagnostics-item">
                <strong>All Models:</strong>
                <ul style={{fontSize: '11px', margin: '2px 0', paddingLeft: '15px'}}>
                  {diagnostics.gemini_model && <li>Gemini: {diagnostics.gemini_model}</li>}
                  {diagnostics.message_dialog_model && <li>Dialog: {diagnostics.message_dialog_model}</li>}
                  {diagnostics.default_model && <li>Default: {diagnostics.default_model}</li>}
                  {diagnostics.openai_model && <li>OpenAI: {diagnostics.openai_model}</li>}
                </ul>
              </div>
            </div>

            {/* Language Configuration */}
            <div className="diagnostics-section">
              <h4>🌐 Languages</h4>
              <div className="diagnostics-item">
                <strong>Agent Language:</strong> {selectedAgent?.language || 'none'}
              </div>
              <div className="diagnostics-item">
                <strong>Agent Voice Language:</strong> {selectedAgent?.voice_language || 'none'}
              </div>
              <div className="diagnostics-item">
                <strong>Provider Language ({provider}):</strong> {
                  provider === 'gemini' 
                    ? (diagnostics.gemini_default_language || 'default')
                    : (mode === 'audio' ? diagnostics.realtime_language : diagnostics.openai_chat_language || 'default')
                }
              </div>
              <div className="diagnostics-item">
                <strong>Global Default:</strong> {diagnostics.default_language || 'auto'}
              </div>
            </div>

            {/* Agent Configuration */}
            <div className="diagnostics-section">
              <h4>🤖 Agent Details</h4>
              <div className="diagnostics-item">
                <strong>Voice:</strong> {selectedAgent?.voice || 'none'}
              </div>
              <div className="diagnostics-item">
                <strong>Body Color:</strong> {selectedAgent?.body_color || 'none'}
              </div>
              <div className="diagnostics-item">
                <strong>Personality:</strong> 
                <div style={{fontSize: '11px', maxHeight: '60px', overflow: 'auto', background: 'rgba(0,0,0,0.1)', padding: '4px', borderRadius: '4px', margin: '2px 0'}}>
                  {selectedAgent?.personality || 'none'}
                </div>
              </div>
              <div className="diagnostics-item">
                <strong>System Prompt:</strong> 
                <div style={{fontSize: '11px', maxHeight: '60px', overflow: 'auto', background: 'rgba(0,0,0,0.1)', padding: '4px', borderRadius: '4px', margin: '2px 0'}}>
                  {selectedAgent?.system_prompt || 'none'}
                </div>
              </div>
            </div>

            {/* Company Configuration */}
            <div className="diagnostics-section">
              <h4>🏢 Company Context</h4>
              <div className="diagnostics-item">
                <strong>Name:</strong> {diagnostics.company_name || 'none'}
              </div>
              <div className="diagnostics-item">
                <strong>Website:</strong> {diagnostics.company_website || 'none'}
              </div>
              <div className="diagnostics-item">
                <strong>Description:</strong> 
                <div style={{fontSize: '11px', maxHeight: '40px', overflow: 'auto', background: 'rgba(0,0,0,0.1)', padding: '4px', borderRadius: '4px', margin: '2px 0'}}>
                  {diagnostics.company_description || 'none'}
                </div>
              </div>
              <div className="diagnostics-item">
                <strong>Documents Preview:</strong> 
                <div style={{fontSize: '11px', maxHeight: '40px', overflow: 'auto', background: 'rgba(0,0,0,0.1)', padding: '4px', borderRadius: '4px', margin: '2px 0'}}>
                  {diagnostics.company_documents ? 
                    diagnostics.company_documents.substring(0, 200) + '...' : 'none'}
                </div>
              </div>
            </div>

            {/* API Status */}
            <div className="diagnostics-section">
              <h4>🔑 API Status</h4>
              <div className="diagnostics-item">
                <strong>Gemini Key:</strong> {apiKeys.gemini ? '✅ Configured' : '❌ Missing'}
              </div>
              <div className="diagnostics-item">
                <strong>OpenAI Key:</strong> {apiKeys.openai ? '✅ Configured' : '❌ Missing'}
              </div>
              <div className="diagnostics-item">
                <strong>Active Provider:</strong> {
                  (provider === 'gemini' && apiKeys.gemini) || 
                  (provider === 'openai' && apiKeys.openai) 
                    ? '✅ Ready' : '❌ Not Ready'
                }
              </div>
            </div>
          </div>

          <div className="diagnostics-actions">
            <button 
              onClick={loadDiagnosticsData}
              className="mode-button"
              style={{ fontSize: '12px', padding: '8px 12px' }}
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App