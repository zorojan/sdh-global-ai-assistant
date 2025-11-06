/**
 * Gemini Live Client - Based on WORKING Frontend Implementation
 * This is the 4th variant that copies the exact working logic from main frontend
 */

import { GoogleGenAI, LiveConnectConfig, Modality } from '@google/genai';
import EventEmitter from 'eventemitter3';

// Audio utility functions
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// AudioStreamer class simplified for direct PCM playback
class SimpleAudioStreamer {
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  addPCM16(data: Uint8Array) {
    // Convert PCM16 data to AudioBuffer and play
    this.playPCM16(data);
  }

  private playPCM16(data: Uint8Array) {
    try {
      const dataInt16 = new Int16Array(data.buffer);
      const frameCount = dataInt16.length;
      const buffer = this.audioContext.createBuffer(1, frameCount, 24000);
      
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('❌ Audio playback error:', error);
    }
  }

  stop() {
    // Cleanup audio resources
  }
}

export interface GeminiLiveFrontendClientEventTypes {
  open: () => void;
  close: (event: CloseEvent) => void;
  error: (error: Error) => void;
  audio: (data: ArrayBuffer) => void;
  interrupted: () => void;
  content: (data: any) => void;
}

export class GeminiLiveFrontendClient extends EventEmitter<GeminiLiveFrontendClientEventTypes> {
  private client: GoogleGenAI;
  private session: any = null;
  private status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private audioContext: AudioContext | null = null;
  private audioStreamer: SimpleAudioStreamer | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  constructor(apiKey: string) {
    super();
    this.client = new GoogleGenAI({ apiKey });
    console.log('🎵 Gemini Live Frontend: Client initialized (Based on working frontend)');
  }

  async connect(agent: any, options?: { model?: string; language?: string }): Promise<void> {
    try {
      const model = options?.model || 'gemini-2.5-flash-native-audio-preview-09-2025';
      const language = options?.language || 'Armenian';
      const systemInstruction = agent?.system_prompt || 
        `You are a helpful and friendly conversational AI. Start the conversation with a short welcome message in ${language}. All your responses must be in ${language}.`;

      console.log('🎵 Gemini Live Frontend: Connecting...');
      console.log('   Model:', model);
      console.log('   Language:', language);
      console.log('   System Instruction:', systemInstruction.substring(0, 100) + '...');

      if (this.status === 'connected' || this.status === 'connecting') {
        console.warn('🎵 Already connected or connecting');
        return;
      }

      this.status = 'connecting';

      // Setup audio context
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 24000 });
        await this.audioContext.resume();
        console.log('🎵 Audio context created and resumed');
      }

      // Setup audio streamer
      if (!this.audioStreamer) {
        this.audioStreamer = new SimpleAudioStreamer(this.audioContext);
        console.log('🎵 Audio streamer created');
      }

      // Connect to Gemini Live API using exact same config as working frontend
      const config: LiveConnectConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Aoede' },
          },
        },
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
      };

      console.log('🎵 Connecting with config:', JSON.stringify(config, null, 2));

      this.session = await this.client.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => {
            console.log('🎵 Session opened');
            this.status = 'connected';
            this.emit('open');
          },
          onclose: (event) => {
            console.log('🎵 Session closed:', event);
            this.status = 'disconnected';
            this.cleanup();
            this.emit('close', event);
          },
          onerror: (error) => {
            console.error('🎵 Session error:', error);
            this.emit('error', new Error(error instanceof Error ? error.message : 'Session error'));
          },
          onmessage: (message) => {
            this.handleMessage(message);
          },
        },
      });

      console.log('✅ Gemini Live Frontend: Connected successfully');

    } catch (error: any) {
      console.error('❌ Gemini Live Frontend: Connection failed:', error);
      this.status = 'disconnected';
      throw error;
    }
  }

  private handleMessage(message: any) {
    console.log('🎵 Message received:', message);

    if (message.serverContent) {
      const content = message.serverContent;
      if (content.parts) {
        for (const part of content.parts) {
          if (part.inlineData?.mimeType?.includes('audio') && part.inlineData.data) {
            // Handle audio data
            const audioData = decode(part.inlineData.data);
            if (this.audioStreamer) {
              this.audioStreamer.addPCM16(audioData);
            }
            this.emit('audio', audioData.buffer as ArrayBuffer);
          }
        }
      }
      this.emit('content', content);
    }

    if (message.serverInterrupted) {
      console.log('🎵 Server interrupted');
      this.emit('interrupted');
    }
  }

  async startRecording(): Promise<void> {
    if (this.status !== 'connected') {
      throw new Error('Not connected. Call connect() first.');
    }

    console.log('🎵 Starting microphone...');

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (!this.audioContext) {
        throw new Error('Audio context not available');
      }

      // Create source node
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Try to use AudioWorklet (modern approach)
      try {
        const processorUrl = URL.createObjectURL(new Blob([`
          class AudioProcessor extends AudioWorkletProcessor {
            process(inputs, outputs, parameters) {
              const input = inputs[0];
              if (input && input[0]) {
                const pcmData = new Int16Array(input[0].length);
                for (let i = 0; i < input[0].length; i++) {
                  pcmData[i] = Math.max(-32768, Math.min(32767, input[0][i] * 32768));
                }
                this.port.postMessage(pcmData.buffer);
              }
              return true;
            }
          }
          registerProcessor('audio-processor', AudioProcessor);
        `], { type: 'application/javascript' }));

        await this.audioContext.audioWorklet.addModule(processorUrl);
        
        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
        this.workletNode.port.onmessage = (event) => {
          if (this.session && this.status === 'connected') {
            const pcmData = new Uint8Array(event.data);
            const base64Data = encode(pcmData);
            this.session.sendRealtimeInput({
              media: {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Data,
              },
            });
          }
        };

        this.sourceNode.connect(this.workletNode);
        console.log('✅ AudioWorklet recording setup complete');

      } catch (workletError) {
        // Fallback to ScriptProcessorNode
        console.warn('AudioWorklet failed, using ScriptProcessorNode fallback:', workletError);
        
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
          if (this.session && this.status === 'connected') {
            const inputData = event.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            
            const base64Data = encode(new Uint8Array(pcmData.buffer));
            this.session.sendRealtimeInput({
              media: {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Data,
              },
            });
          }
        };

        this.sourceNode.connect(processor);
        processor.connect(this.audioContext.destination);
        console.log('✅ ScriptProcessorNode recording setup complete');
      }

      console.log('🎵 Recording started successfully');

    } catch (error: any) {
      console.error('❌ Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    console.log('🎵 Stopping recording...');

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    console.log('✅ Recording stopped');
  }

  private cleanup() {
    this.stopRecording().catch(console.error);
    
    if (this.audioStreamer) {
      this.audioStreamer.stop();
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
  }

  async disconnect(): Promise<void> {
    console.log('🎵 Disconnecting...');
    
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    
    this.status = 'disconnected';
    this.cleanup();
    
    console.log('✅ Disconnected');
  }

  send(text: string): void {
    if (this.status !== 'connected' || !this.session) {
      console.warn('Cannot send - not connected');
      return;
    }

    this.session.sendClientContent({
      turns: [{ parts: [{ text }] }],
      turnComplete: true,
    });
  }

  getStatus(): string {
    return this.status;
  }
}