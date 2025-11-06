/**
 * Simplified OpenAI Realtime Client for Testing
 */
export class OpenAIRealtimeClient {
  private websocket: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private isConnected = false
  private isRecording = false
  private apiKey: string
  private onMessageCallback: ((message: string) => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async connect(): Promise<void> {
    try {
      console.log('⚡ OpenAI Realtime: Connecting...')
      
      // For now, use simplified mode without WebSocket
      this.audioContext = new AudioContext({ sampleRate: 24000 })
      this.isConnected = true
      
      console.log('⚡ OpenAI Realtime: Connected (simplified mode)')
      
    } catch (error) {
      console.error('⚡ OpenAI Realtime: Connection failed:', error)
      this.isConnected = false
      if (this.onErrorCallback) {
        this.onErrorCallback('Failed to connect to OpenAI Realtime')
      }
    }
  }

  async startRecording(): Promise<void> {
    try {
      console.log('⚡ OpenAI Realtime: Recording started')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
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
      console.error('⚡ OpenAI Realtime: Recording failed:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback('Microphone access failed')
      }
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      console.log('⚡ OpenAI Realtime: Recording stopped')
      this.mediaRecorder.stop()
      this.isRecording = false
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    try {
      // For now, just send a text response
      // In future: send to OpenAI Realtime API
      
      console.log('⚡ OpenAI Realtime: Processing audio...')
      
      // Simulate processing delay
      setTimeout(() => {
        if (this.onMessageCallback) {
          this.onMessageCallback('OpenAI Realtime: I received your audio message! (Audio processing in development)')
        }
      }, 800)
      
    } catch (error) {
      console.error('⚡ OpenAI Realtime: Audio processing failed:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback('Audio processing failed')
      }
    }
  }

  disconnect(): void {
    console.log('⚡ OpenAI Realtime: Disconnected')
    
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    
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