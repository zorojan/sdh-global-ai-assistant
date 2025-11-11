import React from 'react';
import { AppMode } from '../types';
import { CodeBlock } from './CodeBlock';

interface CodeSnippetViewProps {
  appMode: AppMode;
  liveModel: string;
  language: string;
  ttsModel: string;
  voice: string;
}

const generateLiveChatSnippet = (model: string, language: string) => `
import { GoogleGenAI, Modality } from '@google/genai';

// Make sure to set your API_KEY in the environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function runLiveChat() {
  const sessionPromise = ai.live.connect({
    model: '${model}',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { 
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: \`You are a helpful conversational AI. Start with a welcome message in ${language}. All responses must be in ${language}.\`,
    },
    callbacks: {
      onopen: () => console.log('Session opened.'),
      onmessage: (message) => {
        console.log('Received message:', message);
        // Add your logic to handle audio playback and transcription display
      },
      onerror: (error) => console.error('Session error:', error),
      onclose: () => console.log('Session closed.'),
    }
  });

  console.log('Live chat session is connecting...');
  // Example: To send microphone audio, you would capture audio data
  // and use session.sendRealtimeInput({ media: audioBlob });
}

runLiveChat();
`.trim();

const generateTTSSnippet = (model: string, voice: string) => `
import { GoogleGenAI, Modality } from '@google/genai';

// Make sure to set your API_KEY in the environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function runTTS() {
  const textToSynthesize = 'Hello, world! This is a test.';

  const response = await ai.models.generateContent({
    model: '${model}',
    contents: [{ parts: [{ text: textToSynthesize }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: '${voice}' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (base64Audio) {
    console.log('Received audio data. Ready for playback.');
    // Add your logic to decode and play the audio
  } else {
    console.error('No audio data received.');
  }
}

runTTS();
`.trim();


export const CodeSnippetView: React.FC<CodeSnippetViewProps> = ({
  appMode,
  liveModel,
  language,
  ttsModel,
  voice,
}) => {
  const codeSnippet =
    appMode === AppMode.LiveChat
      ? generateLiveChatSnippet(liveModel, language)
      : generateTTSSnippet(ttsModel, voice);

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Code Snippet Example</h3>
      <p className="text-xs text-gray-400 mb-4">
        This example shows how to use the Gemini API with your current settings.
      </p>
      <CodeBlock code={codeSnippet} language="javascript" />
    </div>
  );
};
