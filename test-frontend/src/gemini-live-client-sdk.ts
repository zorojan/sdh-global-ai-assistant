/**
 * Gemini Live Audio Client using @google/genai SDK
 * Based on working example - uses ai.live.connect() method
 */

import { GoogleGenAI, Modality } from '@google/genai';

export class GeminiLiveClientSDK {
  private ai: GoogleGenAI;
  private session: any = null;
  private isConnected = false;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;

  private onMessageCallback: ((message: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onAudioCallback: ((audioData: Uint8Array) => void) | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    console.log('🎙️ Gemini Live SDK: Client initialized');
  }

  async connect(agent: any, options?: { model?: string; ttsModel?: string }): Promise<void> {
    try {
      console.log('🎙️ Gemini Live SDK: Connecting...');
      console.log('   Supports: Armenian (Հայերեն), Russian, English, and more');

      const model = options?.model || 'gemini-2.5-flash-native-audio-preview-09-2025';
      const systemInstruction = agent?.system_prompt || 
        'You are a helpful conversational AI. Start with a welcome message in Armenian. All responses must be in Armenian.';

      console.log('   Model:', model);
      console.log('   System Instruction:', systemInstruction.substring(0, 100) + '...');
      
      // Validate API key format
      if (!this.ai || typeof this.ai.live !== 'object') {
        throw new Error('Invalid API key or SDK not properly initialized');
      }

      // Connect using the new SDK approach with error handling
      console.log('🔧 Attempting connection with config...');
      
      const config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: systemInstruction,
      };
      
      console.log('🔧 Config prepared:', config);
      
      try {
        this.session = await this.ai.live.connect({
          model: model,
          config: config,
          callbacks: {
            onopen: () => {
              console.log('✅ Gemini Live SDK: Session opened successfully');
              this.isConnected = true;
            },
            onmessage: (message) => {
              console.log('📨 Gemini Live SDK: Received message:', message);
              this.handleMessage(message);
            },
            onerror: (error) => {
              console.error('❌ Gemini Live SDK: Session error:', error);
              console.error('   Error type:', typeof error);
              console.error('   Error details:', error);
              this.isConnected = false;
              if (this.onErrorCallback) {
                this.onErrorCallback(`Session error: ${error}`);
              }
            },
            onclose: (event) => {
              console.warn('❌ Gemini Live SDK: Session closed unexpectedly');
              console.warn('   Close event:', event);
              console.warn('   Was connected:', this.isConnected);
              this.isConnected = false;
              
              // Stop recording when session closes
              if (this.isRecording) {
                console.log('🔄 Stopping recording due to session close');
                this.stopRecording();
              }
            },
          }
        });
        
        console.log('🎙️ Gemini Live SDK: Session creation successful');
        
      } catch (connectionError) {
        console.error('❌ Gemini Live SDK: Failed to create session:', connectionError);
        throw connectionError;
      }

      console.log('🎙️ Gemini Live SDK: Connected successfully');
      
    } catch (error) {
      console.error('🎙️ Gemini Live SDK: Connection failed:', error);
      this.isConnected = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(
          `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      throw error;
    }
  }

  private handleMessage(message: any): void {
    console.log('📨 Gemini Live SDK: Raw message received:', message);
    
    // Handle text responses
    if (message.text) {
      console.log('📝 Gemini Live SDK: Text response received:', message.text.substring(0, 200));
      if (this.onMessageCallback) {
        this.onMessageCallback(message.text);
      }
    }

    // Handle audio responses
    if (message.audio) {
      console.log('🔊 Gemini Live SDK: Audio response received, size:', message.audio.length || 'unknown');
      if (this.onAudioCallback) {
        this.onAudioCallback(message.audio);
      }
      this.playAudio(message.audio);
    }

    // Handle transcriptions
    if (message.inputTranscription) {
      console.log('�➡️📝 Gemini Live SDK: Input transcription (what you said):', message.inputTranscription);
    }

    if (message.outputTranscription) {
      console.log('🤖➡️📝 Gemini Live SDK: Output transcription (what AI said):', message.outputTranscription);
    }

    // Handle any other message types
    if (message.serverContent) {
      console.log('🖥️ Gemini Live SDK: Server content:', message.serverContent);
    }
    
    if (message.error) {
      console.error('❌ Gemini Live SDK: Message error:', message.error);
    }
  }

  async startRecording(): Promise<void> {
    try {
      if (!this.session) {
        throw new Error('No session available. Call connect() first.');
      }
      
      if (!this.isConnected) {
        throw new Error('Session not connected. Please wait for connection or reconnect.');
      }

      console.log('🎙️ Gemini Live SDK: Starting microphone...');
      
      // Add a small delay to ensure session is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // Set up MediaRecorder for capturing audio chunks
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.isRecording) {
          console.log('🎙️ Gemini Live SDK: Received audio data, size:', event.data.size);
          
          // Convert blob to ArrayBuffer for sending to Gemini
          const audioBuffer = await event.data.arrayBuffer();
          const audioData = new Uint8Array(audioBuffer);
          
          console.log('🎙️ Gemini Live SDK: Converted to ArrayBuffer, size:', audioData.length);
          
          // Send audio data to session
          if (this.session && this.isConnected && this.isRecording) {
            try {
              await this.session.sendRealtimeInput({ 
                media: {
                  mimeType: 'audio/webm;codecs=opus',
                  data: audioData
                }
              });
              console.log('✅ Gemini Live SDK: Audio chunk sent successfully, size:', audioData.length);
            } catch (error) {
              console.error('❌ Gemini Live SDK: Error sending audio:', error);
              console.error('   Error details:', error);
              
              // If error suggests session is closed, stop recording
              if (error instanceof Error && error.message.includes('session')) {
                console.log('🔄 Session error detected, stopping recording');
                this.stopRecording();
              }
            }
          } else {
            // Only log this warning occasionally to avoid spam
            if (Math.random() < 0.1) { // Log 10% of the time
              console.warn('⚠️ Gemini Live SDK: Cannot send audio - session not ready');
              console.log('   Session exists:', !!this.session);
              console.log('   Is connected:', this.isConnected);
              console.log('   Is recording:', this.isRecording);
            }
          }
        } else {
          if (event.data.size === 0) {
            console.log('⚠️ Gemini Live SDK: Received empty audio data');
          }
          if (!this.isRecording) {
            console.log('⚠️ Gemini Live SDK: Not recording, ignoring audio data');
          }
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('🎙️ Gemini Live SDK: MediaRecorder error:', event);
        if (this.onErrorCallback) {
          this.onErrorCallback('Recording error occurred');
        }
      };

      // Start recording with time slicing for real-time streaming
      this.mediaRecorder.start(250); // 250ms chunks for real-time streaming
      this.isRecording = true;

      console.log('🎙️ Gemini Live SDK: Recording started');
    } catch (error) {
      console.error('🎙️ Gemini Live SDK: Recording failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(
          `Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      throw error;
    }
  }

  stopRecording(): void {
    if (this.isRecording) {
      this.isRecording = false;
      console.log('🎙️ Gemini Live SDK: Recording stopped');

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    }

    // Stop all media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private playAudio(audioData: Uint8Array): void {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Decode audio data and play
      const arrayBuffer = audioData.buffer instanceof ArrayBuffer ? 
        audioData.buffer : 
        new ArrayBuffer(audioData.byteLength);
      if (!(audioData.buffer instanceof ArrayBuffer)) {
        new Uint8Array(arrayBuffer).set(new Uint8Array(audioData.buffer));
      }
      this.audioContext.decodeAudioData(arrayBuffer).then(audioBuffer => {
        const source = this.audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext!.destination);
        source.start();
        console.log('🎙️ Gemini Live SDK: Playing audio response');
      }).catch(error => {
        console.error('🎙️ Gemini Live SDK: Error decoding audio:', error);
        
        // Fallback: try to play as raw audio
        this.playRawAudio(audioData);
      });
    } catch (error) {
      console.error('🎙️ Gemini Live SDK: Error playing audio:', error);
    }
  }

  private playRawAudio(audioBytes: Uint8Array): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Assume Int16 PCM data and convert to Float32
      const audioBuffer = this.audioContext.createBuffer(1, audioBytes.length / 2, 16000);
      const channelData = audioBuffer.getChannelData(0);

      const int16Array = new Int16Array(audioBytes.buffer);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      console.log('🎙️ Gemini Live SDK: Playing raw audio response');
    } catch (error) {
      console.error('🎙️ Gemini Live SDK: Error playing raw audio:', error);
    }
  }

  async disconnect(): Promise<void> {
    console.log('🎙️ Gemini Live SDK: Disconnecting...');

    this.stopRecording();

    if (this.session) {
      try {
        await this.session.close();
      } catch (error) {
        console.error('🎙️ Gemini Live SDK: Error closing session:', error);
      }
      this.session = null;
    }

    this.isConnected = false;
    console.log('🎙️ Gemini Live SDK: Disconnected');
  }

  // Event callbacks
  onMessage(callback: (message: string) => void): void {
    this.onMessageCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  onAudio(callback: (audioData: Uint8Array) => void): void {
    this.onAudioCallback = callback;
  }

  // Status methods
  getStatus(): {
    isConnected: boolean;
    isRecording: boolean;
    hasSession: boolean;
  } {
    return {
      isConnected: this.isConnected,
      isRecording: this.isRecording,
      hasSession: !!this.session
    };
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }
}