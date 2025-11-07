/**
 * Gemini Live Audio Client - Based on Working Implementation (fixed copy)
 * Uses proper PCM audio format and ScriptProcessorNode approach
 */

import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// Audio utility functions (from working example)
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

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createPcmBlob(data: Float32Array): any {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

export class GeminiLiveClientWorkingFixed {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private currentSession: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  
  private isConnected = false;
  private isRecording = false;
  
  // Audio output management
  private nextStartTime = 0;
  private outputSources = new Set<AudioBufferSourceNode>();
  
  // Transcription tracking
  private currentInputTranscription = '';
  private currentOutputTranscription = '';
  
  // Callbacks
  private onMessageCallback: ((message: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onAudioCallback: ((audioData: Uint8Array) => void) | null = null;
  private onTranscriptionCallback: ((input: string, output: string) => void) | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    console.log('🎙️ Gemini Live Working (fixed): Client initialized');
  }

  async connect(agent: any, options?: { model?: string; language?: string; voice?: string; ttsModel?: string }): Promise<void> {
    try {
      const model = options?.model || 'gemini-2.5-flash-native-audio-preview-09-2025';
      const language = options?.language || 'hy-AM';
      const voice = options?.voice || 'Kore';
      
      // Create language-specific system instruction with stronger enforcement
      let systemInstruction = agent?.system_prompt;
      if (!systemInstruction) {
        // Create appropriate instruction based on language with stronger enforcement
        if (language === 'hy-AM') {
          systemInstruction = `ԿԱՐԵՎՈՐ: Դուք ՄԻԱՅՆ հայերեն եք խոսում: Արգելված է օգտագործել անգլերեն, ռուսերեն կամ այլ լեզու: 

Դուք հայերեն խոսող օգտակար և բարեկամական զրուցակից արհեստական բանականություն եք: Զրույցը սկսեք հայերեն ողջույնով: Բոլոր պատասխանները ԲԱՑԱՌԱՊԵՍ հայերեն:

ՕՐԻՆԱԿ ողջույն: "Բարև ձեզ! Ինչպե՞ս կարող եմ օգնել:"`;
        } else if (language === 'ru-RU') {
          systemInstruction = `ВАЖНО: Вы говорите ТОЛЬКО на русском языке. Запрещено использовать английский или другие языки.

Вы полезный и дружелюбный русскоязычный ИИ-помощник. Начните разговор с приветствия на русском. Все ответы ИСКЛЮЧИТЕЛЬНО на русском языке.

ПРИМЕР приветствия: "Здравствуйте! Как дела? Чем могу помочь?"`;
        } else {
          systemInstruction = `IMPORTANT: You speak ONLY in English. Do not use any other languages.

You are a helpful and friendly English-speaking conversational AI. Start with an English greeting. All responses EXCLUSIVELY in English.

EXAMPLE greeting: "Hello! How can I help you today?"`;
        }
      } else {
        // If agent has system_prompt, ensure language enforcement is added
        if (language === 'hy-AM') {
          systemInstruction = `ԿԱՐԵՎՈՐ: Դուք ՄԻԱՅՆ հայերեն եք խոսում: Արգելված է օգտագործել անգլերեն, ռուսերեն կամ այլ լեզու:

${systemInstruction}

Բոլոր պատասխանները ԲԱՑԱՌԱՊԵՍ հայերեն:`;
        } else if (language === 'ru-RU') {
          systemInstruction = `ВАЖНО: Вы говорите ТОЛЬКО на русском языке. Запрещено использовать английский или другие языки.

${systemInstruction}

Все ответы ИСКЛЮЧИТЕЛЬНО на русском языке.`;
        } else {
          systemInstruction = `IMPORTANT: You speak ONLY in English. Do not use any other languages.

${systemInstruction}

All responses EXCLUSIVELY in English.`;
        }
      }

      console.log('🎤 Model:', model);
      console.log('🗣️ Voice:', voice);
      console.log('🌐 Language:', language);
      console.log('👤 Agent:', agent?.name || 'Unknown');
      console.log('🔧 Agent Data:', { 
        voice: agent?.voice, 
        language: agent?.language,
        voice_characteristics: agent?.voice_characteristics,
        system_prompt: agent?.system_prompt?.substring(0, 50) + '...'
      });
      console.log('⚙️ Options passed:', options);
      console.log('🎙️ System Instruction:', systemInstruction.substring(0, 100) + '...');

      console.log('🎙️ Gemini Live Working (fixed): Connecting...');
      console.log('📝 FULL SYSTEM INSTRUCTION:', systemInstruction);

      // Initialize audio contexts with proper sample rates
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create session with proper configuration and wait for it to open
      const connectConfig = {
        model: model,
        callbacks: {
          onopen: () => {
              console.log('✅ Gemini Live Working (fixed): Session opened (onopen callback)');
              try {
                // expose a global raw messages array for debugging
                (window as any).__GENAI_RAW__ = (window as any).__GENAI_RAW__ || [];
                (window as any).__GENAI_RAW__.push({ type: 'onopen', ts: Date.now() });
              } catch (e) {}
          },
            onmessage: (message: LiveServerMessage) => {
              // store raw message for debugging and forward to handler
              try {
                (window as any).__GENAI_RAW__ = (window as any).__GENAI_RAW__ || [];
                (window as any).__GENAI_RAW__.push({ type: 'onmessage', ts: Date.now(), message });
              } catch (e) {}
              this.handleMessage(message);
          },
          onerror: (error: ErrorEvent) => {
              console.error('❌ Gemini Live Working (fixed): Session error:', error);
              try {
                (window as any).__GENAI_RAW__ = (window as any).__GENAI_RAW__ || [];
                (window as any).__GENAI_RAW__.push({ type: 'onerror', ts: Date.now(), error });
              } catch (e) {}
            this.isConnected = false;
            if (this.onErrorCallback) {
              this.onErrorCallback(`Session error: ${error.message}`);
            }
          },
          onclose: () => {
              console.log('🔌 Gemini Live Working (fixed): Session closed');
              try {
                (window as any).__GENAI_RAW__ = (window as any).__GENAI_RAW__ || [];
                (window as any).__GENAI_RAW__.push({ type: 'onclose', ts: Date.now() });
              } catch (e) {}
            this.isConnected = false;
            this.currentSession = null;
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: voice 
              } 
            } 
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: systemInstruction,
        },
      };
      
      console.log('📤 FULL CONNECTION CONFIG:', JSON.stringify(connectConfig, null, 2));
      
      this.sessionPromise = this.ai.live.connect(connectConfig);

      // Wait for the session promise to resolve (ensures the session is open)
      try {
        const session = await this.sessionPromise;
        this.currentSession = session;
        console.log('🎙️ Gemini Live Working (fixed): Session promise resolved');
        // Ensure audio processing is set up (onopen may have already called it)
        try {
          this.setupAudioProcessing();
        } catch (err) {
          // setupAudioProcessing may have been called already from onopen; ignore errors
        }
        this.isConnected = true;
      } catch (err) {
        console.error('❌ Gemini Live Working (fixed): sessionPromise rejected:', err);
        this.currentSession = null;
        this.isConnected = false;
        throw err;
      }

      console.log('🎙️ Gemini Live Working (fixed): Connected successfully');
      
    } catch (error) {
      console.error('❌ Gemini Live Working (fixed): Connection failed:', error);
      this.isConnected = false;
      if (this.onErrorCallback) {
        this.onErrorCallback(
          `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      throw error;
    }
  }

  private setupAudioProcessing(): void {
    if (!this.inputAudioContext || !this.mediaStream) {
      console.error('❌ Audio context or media stream not available');
      return;
    }

    // Create audio processing chain
    this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    // Process audio in real-time
    this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
      if (!this.isRecording || !this.sessionPromise) return;

      const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      // Send audio to session if we have a live session reference
      if (!this.currentSession) return;
      try {
        // Some SDK session implementations throw if socket is closed; guard with try/catch
        this.currentSession.sendRealtimeInput({ media: pcmBlob });
      } catch (error) {
        console.error('❌ Error sending realtime input (ignored):', error);
      }
    };

    // Connect audio processing chain
    this.mediaStreamSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage): Promise<void> {
    try {
      console.log('📥 RECEIVED MESSAGE:', JSON.stringify(message, null, 2));
      
      if (message.serverContent?.inputTranscription) {
        console.log('👤 USER INPUT TRANSCRIPTION:', message.serverContent.inputTranscription.text);
        this.currentInputTranscription += message.serverContent.inputTranscription.text;
      }
      if (message.serverContent?.outputTranscription) {
        console.log('🤖 AI OUTPUT TRANSCRIPTION:', message.serverContent.outputTranscription.text);
        this.currentOutputTranscription += message.serverContent.outputTranscription.text;
      }
      if (message.serverContent?.turnComplete) {
        const userInput = this.currentInputTranscription.trim();
        const modelOutput = this.currentOutputTranscription.trim();
        if (this.onTranscriptionCallback) this.onTranscriptionCallback(userInput, modelOutput);
        if (modelOutput && this.onMessageCallback) this.onMessageCallback(modelOutput);
        this.currentInputTranscription = '';
        this.currentOutputTranscription = '';
      }
      const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await this.playAudio(base64Audio);
        if (this.onAudioCallback) this.onAudioCallback(decode(base64Audio));
      }
    } catch (error) {
      console.error('❌ Error handling message (fixed):', error);
    }
  }

  private async playAudio(base64Audio: string): Promise<void> {
    if (!this.outputAudioContext) return;
    try {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      const audioBuffer = await decodeAudioData(decode(base64Audio), this.outputAudioContext, 24000, 1);
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);
      source.addEventListener('ended', () => this.outputSources.delete(source));
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.outputSources.add(source);
    } catch (err) {
      console.error('❌ playAudio failed (fixed):', err);
    }
  }

  async startRecording(): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected. Call connect() first.');
    this.isRecording = true;
  }

  stopRecording(): void { this.isRecording = false; }

  async disconnect(): Promise<void> {
    this.isRecording = false; this.isConnected = false;
    if (this.sessionPromise) {
      try { const session = await this.sessionPromise; session.close(); } catch(e){}
      this.sessionPromise = null;
    }
    if (this.scriptProcessor) { this.scriptProcessor.disconnect(); this.scriptProcessor = null; }
    if (this.mediaStreamSource) { this.mediaStreamSource.disconnect(); this.mediaStreamSource = null; }
    if (this.mediaStream) { this.mediaStream.getTracks().forEach(t=>t.stop()); this.mediaStream = null; }
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') { await this.inputAudioContext.close(); this.inputAudioContext = null; }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') { await this.outputAudioContext.close(); this.outputAudioContext = null; }
    this.outputSources.forEach(s => s.stop()); this.outputSources.clear();
  }

  onMessage(callback: (message: string) => void): void { this.onMessageCallback = callback; }
  onError(callback: (error: string) => void): void { this.onErrorCallback = callback; }
  onAudio(callback: (audioData: Uint8Array) => void): void { this.onAudioCallback = callback; }
  onTranscription(callback: (input: string, output: string) => void): void { this.onTranscriptionCallback = callback; }
  getStatus() { return { isConnected: this.isConnected, isRecording: this.isRecording, hasSession: !!this.sessionPromise }; }
  getConnectionStatus(): boolean { return this.isConnected; }
  getRecordingStatus(): boolean { return this.isRecording; }
}
