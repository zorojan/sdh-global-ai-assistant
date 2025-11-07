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
  // Keep last applied agent id to avoid duplicate reloads
  const lastAgentIdRef = useRef<string | null>(null);

  // Function to fetch Live API configuration from database
  const fetchLiveApiConfig = async () => {
    try {
      console.log(`🎵 [Agent: ${current.name}] Fetching Live API configuration from database...`);

      // 🎯 НОВЫЙ ПОДХОД: Использовать новый endpoint для полной синхронизации
      const response = await fetch(`http://localhost:3001/api/public/config/live-connection/${current.id}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Live API config: ${response.status}`);
      }

      const { connectionConfig, agentInfo } = await response.json();
      
      console.log(`✅ [Agent: ${current.name}] Live API configuration loaded from database:`, {
        model: connectionConfig.model,
        responseModalities: connectionConfig.config?.responseModalities,
        voiceName: connectionConfig.config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName,
        inputTranscription: !!connectionConfig.config?.inputAudioTranscription,
        outputTranscription: !!connectionConfig.config?.outputAudioTranscription,
        systemInstructionLength: connectionConfig.config?.systemInstruction?.length || 0,
        systemInstructionPreview: connectionConfig.config?.systemInstruction?.substring(0, 100) + '...',
        agentLanguage: agentInfo.language,
        agentVoiceLanguage: agentInfo.voice_language
      });

      // Set the configuration in the Live API context
      setConfig(connectionConfig.config);
      setConfigLoaded(true);

      console.log(`🎯 [Agent: ${current.name}] Configuration applied successfully - данные синхронизированы с базой данных!`);

    } catch (error) {
      console.error(`❌ [Agent: ${current.name}] Error fetching Live API configuration:`, error);

      // Fallback to hardcoded config if API fails
      console.log(`🔄 [Agent: ${current.name}] Using fallback hardcoded configuration...`);
      const fallbackConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Orus" // Используем Orus как default из базы данных
            }
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ. ${current.personality} Start the conversation immediately with a short welcome message in Armenian without waiting for the user to speak first. All your subsequent responses must be in Armenian.`
      };

      console.log(`⚠️ [Agent: ${current.name}] Applying fallback config:`, {
        responseModalities: fallbackConfig.responseModalities,
        voiceName: fallbackConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
        inputTranscription: !!fallbackConfig.inputAudioTranscription,
        outputTranscription: !!fallbackConfig.outputAudioTranscription,
        systemInstructionPreview: fallbackConfig.systemInstruction.substring(0, 100) + '...'
      });

      setConfig(fallbackConfig);
      setConfigLoaded(true);
    }
  };

  // Load Live API configuration on component mount and when agent changes
  // Guard against the placeholder 'loading' agent and duplicate reloads
  useEffect(() => {
    // Skip reload for placeholder agent id or undefined
    if (!current?.id || current.id === 'loading' || current.id === 'default') {
      console.debug(`🔕 Skipping config reload for placeholder agent id='${current?.id}'`);
      return;
    }

    // If agent hasn't changed, skip
    if (lastAgentIdRef.current === current.id) {
      console.debug(`🔕 Agent '${current.name}' (${current.id}) already applied — skipping reload`);
      return;
    }

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
    lastAgentIdRef.current = current.id;
    fetchLiveApiConfig();
  }, [setConfig, current.id, current.name]); // Re-fetch config when agent id changes

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
