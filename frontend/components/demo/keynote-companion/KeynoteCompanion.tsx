/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';
import { Modality } from '@google/genai';

import BasicFace from '../basic-face/BasicFace';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { createSystemInstructions } from '@/lib/prompts';
import { useAgent, useUser } from '@/lib/state';

export default function KeynoteCompanion() {
  const { client, connected, setConfig } = useLiveAPIContext();
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const user = useUser();
  const { current } = useAgent();
  const [configLoaded, setConfigLoaded] = useState(false);

  // Function to fetch Live API configuration from database
  const fetchLiveApiConfig = async () => {
    try {
      console.log(`🎵 [Agent: ${current.name}] Fetching Live API configuration from database...`);

      // First, let's fetch raw settings from database to see what's actually stored
      const diagnosticsResponse = await fetch('http://localhost:3001/api/settings/diagnostics');
      if (diagnosticsResponse.ok) {
        const diagnosticsData = await diagnosticsResponse.json();
        console.log(`📊 [Agent: ${current.name}] Raw database settings:`, {
          live_api_model: diagnosticsData.live_api_model,
          live_api_response_modalities: diagnosticsData.live_api_response_modalities,
          live_api_voice_name: diagnosticsData.live_api_voice_name,
          live_api_enable_input_transcription: diagnosticsData.live_api_enable_input_transcription,
          live_api_enable_output_transcription: diagnosticsData.live_api_enable_output_transcription,
          live_api_temperature: diagnosticsData.live_api_temperature,
          live_api_system_instruction: diagnosticsData.live_api_system_instruction?.substring(0, 100) + '...'
        });
      }

      const response = await fetch('http://localhost:3001/api/settings/live-api-config');

      if (!response.ok) {
        throw new Error(`Failed to fetch Live API config: ${response.status}`);
      }

      const liveApiConfig = await response.json();
      console.log(`✅ [Agent: ${current.name}] Live API configuration loaded from database:`, {
        model: liveApiConfig.model,
        responseModalities: liveApiConfig.config?.responseModalities,
        voiceName: liveApiConfig.config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName,
        inputTranscription: !!liveApiConfig.config?.inputAudioTranscription,
        outputTranscription: !!liveApiConfig.config?.outputAudioTranscription,
        temperature: liveApiConfig.config?.temperature,
        systemInstructionLength: liveApiConfig.config?.systemInstruction?.parts?.[0]?.text?.length || 0,
        systemInstructionPreview: liveApiConfig.config?.systemInstruction?.parts?.[0]?.text?.substring(0, 100) + '...'
      });

      // Set the configuration in the Live API context
      setConfig(liveApiConfig.config);
      setConfigLoaded(true);

      console.log(`🎯 [Agent: ${current.name}] Configuration applied successfully`);

    } catch (error) {
      console.error(`❌ [Agent: ${current.name}] Error fetching Live API configuration:`, error);

      // Fallback to hardcoded config if API fails
      console.log(`🔄 [Agent: ${current.name}] Using fallback hardcoded configuration...`);
      const fallbackConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Zephyr"
            }
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [
            {
              text: `You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ. Start the conversation immediately with a short welcome message in Armenian without waiting for the user to speak first. All your subsequent responses must be in Armenian.`
            }
          ]
        },
        temperature: 0.8
      };

      console.log(`⚠️ [Agent: ${current.name}] Applying fallback config:`, {
        responseModalities: fallbackConfig.responseModalities,
        voiceName: fallbackConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
        inputTranscription: !!fallbackConfig.inputAudioTranscription,
        outputTranscription: !!fallbackConfig.outputAudioTranscription,
        temperature: fallbackConfig.temperature,
        systemInstructionPreview: fallbackConfig.systemInstruction.parts[0].text.substring(0, 100) + '...'
      });

      setConfig(fallbackConfig);
      setConfigLoaded(true);
    }
  };

  // Load Live API configuration on component mount and when agent changes
  useEffect(() => {
    console.log('🎭 Agent changed - Current agent:', {
      id: current.id,
      name: current.name,
      personality: current.personality,
      voice: current.voice,
      bodyColor: current.bodyColor,
      avatarUrl: current.avatarUrl
    });

    console.log(`🔄 [Agent: ${current.name}] Reloading Live API configuration due to agent change...`);
    setConfigLoaded(false); // Reset config loaded state
    fetchLiveApiConfig();
  }, [setConfig, current.id]); // Re-fetch config when agent changes

  // Initiate the session when the Live API connection is established and config is loaded
  useEffect(() => {
    if (connected && configLoaded) {
      console.log(`🎤 [Agent: ${current.name}] Starting session with agent...`);
      const beginSession = async () => {
        try {
          client.send(
            {
              text: 'Greet the user and introduce yourself and your role.',
            },
            true
          );
          console.log(`✅ [Agent: ${current.name}] Session started successfully`);
        } catch (error) {
          console.error(`❌ [Agent: ${current.name}] Failed to start session:`, error);
        }
      };
      beginSession();
    }
  }, [client, connected, configLoaded, current.name]);

  return (
    <div className="keynote-companion">
      {/* Debug info for current configuration */}
      <div className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50 max-w-xs">
        <div>Agent: {current.name}</div>
        <div>Connected: {connected ? '✅' : '❌'}</div>
        <div>Config Loaded: {configLoaded ? '✅' : '❌'}</div>
      </div>

      <BasicFace
        canvasRef={faceCanvasRef!}
        color={current.bodyColor}
        avatarUrl={current.avatarUrl}
        isActive={connected}
      />
    </div>
  );
}
