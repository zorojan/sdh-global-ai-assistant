/**
 * Gemini Live Audio Client with Backend Proxy
 * Uses backend REST API instead of direct WebSocket to avoid CORS/browser issues
 */

export class GeminiLiveAudioClient {
  private apiUrl = 'http://localhost:3001/api/gemini/audio';
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isConnected = false;
  private isRecording = false;
  private model: string = 'gemini-2.5-flash-preview-native-audio-dialog';
  private ttsModel: string = 'gemini-2.5-flash';
  private systemPrompt: string = 'You are a helpful AI assistant.';

  private onMessageCallback: ((message: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onAudioCallback: ((audioData: Uint8Array) => void) | null = null;

  constructor(_apiKey: string) {
    // API key passed but not directly used since backend handles Gemini API auth
  }

  async connect(agent: any, options?: { model?: string; ttsModel?: string }): Promise<void> {
    try {
      console.log('🎙️ Gemini Live Audio: Connecting via backend...');

      if (options?.model) {
        this.model = options.model;
        console.log('🎙️ Gemini Live Audio: Audio Model =', this.model);
      }
      if (options?.ttsModel) {
        this.ttsModel = options.ttsModel;
        console.log('🎙️ Gemini Live Audio: TTS Model =', this.ttsModel);
      }

      if (agent?.system_prompt) {
        this.systemPrompt = agent.system_prompt;
      }

      // Start session on backend
      const sessionResponse = await fetch(`${this.apiUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          ttsModel: this.ttsModel,
          systemPrompt: this.systemPrompt,
          agentId: agent?.id
        })
      });

      const sessionData = (await sessionResponse.json()) as any;

      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || 'Failed to start session');
      }

      console.log('🎙️ Gemini Live Audio: Session started');
      console.log('   Endpoint:', sessionData.session.endpoint);
      console.log('   API Key:', sessionData.session.apiKey);

      this.isConnected = true;
    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Connection failed:', error);
      this.isConnected = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(
          `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  async startRecording(): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected. Call connect() first.');
      }

      console.log('🎙️ Gemini Live Audio: Recording started');

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

      // Create media stream source for audio context
      this.audioContext.createMediaStreamSource(stream);

      // Use MediaRecorder for simpler audio capture
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const audioBlob = event.data;
          const audioBase64 = await this.blobToBase64(audioBlob);
          await this.sendAudioMessage(audioBase64);
        }
      };

      this.mediaRecorder.start(1000); // Send audio chunk every 1 second
      this.isRecording = true;
    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Recording failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(
          `Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log('🎙️ Gemini Live Audio: Recording stopped');
    }

    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  private async sendAudioMessage(audioBase64: string): Promise<void> {
    try {
      console.log('🎙️ Gemini Live Audio: Sending audio chunk to backend...');
      console.log('   Audio size:', Math.round(audioBase64.length / 1024), 'KB');

      const startTime = Date.now();
      const response = await fetch(`${this.apiUrl}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          model: this.model,
          ttsModel: this.ttsModel,
          systemPrompt: this.systemPrompt
        })
      });

      const elapsedTime = Date.now() - startTime;
      console.log('   Response time:', elapsedTime, 'ms');

      const result = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: ${result.details || 'Failed to process audio'}`);
      }

      console.log('🎙️ Gemini Live Audio: Response received');
      console.log('   Text:', result.text?.substring(0, 100) || '(empty)');
      console.log('   Has audio:', !!result.audio);

      // Handle text response
      if (result.text && this.onMessageCallback) {
        console.log('🎙️ Gemini Live Audio: Calling message callback with text');
        this.onMessageCallback(result.text);
      }

      // Handle audio response
      if (result.audio && this.onAudioCallback) {
        console.log('🎙️ Gemini Live Audio: Processing audio response');
        try {
          const audioBytes = this.base64ToUint8Array(result.audio);
          console.log('   Audio bytes:', audioBytes.length);
          this.onAudioCallback(audioBytes);
          this.playAudio(audioBytes);
        } catch (audioError) {
          console.error('🎙️ Gemini Live Audio: Error processing audio response:', audioError);
        }
      }
    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Error sending audio:', error);
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

      console.log('🎙️ Gemini Live Audio: Playing audio response');
    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Error playing audio:', error);
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  disconnect(): void {
    console.log('🎙️ Gemini Live Audio: Disconnecting...');

    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.isConnected = false;
    this.isRecording = false;
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

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }
}
