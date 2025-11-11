import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppMode, LiveChatStatus, TranscriptEntry } from '../types';
import { decode, decodeAudioData, createPcmBlob } from '../utils/audio';
import { MicrophoneIcon, StopIcon } from '../constants';
import { CodeBlock } from './CodeBlock';

interface LiveChatViewProps {
  liveModel: string;
  language: string;
}

export const LiveChatView: React.FC<LiveChatViewProps> = ({ liveModel, language }) => {
  const [status, setStatus] = useState<LiveChatStatus>(LiveChatStatus.Idle);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [transcript]);
  
  const stopSession = useCallback(async () => {
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        session.close();
        sessionPromiseRef.current = null;
    }

    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        await inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        await outputAudioContextRef.current.close();
    }

    setStatus(LiveChatStatus.Idle);
  }, []);

  const startSession = useCallback(async () => {
    setError(null);
    setTranscript([]);
    setStatus(LiveChatStatus.Connecting);
    
    try {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        let nextStartTime = 0;
        const outputSources = new Set<AudioBufferSourceNode>();
        
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        sessionPromiseRef.current = ai.live.connect({
            model: liveModel,
            callbacks: {
                onopen: () => {
                    const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    mediaStreamSourceRef.current = source;
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        if (sessionPromiseRef.current) {
                            sessionPromiseRef.current.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        }
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    setStatus(LiveChatStatus.Listening);
                },
                onmessage: async (message: LiveServerMessage) => {
                  if (message.serverContent?.inputTranscription) {
                    currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                  }
                  if (message.serverContent?.outputTranscription) {
                    setStatus(LiveChatStatus.Speaking);
                    currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                  }

                  if (message.serverContent?.turnComplete) {
                      const userInput = currentInputTranscriptionRef.current.trim();
                      if (userInput) {
                          setTranscript(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: userInput }]);
                      }
                      const modelOutput = currentOutputTranscriptionRef.current.trim();
                      if (modelOutput) {
                          setTranscript(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: modelOutput }]);
                      }
                      currentInputTranscriptionRef.current = '';
                      currentOutputTranscriptionRef.current = '';
                      setStatus(LiveChatStatus.Listening);
                  }

                  const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                  if (base64Audio) {
                      nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current!.currentTime);
                      const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current!, 24000, 1);
                      const source = outputAudioContextRef.current!.createBufferSource();
                      source.buffer = audioBuffer;
                      source.connect(outputAudioContextRef.current!.destination);
                      source.addEventListener('ended', () => outputSources.delete(source));
                      source.start(nextStartTime);
                      nextStartTime += audioBuffer.duration;
                      outputSources.add(source);
                  }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Session error:', e);
                    setError(`Session error: ${e.message}`);
                    setStatus(LiveChatStatus.Error);
                    stopSession();
                },
                onclose: () => {
                    console.log('Session closed');
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: `You are a helpful and friendly conversational AI. Start the conversation with a short welcome message in ${language}. All your responses must be in ${language}.`,
            },
        });
    } catch (err: any) {
        console.error("Failed to start session:", err);
        setError(err.message || 'An unknown error occurred.');
        setStatus(LiveChatStatus.Error);
    }
  }, [liveModel, language, stopSession]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
        stopSession();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSessionActive = status !== LiveChatStatus.Idle && status !== LiveChatStatus.Error;

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl flex flex-col h-full p-4 gap-4">
      <div className="flex-shrink-0 flex items-center justify-between p-2 bg-gray-900 rounded-md">
        <div className="text-sm font-medium">Status: <span className="font-bold text-indigo-400">{status}</span></div>
        <button
          onClick={isSessionActive ? stopSession : startSession}
          className={`px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-all duration-200 ${
            isSessionActive 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {isSessionActive ? <StopIcon className="w-5 h-5"/> : <MicrophoneIcon className="w-5 h-5"/>}
          {isSessionActive ? 'Stop Session' : 'Start Session'}
        </button>
      </div>
      
      {error && <div className="p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-md">{error}</div>}
      
      <div className="flex-grow bg-gray-900/50 rounded-lg overflow-y-auto p-4 flex flex-col gap-4">
        {transcript.length === 0 && (
          <div className="flex-grow flex items-center justify-center text-gray-500">
            {status === LiveChatStatus.Idle ? "Click 'Start Session' to begin conversation." : "Transcript will appear here..."}
          </div>
        )}
        {transcript.map((entry) => (
          <div key={entry.id} className={`flex items-start gap-3 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-lg text-white ${entry.role === 'user' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
               <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="prose prose-invert prose-sm max-w-none"
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const codeContent = String(children).replace(/\n$/, '');
                    return !inline ? (
                      <CodeBlock code={codeContent} />
                    ) : (
                      <code className="bg-gray-800/50 text-indigo-300 rounded px-1.5 py-0.5" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {entry.text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
