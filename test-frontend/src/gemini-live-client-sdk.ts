/**
 * Gemini Live Audio Client using @google/genai SDK
 * Rewritten based on official Google example with best practices
 * Features: Gapless audio playback, proper sample rates, enhanced transcription handling
 */

import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';

/**
 * Official Audio Utility Functions from Google GenAI Live API Guide
 * These functions are necessary for handling the raw PCM audio data from the API.
 */

/**
 * Encodes raw audio bytes into a Base64 string.
 */
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into raw audio bytes (Uint8Array).
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer for playback.
 */
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

/**
 * Creates a Blob object for sending audio data to the Gemini API.
 */
function createPcmBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000', // Input audio must be 16kHz.
    };
}

/**
 * AsyncQueue for reliable message handling
 * Based on official examples from googleapis/js-genai
 */
class AsyncQueue<T> {
  private items: T[] = [];
  private resolvers: ((value: T | null) => void)[] = [];

  put(item: T): void {
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(item);
    } else {
      this.items.push(item);
    }
  }

  async get(): Promise<T | null> {
    if (this.items.length > 0) {
      return this.items.shift()!;
    }
    return new Promise<T | null>(resolve => {
      this.resolvers.push(resolve);
    });
  }

  clear(): void {
    this.items = [];
    this.resolvers.forEach(resolve => resolve(null));
    this.resolvers = [];
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * Performance metrics for monitoring and optimization
 */
interface PerformanceMetrics {
  connectionLatency: number;
  audioLatency: number;
  messageRate: number;
  errorRate: number;
  totalMessages: number;
  startTime: number;
}

export class GeminiLiveClientSDK {
  private ai: GoogleGenAI;
  private session: any = null;
  private isConnected = false;
  private isRecording = false;
  
  // Official dual AudioContext approach: 16kHz input, 24kHz output
  private inputAudioContext: AudioContext | null = null;  // 16kHz for microphone
  private outputAudioContext: AudioContext | null = null; // 24kHz for AI responses
  
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  
  // Official gapless audio playback system
  private nextStartTime = 0;
  private outputSources = new Set<AudioBufferSourceNode>();
  
  // Enhanced transcription management (official pattern)
  private currentInputTranscription = '';
  private currentOutputTranscription = '';
  private transcriptLog: { role: 'user' | 'model', text: string }[] = [];

  // Enhanced message handling with AsyncQueue
  private messageQueue = new AsyncQueue<LiveServerMessage>();
  private isProcessingMessages = false;
  private performanceMonitoringInterval: NodeJS.Timeout | null = null;

  // Performance metrics
  private metrics: PerformanceMetrics = {
    connectionLatency: 0,
    audioLatency: 0,
    messageRate: 0,
    errorRate: 0,
    totalMessages: 0,
    startTime: Date.now()
  };

  private onMessageCallback: ((message: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onAudioCallback: ((audioData: Uint8Array) => void) | null = null;
  private onTranscriptCallback: ((log: { role: 'user' | 'model', text: string }[]) => void) | null = null;

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
              this.metrics.startTime = Date.now();
              this.startPerformanceMonitoring();
              console.log('📊 AsyncQueue: Performance monitoring started');
            },
            onmessage: (message) => {
              console.log('📨 Gemini Live SDK: Received message:', message);
              this.enqueueMessage(message);
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
              
              // Clean up AsyncQueue and monitoring
              this.messageQueue.clear();
              this.stopPerformanceMonitoring();
              console.log('📊 AsyncQueue: Performance monitoring stopped');
              
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

  /**
   * Enhanced message handling based on official Google example
   * Processes transcriptions and audio with proper gapless playback
   */
  private enqueueMessage(message: LiveServerMessage): void {
    this.metrics.totalMessages++;
    this.messageQueue.put(message);
    
    if (!this.isProcessingMessages) {
      this.processMessageQueue();
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingMessages) return;
    this.isProcessingMessages = true;

    console.log('� AsyncQueue: Starting message processing...');

    try {
      while (this.isConnected) {
        const message = await this.messageQueue.get();
        if (!message) break;
        
        const startTime = performance.now();
        await this.processMessage(message);
        const processingTime = performance.now() - startTime;
        
        this.updateMetrics(processingTime);
      }
    } catch (error) {
      console.error('❌ AsyncQueue: Error in message processing:', error);
      this.metrics.errorRate++;
    } finally {
      this.isProcessingMessages = false;
      console.log('⏹️ AsyncQueue: Message processing stopped');
    }
  }

  private async processMessage(message: LiveServerMessage): Promise<void> {
    console.log('📨 Official: Processing message:', message.constructor.name);
    console.log('   Queue size:', this.messageQueue.size);
    
    // --- Process Transcription (Official Pattern) ---
    if (message.serverContent?.inputTranscription) {
      this.currentInputTranscription += message.serverContent.inputTranscription.text;
      console.log('➡️📝 Official: Input transcription fragment:', message.serverContent.inputTranscription.text);
    }
    
    if (message.serverContent?.outputTranscription) {
      this.currentOutputTranscription += message.serverContent.outputTranscription.text;
      console.log('🤖📝 Official: Output transcription fragment:', message.serverContent.outputTranscription.text);
    }

    // When a full turn is complete, log the transcripts and reset (Official Pattern)
    if (message.serverContent?.turnComplete) {
      const userInput = this.currentInputTranscription.trim();
      if (userInput) {
        this.transcriptLog.push({ role: 'user', text: userInput });
        console.log('👤 Official: User complete:', userInput);
        if (this.onMessageCallback) {
          this.onMessageCallback(`User: ${userInput}`);
        }
      }
      
      const modelOutput = this.currentOutputTranscription.trim();
      if (modelOutput) {
        this.transcriptLog.push({ role: 'model', text: modelOutput });
        console.log('🤖 Official: Model complete:', modelOutput);
        if (this.onMessageCallback) {
          this.onMessageCallback(`AI: ${modelOutput}`);
        }
      }
      
      // Send transcript log update
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback([...this.transcriptLog]);
      }
      
      // Reset for new turn
      this.currentInputTranscription = '';
      this.currentOutputTranscription = '';
      console.log('✅ Official: Turn completed, transcriptions reset');
    }

    // --- Process and Play Audio Output (Official Gapless Pattern) ---
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      console.log('🔊 Official: Audio content received, implementing gapless playback');
      const audioStart = performance.now();
      
      try {
        // Official gapless playback implementation
        await this.playAudioGapless(base64Audio);
        this.metrics.audioLatency = performance.now() - audioStart;
        
        if (this.onAudioCallback) {
          const audioData = decode(base64Audio);
          this.onAudioCallback(audioData);
        }
      } catch (error) {
        console.error('❌ Official: Gapless audio playback failed:', error);
        this.metrics.errorRate++;
      }
    }

    // Handle text content (fallback)
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
          console.log('📝 Official: Direct text content received:', part.text.substring(0, 200));
          if (this.onMessageCallback) {
            this.onMessageCallback(part.text);
          }
        }
      }
    }
    
    // Handle any errors in the message
    if ((message as any).error) {
      console.error('❌ Official: Message error:', (message as any).error);
      this.metrics.errorRate++;
    }
  }

  private updateMetrics(processingTime: number): void {
    const now = Date.now();
    const elapsed = (now - this.metrics.startTime) / 1000; // seconds
    this.metrics.messageRate = this.metrics.totalMessages / elapsed;
    
    // Log performance every 10 messages
    if (this.metrics.totalMessages % 10 === 0) {
      console.log('📊 AsyncQueue Metrics:', {
        totalMessages: this.metrics.totalMessages,
        messageRate: this.metrics.messageRate.toFixed(2) + '/sec',
        avgProcessingTime: processingTime.toFixed(2) + 'ms',
        audioLatency: this.metrics.audioLatency.toFixed(2) + 'ms',
        errorRate: this.metrics.errorRate,
        queueSize: this.messageQueue.size
      });
    }
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitoringInterval = setInterval(() => {
      const uptime = (Date.now() - this.metrics.startTime) / 1000;
      console.log('📈 Performance Summary:', {
        uptime: `${uptime.toFixed(0)}s`,
        totalMessages: this.metrics.totalMessages,
        avgMessageRate: this.metrics.messageRate.toFixed(2) + '/sec',
        successRate: ((this.metrics.totalMessages - this.metrics.errorRate) / this.metrics.totalMessages * 100).toFixed(1) + '%',
        queueSize: this.messageQueue.size,
        connectionStatus: this.isConnected ? '🟢 Connected' : '🔴 Disconnected'
      });
    }, 15000); // Every 15 seconds
  }

  private stopPerformanceMonitoring(): void {
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = null;
    }
  }

  /**
   * Official gapless audio playback implementation
   * Ensures smooth, uninterrupted audio streaming
   */
  private async playAudioGapless(base64Audio: string): Promise<void> {
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 24000 // Official 24kHz output sample rate
      });
    }

    try {
      // Ensure the next audio chunk starts right after the previous one finishes
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);

      const audioBuffer = await decodeAudioData(
        decode(base64Audio), 
        this.outputAudioContext, 
        24000, // 24kHz sample rate for output
        1      // Mono channel
      );
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);
      source.addEventListener('ended', () => this.outputSources.delete(source));
      
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration; // Schedule the next chunk
      this.outputSources.add(source);
      
      console.log('✅ Official: Gapless audio playing, duration:', audioBuffer.duration.toFixed(3), 'sec');
      
    } catch (error) {
      console.error('❌ Official: Gapless audio decode error:', error);
      throw error;
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

      console.log('🎙️ Official: Starting microphone with proper sample rates...');
      
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

      // Initialize input audio context (Official 16kHz for input)
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // Set up ScriptProcessorNode for real-time PCM audio processing
      const mediaStreamSource = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
      this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

      // Process audio in real-time and convert to PCM format (Official Pattern)
      this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording || !this.session) return;

        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        
        // Check if there's actual audio content (avoid sending silence)
        const hasAudio = inputData.some(sample => Math.abs(sample) > 0.01);
        if (!hasAudio) {
          return; // Skip silent chunks
        }

        // Use official createPcmBlob function
        const pcmBlob = createPcmBlob(inputData);
        
        // Send audio to session (Official Pattern)
        if (this.session && this.isConnected && this.isRecording) {
          try {
            this.session.sendRealtimeInput({ media: pcmBlob });
            console.log('✅ Official: PCM audio chunk sent successfully');
          } catch (error) {
            console.error('❌ Official: Error sending PCM audio:', error);
            
            // If error suggests session is closed, stop recording
            if (error instanceof Error && (error.message.includes('session') || error.message.includes('closed'))) {
              console.log('🔄 Official: Session error detected, stopping recording');
              this.stopRecording();
            }
          }
        }
      };

      // Connect audio processing chain (Official Pattern)
      if (this.scriptProcessor && this.inputAudioContext) {
        mediaStreamSource.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.inputAudioContext.destination);
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
      console.log('🎙️ Official: Recording stopped');
    }

    // Stop all media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close input audio context (16kHz)
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    
    // Stop script processor
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
  }

  /**
   * Enhanced disconnect with proper cleanup of dual audio contexts
   */

  async disconnect(): Promise<void> {
    console.log('🎙️ Official: Disconnecting...');

    this.stopRecording();

    // Clean up AsyncQueue and performance monitoring
    this.messageQueue.clear();
    this.stopPerformanceMonitoring();
    this.isProcessingMessages = false;
    console.log('📊 Official: AsyncQueue cleanup completed');

    // Stop all output audio sources (gapless playback cleanup)
    this.outputSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (error) {
        // Source might already be stopped
      }
    });
    this.outputSources.clear();
    this.nextStartTime = 0;

    // Close output audio context (24kHz)
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }

    // Reset transcription state
    this.currentInputTranscription = '';
    this.currentOutputTranscription = '';
    this.transcriptLog = [];

    if (this.session) {
      try {
        await this.session.close();
      } catch (error) {
        console.error('🎙️ Official: Error closing session:', error);
      }
      this.session = null;
    }

    this.isConnected = false;
    console.log('🎙️ Official: Disconnected with complete cleanup');
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

  onTranscript(callback: (log: { role: 'user' | 'model', text: string }[]) => void): void {
    this.onTranscriptCallback = callback;
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



  /**
   * Get current transcription log
   * Returns array of user and model messages with timestamps
   */
  getTranscriptLog(): { role: 'user' | 'model', text: string }[] {
    return [...this.transcriptLog];
  }

  /**
   * Clear transcription history
   */
  clearTranscriptLog(): void {
    this.transcriptLog = [];
    this.currentInputTranscription = '';
    this.currentOutputTranscription = '';
    console.log('📝 Official: Transcript log cleared');
  }
}