
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audio';
import { SpeakerIcon } from '../constants';

interface TTSViewProps {
  ttsModel: string;
  voice: string;
}

export const TTSView: React.FC<TTSViewProps> = ({ ttsModel, voice }) => {
  const [text, setText] = useState('Hello, world! Welcome to the Gemini API. Try typing something here, perhaps in Armenian, to test language support.');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outputAudioContextRef = useRef<AudioContext | null>(null);

  const handleSynthesize = useCallback(async () => {
    if (!text.trim()) {
      setError("Please enter some text to synthesize.");
      return;
    }
    setError(null);
    setIsSynthesizing(true);
    
    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
          outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
        const source = outputAudioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContextRef.current.destination);
        source.start();
      } else {
        throw new Error("No audio data received from API.");
      }
    } catch (err: any) {
      console.error("TTS Error:", err);
      setError(err.message || "An unknown error occurred during synthesis.");
    } finally {
      setIsSynthesizing(false);
    }
  }, [text, ttsModel, voice]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl flex flex-col h-full p-4 gap-4">
      <div className="flex-shrink-0 p-2">
        <h2 className="text-xl font-bold text-gray-100">Text-to-Speech Synthesis</h2>
        <p className="text-sm text-gray-400">Enter text to generate audio. This is a great place to test non-English languages like Armenian.</p>
      </div>

      <div className="flex-grow flex flex-col gap-4 p-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text here..."
          className="w-full flex-grow p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
          disabled={isSynthesizing}
        />
        <button
          onClick={handleSynthesize}
          disabled={isSynthesizing}
          className="w-full px-4 py-3 rounded-md font-semibold flex items-center justify-center gap-2 transition-all duration-200 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          <SpeakerIcon className="w-5 h-5"/>
          {isSynthesizing ? 'Synthesizing...' : 'Synthesize Speech'}
        </button>
      </div>

      {error && (
        <div className="flex-shrink-0 p-3 bg-red-900/50 text-red-300 border border-red-700 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
};
