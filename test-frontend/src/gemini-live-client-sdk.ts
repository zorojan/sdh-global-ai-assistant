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
  private scriptProcessor: ScriptProcessorNode | null = null;

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

      // Set up ScriptProcessorNode for real-time PCM audio processing (like working implementation)
      const mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // Process audio in real-time and convert to PCM format
      this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording || !this.session) return;

        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = this.createPcmBlob(inputData);
        
        // Send audio to session using the same format as working implementation
        if (this.session && this.isConnected && this.isRecording) {
          try {
            this.session.sendRealtimeInput({ media: pcmBlob });
            console.log('✅ Gemini Live SDK: PCM audio chunk sent successfully');
          } catch (error) {
            console.error('❌ Gemini Live SDK: Error sending PCM audio:', error);
            
            // If error suggests session is closed, stop recording
            if (error instanceof Error && (error.message.includes('session') || error.message.includes('closed'))) {
              console.log('🔄 Session error detected, stopping recording');
              this.stopRecording();
            }
          }
        }
      };

      // Connect audio processing chain
      if (this.scriptProcessor && this.audioContext) {
        mediaStreamSource.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
      }

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

  // Helper method to convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Helper method to create PCM blob from Float32Array (from working implementation)
  private createPcmBlob(data: Float32Array): any {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: this.encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
  }

  // Helper method to encode bytes to base64 (from working implementation)
  private encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}