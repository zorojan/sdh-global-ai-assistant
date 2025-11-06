/**
 * Simplified Gemini Live Client for Testing
 */
export class GeminiLiveClient {
  private audioContext: AudioContext | null = null
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private isConnected = false
  private isRecording = false
  private apiKey: string
  private connectedModel: string | null = null
  private ttsModel: string | null = null
  private onMessageCallback: ((message: string) => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async connect(agent: any, options?: { model?: string, ttsModel?: string }): Promise<void> {
    try {
      console.log('🤖 Gemini Live: Connecting...')
      if (options?.model) {
        this.connectedModel = options.model
        console.log('🤖 Gemini Live: connect model =', this.connectedModel)
      }
      if (options?.ttsModel) {
        this.ttsModel = options.ttsModel
        console.log('🤖 Gemini Live: TTS model =', this.ttsModel)
      }
      
      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.isConnected = true
      
  console.log('🤖 Gemini Live: Connected (simplified mode)')
      
    } catch (error) {
      console.error('🤖 Gemini Live: Connection failed:', error)
      this.isConnected = false
      if (this.onErrorCallback) {
        this.onErrorCallback('Failed to connect to Gemini')
      }
    }
  }

  async startRecording(): Promise<void> {
    try {
      console.log('🤖 Gemini Live: Recording started')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      this.recordedChunks = []
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.recordedChunks, { 
          type: 'audio/webm;codecs=opus' 
        })
        
        // Send to backend for processing
        await this.processAudio(audioBlob)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      this.mediaRecorder.start()
      this.isRecording = true

    } catch (error) {
      console.error('🤖 Gemini Live: Recording failed:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback('Microphone access failed')
      }
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      console.log('🤖 Gemini Live: Recording stopped')
      this.mediaRecorder.stop()
      this.isRecording = false
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    try {
      // For now, just send a text response
      // In future: convert audio to text and send to Gemini
      
      console.log('🤖 Gemini Live: Processing audio...')
      
      // Simulate processing delay
      setTimeout(() => {
        if (this.onMessageCallback) {
          const ttsInfo = this.ttsModel ? ` (TTS: ${this.ttsModel})` : ''
          const modelInfo = this.connectedModel ? ` [model: ${this.connectedModel}]` : ''
          this.onMessageCallback(`Gemini Live: Получил ваше аудио сообщение!${modelInfo}${ttsInfo} (Обработка аудио в разработке)`)
        }
      }, 1000)
      
    } catch (error) {
      console.error('🤖 Gemini Live: Audio processing failed:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback('Audio processing failed')
      }
    }
  }

  disconnect(): void {
    console.log('🤖 Gemini Live: Disconnected')
    
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
    }
    
    if (this.audioContext) {
      this.audioContext.close()
    }
    
    this.isConnected = false
    this.isRecording = false
  }

  onMessage(callback: (message: string) => void): void {
    this.onMessageCallback = callback
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  getRecordingStatus(): boolean {
    return this.isRecording
  }
}