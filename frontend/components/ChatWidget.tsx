import React, { useState, useEffect, useRef } from 'react';
import { EnhancedVoiceChatWidget } from './EnhancedVoiceChat';
import './ChatWidget.css';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatWidgetProps {
  agentId: string;
  theme?: 'light' | 'dark';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  title?: string;
  placeholder?: string;
  primaryColor?: string;
  apiUrl?: string;
  geminiApiKey?: string; // Опциональный параметр для фоллбэка
  aiProvider?: string; // 'gemini' | 'openai' | 'hybrid'
}

type DialogMode = 'text' | 'voice' | null;

// Функция для получения API ключа из backend (как в основном фронтенде)
async function fetchApiKey(apiUrl: string) {
  try {
    const response = await fetch(`${apiUrl}/api/public/apikey`);
    if (!response.ok) throw new Error('Failed to fetch API key');
    const data = await response.json();
    return data.apiKey || '';
  } catch (error) {
    console.error('Error fetching API key from backend:', error);
    return '';
  }
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  agentId,
  theme = 'light',
  position = 'bottom-right',
  title = 'AI Assistant',
  placeholder = 'Type your message...',
  primaryColor = '#007bff',
  apiUrl = 'http://localhost:3001',
  geminiApiKey, // Не используется, только для совместимости
  aiProvider = 'gemini'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agent, setAgent] = useState<any>(null);
  const [showIntroduction, setShowIntroduction] = useState(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загружаем API ключ точно как во frontend
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        setLoading(true);
        setError(null);
        const key = await fetchApiKey(apiUrl);
        
        if (!key) {
          setError('API ключ не настроен в админ панели');
        } else {
          setApiKey(key);
          console.log('🎤 Widget: API key loaded successfully');
        }
      } catch (err) {
        console.error('🎤 Widget: Failed to load API key:', err);
        setError('Не удалось загрузить настройки');
      } finally {
        setLoading(false);
      }
    };

    loadApiKey();
  }, [apiUrl]);

  // Load agent configuration
  useEffect(() => {
    const loadAgent = async () => {
      try {
        if (agentId) {
          // Try to load specific agent
          const response = await fetch(`${apiUrl}/api/agents/${agentId}`);
          if (response.ok) {
            const agentData = await response.json();
            setAgent(agentData);
            return;
          }
        }
        
        // Fallback: load first available agent
        const response = await fetch(`${apiUrl}/api/public/agents`);
        if (response.ok) {
          const agents = await response.json();
          if (agents && agents.length > 0) {
            setAgent(agents[0]); // Use first available agent
          } else {
            // Create default agent if none available
            setAgent({
              id: 'default',
              name: title || 'AI Assistant',
              personality: 'I am a helpful AI assistant.',
              description: 'How can I help you today?'
            });
          }
        }
      } catch (error) {
        console.error('Failed to load agent:', error);
        // Create default agent on error
        setAgent({
          id: 'default',
          name: title || 'AI Assistant',
          personality: 'I am a helpful AI assistant.',
          description: 'How can I help you today?'
        });
      }
    };

    loadAgent();
  }, [agentId, apiUrl, title]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // CSS custom properties
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
  }, [primaryColor]);

  // Show loading if API key is still loading
  if (loading) {
    return (
      <div className={`chat-widget ${theme} ${position}`}>
        <button className="chat-toggle" disabled>
          ⏳
        </button>
        <div className="chat-window open">
          <div className="chat-header">
            <h3>Loading...</h3>
          </div>
          <div className="chat-messages">
            <div className="loading-spinner"></div>
            <p>Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if API key couldn't be loaded
  if (error) {
    return (
      <div className={`chat-widget ${theme} ${position}`}>
        <button className="chat-toggle" disabled>
          ⚠️
        </button>
        <div className="chat-window open">
          <div className="chat-header">
            <h3>Configuration Error</h3>
          </div>
          <div className="chat-messages">
            <div className="voice-error">
              <p>⚠️ {error}</p>
              <p>Configure API key in admin panel:</p>
              <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">
                Open Admin Panel
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const startDialog = (mode: DialogMode) => {
    setDialogMode(mode);
    setShowIntroduction(false);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.text,
          agentId: agent?.id || agentId || 'default'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Widget UI
  const widgetContent = (
    <div className={`chat-widget ${theme} ${position}`}>
      {/* Toggle Button */}
      <button
        className="chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      <div className={`chat-window ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="agent-info">
            <div className="agent-avatar large">
              {agent?.name ? agent.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h3>{agent?.name || title}</h3>
              <div className="status">Online</div>
            </div>
          </div>
          <button 
            className="close-button"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Introduction Screen */}
        {showIntroduction && (
          <div className="introduction-screen">
            <div className="agent-avatar large">
              {agent?.name ? agent.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <h4>Hi! I'm {agent?.name || title}</h4>
            <p>{agent?.description || 'I\'m here to help you. How would you like to communicate?'}</p>
            
            <div className="mode-selection">
              <h5>Choose communication mode:</h5>
              <div className="mode-buttons">
                <button
                  className="mode-button text-mode"
                  onClick={() => startDialog('text')}
                >
                  <div className="mode-icon">💬</div>
                  <div className="mode-info">
                    <strong>Text Chat</strong>
                    <span>Type your messages</span>
                  </div>
                </button>
                
                <button
                  className="mode-button voice-mode"
                  onClick={() => startDialog('voice')}
                >
                  <div className="mode-icon">🎤</div>
                  <div className="mode-info">
                    <strong>Voice Chat</strong>
                    <span>Speak naturally</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          {!showIntroduction && dialogMode === 'text' && (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.isUser ? 'user' : 'assistant'}`}
                >
                  {!message.isUser && (
                    <div className="message-avatar">
                      {agent?.name ? agent.name.charAt(0).toUpperCase() : 'A'}
                    </div>
                  )}
                  <div className="message-content">
                    <div className="message-text">{message.text}</div>
                    <div className="message-time">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="message assistant">
                  <div className="message-avatar">
                    {agent?.name ? agent.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!showIntroduction && dialogMode === 'voice' && (
            loading ? (
              <div className="voice-loading">
                <div className="loading-spinner"></div>
                <p>Loading voice configuration...</p>
              </div>
            ) : apiKey ? (
              <EnhancedVoiceChatWidget 
                agent={agent} 
                geminiApiKey={apiKey} 
                apiUrl={apiUrl} 
                initialProvider={(aiProvider === 'openai') ? 'openai' : 'gemini'} 
                allowProviderSelection={aiProvider === 'hybrid'}
              />
            ) : (
              <div className="voice-error">
                <p>⚠️ Voice mode requires API key configuration</p>
                <p>Configure API key in admin panel: <a href="http://localhost:3000" target="_blank">Open Admin</a></p>
                <button onClick={() => setShowIntroduction(true)}>
                  Switch to text mode
                </button>
              </div>
            )
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!showIntroduction && dialogMode === 'text' && (
          <div className="chat-input">
            <div className="mode-indicator">
              <span className="mode-badge text">💬 Text Mode</span>
              <button 
                className="switch-mode"
                onClick={() => setShowIntroduction(true)}
                title="Switch mode"
              >
                🔄
              </button>
            </div>
            
            <div className="input-container">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="send-button"
                aria-label="Send message"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9"></polygon>
                </svg>
              </button>
            </div>
          </div>
        )}

        {!showIntroduction && dialogMode === 'voice' && (
          <div className="chat-input">
            <div className="mode-indicator">
              <span className="mode-badge voice">🎤 Voice Mode</span>
              <button 
                className="switch-mode"
                onClick={() => setShowIntroduction(true)}
                title="Switch mode"
              >
                🔄
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="chat-footer">
          <span>Powered by SDH AI Assistant</span>
        </div>
      </div>
    </div>
  );

  // Wrap with LiveAPI provider if voice is used  
  return widgetContent;
};

export default ChatWidget;
