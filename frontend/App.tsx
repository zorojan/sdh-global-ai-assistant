/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ControlTray from './components/console/control-tray/ControlTray';
import ErrorScreen from './components/demo/ErrorSreen';
import KeynoteCompanion from './components/demo/keynote-companion/KeynoteCompanion';
import KeynoteCompanionWithRAG from './components/demo/keynote-companion/KeynoteCompanionWithRAG';
import Header from './components/Header';
import UserSettings from './components/UserSettings';
import DataInitializer from './components/DataInitializer';
import { ModeSelector, InteractionMode } from './components/ModeSelector';
import { TextChat } from './components/TextChat';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import { EnhancedVoiceChatWidget } from './components/EnhancedVoiceChat';
import { useUI, useAgent } from './lib/state';
import { api } from './lib/api-client';
import { useState, useEffect } from 'react';

// API клиент для получения данных
const API_BASE_URL = 'http://localhost:3001/api';

// Функция для получения настроек
async function fetchApiKey() {
  try {
    const response = await fetch(`${API_BASE_URL}/public/apikey`);
    // If backend intentionally forbids public key access, return empty string silently
    if (response.status === 403) {
      console.debug('fetchApiKey: public apikey access disabled by backend (403)');
      return '';
    }
    if (!response.ok) throw new Error('Failed to fetch API key');
    const data = await response.json();
    return data.apiKey || '';
  } catch (error) {
    console.debug('fetchApiKey: error fetching API key (falling back to empty):', error);
    return '';
  }
}

// Функция для получения настроек провайдера
async function fetchProviderSettings() {
  try {
    const response = await fetch(`${API_BASE_URL}/public/settings`);
    if (!response.ok) throw new Error('Failed to fetch settings');
    const data = await response.json();
    const aiProvider = data.find((s: any) => s.key === 'ai_provider')?.value || 'gemini';
    return { aiProvider };
  } catch (error) {
    console.error('Error fetching provider settings:', error);
    return { aiProvider: 'gemini' };
  }
}

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function App() {
  const { showUserConfig, isFirstTime, setShowUserConfig, setIsFirstTime } = useUI();
  const { current, setCurrent, setAvailableAgents } = useAgent();
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('audio');
  const [aiProvider, setAiProvider] = useState<string>('gemini');
  // RAG интегрирован внутрь Gemini Live

  // Show user settings modal on first time
  useEffect(() => {
    if (isFirstTime && !loading && !error) {
      setShowUserConfig(true);
    }
  }, [isFirstTime, loading, error, setShowUserConfig]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load API key and provider settings. Note: backend may refuse to expose
        // public API keys (intentional). Treat missing key as non-fatal and
        // continue using backend-proxied session flow.
        const [key, providerSettings] = await Promise.all([
          fetchApiKey(),
          fetchProviderSettings()
        ]);

        // Do not treat missing key as fatal. Store whatever we get (empty string
        // means backend intentionally blocked public key exposure).
        setApiKey(key);
        setAiProvider(providerSettings.aiProvider);
        if (!key) {
          console.warn('App: Public API key not available — continuing with backend-proxy flow');
        } else {
          console.log('🚀 App: Loaded settings - Provider:', providerSettings.aiProvider);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Не удалось загрузить настройки');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Load agents from database when API key is available
  useEffect(() => {
    const loadAgentsFromDatabase = async () => {
      try {
        const agentsList = await api.getAgents();
        
        // Convert database agents to frontend agent format
        const formattedAgents = agentsList.map(dbAgent => ({
          id: dbAgent.id,
          name: dbAgent.name,
          personality: dbAgent.personality,
          bodyColor: dbAgent.body_color || '#9CCF31',
          voice: (dbAgent.voice as any) || 'Orus',
          avatarUrl: dbAgent.avatar_url
        }));
        
        // Set agents in state
        setAvailableAgents(formattedAgents);
        
      } catch (err) {
        console.error('Failed to load agents from database:', err);
      }
    };

    // Always load agents from the backend. Backend will return agents without
    // needing a public API key when using the server-side proxy/session model.
    loadAgentsFromDatabase();
  }, [apiKey, setAvailableAgents]);

  const handleSendMessage = async (message: string, agentId: string) => {
    return await api.sendMessage(agentId, message, aiProvider);
  };

  // Show loading state while fetching API key
  if (loading) {
    return (
      <div className="App">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка конфигурации...</p>
          </div>
        </div>
      </div>
    );
  }

  // If API key was not returned, show a non-blocking warning but continue.
  const showApiKeyWarning = !!error || !apiKey;

  return (
    <div className="App">
      <DataInitializer>
        <LiveAPIProvider apiKey={apiKey}>
          <ErrorScreen />
          <Header />
          {showUserConfig && (
            <UserSettings 
              selectedMode={interactionMode}
              onModeChange={setInteractionMode}
              isFirstTime={isFirstTime}
            />
          )}
          
          {/* Debug Info */}
          <div className="fixed top-4 left-4 bg-green-600 text-white p-2 rounded z-50 text-xs">
            Mode: {interactionMode} | 🧠 Gemini Live + RAG
          </div>
          {showApiKeyWarning && (
            <div className="fixed top-16 left-4 bg-yellow-500 text-black p-2 rounded z-50 text-xs">
              Внимание: публичный API-ключ не доступен. Приложение будет работать через backend-proxy.
            </div>
          )}

          <div className="streaming-console">
            <main>
              {/* RAG интегрирован внутрь Gemini Live */}

              <div className="main-app-area">
                {interactionMode === 'audio' ? (
                  aiProvider === 'gemini' ? (
                    <KeynoteCompanionWithRAG />
                  ) : (
                    <div className="openai-voice-interface">
                      <EnhancedVoiceChatWidget 
                        agent={current}
                        geminiApiKey={apiKey}
                        apiUrl={API_BASE_URL}
                        initialProvider={aiProvider === 'openai' ? 'openai' : 'gemini'}
                        allowProviderSelection={aiProvider === 'hybrid'}
                        showAnimatedFace={true}
                      />
                    </div>
                  )
                ) : (
                  <TextChat
                    agentId={current.id}
                    agentName={current.name}
                    onSendMessage={handleSendMessage}
                    currentProvider={aiProvider}
                  />
                )}
              </div>
              {interactionMode === 'audio' && <ControlTray />}
            </main>
          </div>
        </LiveAPIProvider>
      </DataInitializer>
      <div className="app-footer">
        <a href="https://sdh.global" target="_blank" rel="noopener noreferrer">
          <img
            src="https://sdh.global/s/1-44-1/img/logo.svg"
            alt="SDH Global Logo"
            className="footer-logo"
          />
        </a>
        <p>
          SDH Global: A community of software engineers helping startups
          succeed. Learn more at{' '}
          <a
            href="https://sdh.global"
            target="_blank"
            rel="noopener noreferrer"
          >
            sdh.global
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default App;
