/**
 * Gemini Live API Client with Backend Proxy
 * Connects to backend proxy which handles Gemini Live API WebSocket
 * Uses correct API endpoint and model names
 */

export class GeminiLiveClient {
  private apiUrl = 'http://localhost:3001/api/gemini/live';
  private sessionId: string | null = null;
  private isConnected = false;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private recordingStartTime = 0;
  private ws: WebSocket | null = null;

  private model: string = 'gemini-2.5-flash-native-audio-preview-09-2025';
  private ttsModel: string = 'gemini-2.5-flash';
  private systemPrompt: string = 'You are a helpful AI assistant.';

  private onMessageCallback: ((message: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onAudioCallback: ((audioData: Uint8Array) => void) | null = null;

  constructor(_apiKey: string) {
    // API key passed but not directly used (backend handles auth)
    console.log('🎙️ Gemini Live: Client initialized');
  }

  async connect(agent: any, options?: { model?: string; ttsModel?: string }): Promise<void> {
    try {
      console.log('🎙️ Gemini Live: Connecting...');
      console.log('   Supports: Armenian (Հայերեն), Russian, English, and more');

      if (options?.model) {
        this.model = options.model;
        console.log('   Audio Model:', this.model);
      }
      if (options?.ttsModel) {
        this.ttsModel = options.ttsModel;
        console.log('   TTS Model:', this.ttsModel);
      }

      if (agent?.system_prompt) {
        this.systemPrompt = agent.system_prompt;
      }

      // Request session setup from backend
      const setupResponse = await fetch(`${this.apiUrl}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          ttsModel: this.ttsModel,
          systemPrompt: this.systemPrompt,
          agentId: agent?.id
        })
      });

      const setupData = (await setupResponse.json()) as any;

      if (!setupResponse.ok) {
        throw new Error(setupData.error || 'Failed to setup session');
      }

      this.sessionId = setupData.sessionId;
      console.log('🎙️ Gemini Live: Session created:', this.sessionId);
      console.log('   Endpoint:', setupData.endpoint.substring(0, 80) + '...');

      // Establish WebSocket connection for receiving responses
      this.ws = new WebSocket(`ws://localhost:3001?sessionId=${this.sessionId}`);
      
      this.ws.onopen = () => {
        console.log('🎙️ Gemini Live: WebSocket connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'message') {
            if (message.text && this.onMessageCallback) {
              console.log('🎙️ Gemini Live: Text response:', message.text.substring(0, 100));
              this.onMessageCallback(message.text);
            }
            if (message.audio && this.onAudioCallback) {
              console.log('🎙️ Gemini Live: Audio response received');
              const audioBytes = new Uint8Array(message.audio);
              this.onAudioCallback(audioBytes);
              this.playAudio(audioBytes);
            }
          }
        } catch (error) {
          console.error('🎙️ Gemini Live: Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('🎙️ Gemini Live: WebSocket error:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback('WebSocket connection error');
        }
      };
      
      this.ws.onclose = () => {
        console.log('🎙️ Gemini Live: WebSocket closed');
      };

      this.isConnected = true;
    } catch (error) {
      console.error('🎙️ Gemini Live: Connection failed:', error);
      this.isConnected = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(
          `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      throw error;
    }
  }

  async startRecording(): Promise<void> {
    try {
      if (!this.isConnected || !this.sessionId) {
        throw new Error('Not connected. Call connect() first.');
      }

      console.log('🎙️ Gemini Live: Starting microphone...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // Create audio processor for real-time audio capture
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      processor.onaudioprocess = async (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        await this.sendAudioChunk(inputData);
      };

      this.isRecording = true;
      this.recordingStartTime = Date.now();

      console.log('🎙️ Gemini Live: Recording started');
    } catch (error) {
      console.error('🎙️ Gemini Live: Recording failed:', error);
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
      console.log('🎙️ Gemini Live: Recording stopped');
      console.log('   Duration:', Math.round((Date.now() - this.recordingStartTime) / 1000), 'seconds');
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private async sendAudioChunk(audioData: Float32Array): Promise<void> {
    if (!this.isRecording || !this.sessionId) return;

    try {
      // Convert Float32 to Int16 PCM
      const int16Data = this.float32ToInt16(audioData);

      // Convert to base64
      const base64Audio = this.uint8ToBase64(int16Data);

      console.log('🎙️ Gemini Live: Sending audio chunk', {
        size: Math.round(base64Audio.length / 1024),
        time: new Date().toLocaleTimeString()
      });

      // Send to backend
      const response = await fetch(`${this.apiUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          audioBase64: base64Audio,
          contentType: 'audio'
        })
      });

      const result = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send audio');
      }

      console.log('🎙️ Gemini Live: Audio chunk sent successfully');
      // Responses will come via WebSocket
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to send audio')) {
        // Silently handle audio send errors to avoid spam
        return;
      }
      console.error('🎙️ Gemini Live: Error sending audio:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(
          `Error sending audio: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  private playAudio(audioBytes: Uint8Array): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Convert Int16 to Float32
      const audioBuffer = this.audioContext.createBuffer(
        1,
        audioBytes.length / 2,
        16000
      );
      const channelData = audioBuffer.getChannelData(0);

      const int16Array = new Int16Array(audioBytes.buffer);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      console.log('🎙️ Gemini Live: Playing audio response');
    } catch (error) {
      console.error('🎙️ Gemini Live: Error playing audio:', error);
    }
  }

  private float32ToInt16(float32Data: Float32Array): Uint8Array {
    const int16Array = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Data[i]));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return new Uint8Array(int16Array.buffer);
  }

  private uint8ToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async disconnect(): Promise<void> {
    console.log('🎙️ Gemini Live: Disconnecting...');

    this.stopRecording();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.sessionId) {
      try {
        await fetch(`${this.apiUrl}/cleanup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionId })
        });
      } catch (error) {
        console.error('🎙️ Gemini Live: Cleanup error:', error);
      }

      this.sessionId = null;
    }

    this.isConnected = false;
    console.log('🎙️ Gemini Live: Disconnected');
  }

  onMessage(callback: (message: string) => void): void {
    this.onMessageCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  onAudio(callback: (audioData: Uint8Array) => void): void {
    this.onAudioCallback = callback;
  }

  getStatus(): {
    isConnected: boolean;
    isRecording: boolean;
    sessionId: string | null;
    model: string;
  } {
    return {
      isConnected: this.isConnected,
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      model: this.model
    };
  }
}
