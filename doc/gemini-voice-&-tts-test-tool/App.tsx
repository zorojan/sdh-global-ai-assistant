import React, { useState } from 'react';
import { AppMode, LogEntry } from './types';
import { LIVE_CHAT_MODELS, TTS_MODELS, TTS_VOICES } from './constants';
import { LiveChatView } from './components/LiveChatView';
import { TTSView } from './components/TTSView';
import { CodeSnippetView } from './components/CodeSnippetView';
import { LogModal } from './components/LogModal';

function App() {
  const [appMode, setAppMode] = useState<AppMode>(AppMode.LiveChat);
  const [liveModel, setLiveModel] = useState<string>(LIVE_CHAT_MODELS[0]);
  const [ttsModel, setTtsModel] = useState<string>(TTS_MODELS[0]);
  const [voice, setVoice] = useState<string>(TTS_VOICES[0]);
  const [language, setLanguage] = useState<string>('Armenian');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const addLog = (type: LogEntry['type'], payload: object) => {
    const sanitizedPayload = JSON.parse(JSON.stringify(payload, (key, value) => {
      if (typeof value === 'string' && value.length > 500) {
        return value.substring(0, 500) + '... (truncated)';
      }
      return value;
    }));

    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      payload: sanitizedPayload,
    };
    setLogs(prev => [...prev, newLog]);
  };

  const clearLogs = () => setLogs([]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col p-4 md:p-8 font-sans">
      <header className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
          Gemini Voice & TTS Test Tool
        </h1>
        <p className="text-gray-400 mt-2">
          Test real-time voice chat and speech synthesis with Gemini models.
        </p>
        <div className="mt-4">
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-semibold"
          >
            View Request/Response Details
          </button>
        </div>
      </header>
      
      <main className="flex-grow flex flex-col lg:flex-row gap-6">
        {/* Control Panel & Code Snippet */}
        <aside className="lg:w-1/4 xl:w-1/5 flex-shrink-0">
          <div className="sticky top-8 flex flex-col gap-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg space-y-6">
              <div>
                <label htmlFor="appMode" className="block text-sm font-medium text-gray-300 mb-2">
                  Test Mode
                </label>
                <select
                  id="appMode"
                  value={appMode}
                  onChange={(e) => setAppMode(e.target.value as AppMode)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value={AppMode.LiveChat}>Live Chat</option>
                  <option value={AppMode.TTS}>Text-to-Speech</option>
                </select>
              </div>
              
              {appMode === AppMode.LiveChat && (
                <>
                  <div>
                    <label htmlFor="liveModel" className="block text-sm font-medium text-gray-300 mb-2">
                      Chat Model
                    </label>
                    <select
                      id="liveModel"
                      value={liveModel}
                      onChange={(e) => setLiveModel(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {LIVE_CHAT_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-2">
                      Language
                    </label>
                    <select
                      id="language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="Armenian">Armenian</option>
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                    </select>
                  </div>
                </>
              )}

              {appMode === AppMode.TTS && (
                <>
                  <div>
                    <label htmlFor="ttsModel" className="block text-sm font-medium text-gray-300 mb-2">
                      TTS Model
                    </label>
                    <select
                      id="ttsModel"
                      value={ttsModel}
                      onChange={(e) => setTtsModel(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {TTS_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="voice" className="block text-sm font-medium text-gray-300 mb-2">
                      Voice
                    </label>
                    <select
                      id="voice"
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {TTS_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            
            <CodeSnippetView
              appMode={appMode}
              liveModel={liveModel}
              language={language}
              ttsModel={ttsModel}
              voice={voice}
            />
          </div>
        </aside>

        {/* Main View */}
        <section className="flex-grow min-h-[75vh]">
          {appMode === AppMode.LiveChat ? (
            <LiveChatView liveModel={liveModel} language={language} addLog={addLog} />
          ) : (
            <TTSView ttsModel={ttsModel} voice={voice} addLog={addLog} />
          )}
        </section>
      </main>
      <LogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        logs={logs}
        onClear={clearLogs}
      />
    </div>
  );
}

export default App;