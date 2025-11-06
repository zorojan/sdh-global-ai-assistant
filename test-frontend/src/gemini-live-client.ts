// Gemini Live API integration for test frontend
export class GeminiLiveClient {
  private websocket: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private mediaRecorder: MediaRecorder | null = null
  private isConnected = false
  private apiKey: string
  private onMessageCallback?: (message: string) => void
  private onErrorCallback?: (error: string) => void

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async connect(agent: any): Promise<void> {
    try {
      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      
      // Connect to Gemini Live API via WebSocket
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?key=${this.apiKey}`
      
      this.websocket = new WebSocket(wsUrl)
      
      this.websocket.onopen = () => {
        console.log('🤖 Gemini Live: Connected')
        this.isConnected = true
        
        // Send setup configuration
        this.sendSetupMessage(agent)
      }
      
      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event.data)
      }
      
      this.websocket.onerror = (error) => {
        console.error('🤖 Gemini Live: WebSocket error:', error)
        if (this.onErrorCallback) {
          this.onErrorCallback('Gemini Live connection failed')
        }
      }
      
      this.websocket.onclose = () => {
        console.log('🤖 Gemini Live: Disconnected')
        this.isConnected = false
      }

    } catch (error) {
      console.error('🤖 Gemini Live: Connection error:', error)
      throw new Error(`Gemini Live connection failed: ${error}`)
    }
  }

  private sendSetupMessage(agent: any) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return

    const setupMessage = {
      setup: {
        model: "models/gemini-2.0-flash-exp",
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: agent?.voice || "Orus"
              }
            }
          }
        },
        system_instruction: {
          parts: [{
            text: `${agent?.personality || 'You are a helpful AI assistant.'}\n\nLanguage: ${agent?.language || 'hy-AM'}\nKeep responses conversational and brief for voice chat.`
          }]
        }
      }
    }

    this.websocket.send(JSON.stringify(setupMessage))
    console.log('🤖 Gemini Live: Setup sent', setupMessage)
  }

  private handleWebSocketMessage(data: string) {
    try {
      const message = JSON.parse(data)
      console.log('🤖 Gemini Live: Received:', message)

      if (message.candidates && message.candidates.length > 0) {
        const candidate = message.candidates[0]
        
        // Handle text response
        if (candidate.content && candidate.content.parts) {
          const textPart = candidate.content.parts.find((part: any) => part.text)
          if (textPart && this.onMessageCallback) {
            this.onMessageCallback(textPart.text)
          }
        }

        // Handle audio response
        if (candidate.content && candidate.content.parts) {
          const audioPart = candidate.content.parts.find((part: any) => part.inline_data && part.inline_data.mime_type.includes('audio'))
          if (audioPart) {
            this.playAudioResponse(audioPart.inline_data.data)
          }
        }
      }

    } catch (error) {
      console.error('🤖 Gemini Live: Message parse error:', error)
    }
  }

  private async playAudioResponse(base64Audio: string) {
    try {
      if (!this.audioContext) return

      // Decode base64 audio
      const audioData = atob(base64Audio)
      const arrayBuffer = new ArrayBuffer(audioData.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i)
      }

      // Decode and play audio
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start()

      console.log('🤖 Gemini Live: Playing audio response')

    } catch (error) {
      console.error('🤖 Gemini Live: Audio playback error:', error)
    }
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      })

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isConnected) {
          this.sendAudioData(event.data)
        }
      }

      this.mediaRecorder.start(100) // Send chunks every 100ms
      console.log('🤖 Gemini Live: Recording started')

    } catch (error) {
      console.error('🤖 Gemini Live: Recording error:', error)
      throw error
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
      this.mediaRecorder = null
      console.log('🤖 Gemini Live: Recording stopped')
    }
  }

  private async sendAudioData(audioBlob: Blob): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const base64 = btoa(String.fromCharCode(...uint8Array))

      const audioMessage = {
        realtime_input: {
          media_chunks: [{
            mime_type: "audio/webm;codecs=opus",
            data: base64
          }]
        }
      }

      this.websocket.send(JSON.stringify(audioMessage))

    } catch (error) {
      console.error('🤖 Gemini Live: Send audio error:', error)
    }
  }

  sendTextMessage(text: string): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return

    const textMessage = {
      client_content: {
        turns: [{
          role: "user",
          parts: [{ text: text }]
        }],
        turn_complete: true
      }
    }

    this.websocket.send(JSON.stringify(textMessage))
    console.log('🤖 Gemini Live: Text sent:', text)
  }

  disconnect(): void {
    this.stopRecording()
    
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.isConnected = false
    console.log('🤖 Gemini Live: Disconnected')
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
}