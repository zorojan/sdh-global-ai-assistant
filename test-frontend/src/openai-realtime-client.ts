// OpenAI Realtime API integration for test frontend
export class OpenAIRealtimeClient {
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
      this.audioContext = new AudioContext({ sampleRate: 24000 })
      
      // Connect to OpenAI Realtime API via WebSocket
      const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`
      
      this.websocket = new WebSocket(wsUrl, ['realtime', `openai-insecure-api-key.${this.apiKey}`])
      
      this.websocket.onopen = () => {
        console.log('⚡ OpenAI Realtime: Connected')
        this.isConnected = true
        
        // Send session update
        this.sendSessionUpdate(agent)
      }
      
      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event.data)
      }
      
      this.websocket.onerror = (error) => {
        console.error('⚡ OpenAI Realtime: WebSocket error:', error)
        if (this.onErrorCallback) {
          this.onErrorCallback('OpenAI Realtime connection failed')
        }
      }
      
      this.websocket.onclose = (event) => {
        console.log('⚡ OpenAI Realtime: Disconnected', event.code, event.reason)
        this.isConnected = false
      }

    } catch (error) {
      console.error('⚡ OpenAI Realtime: Connection error:', error)
      throw new Error(`OpenAI Realtime connection failed: ${error}`)
    }
  }

  private sendSessionUpdate(agent: any) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return

    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: `${agent?.personality || 'You are a helpful AI assistant.'}\n\nLanguage: ${agent?.language || 'hy-AM'}\nKeep responses conversational and brief for voice chat.`,
        voice: agent?.voice || "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    }

    this.websocket.send(JSON.stringify(sessionUpdate))
    console.log('⚡ OpenAI Realtime: Session updated', sessionUpdate)
  }

  private handleWebSocketMessage(data: string) {
    try {
      const message = JSON.parse(data)
      console.log('⚡ OpenAI Realtime: Received:', message.type, message)

      switch (message.type) {
        case 'response.text.delta':
          if (message.delta && this.onMessageCallback) {
            this.onMessageCallback(message.delta)
          }
          break
          
        case 'response.audio.delta':
          if (message.delta) {
            this.playAudioDelta(message.delta)
          }
          break
          
        case 'response.done':
          console.log('⚡ OpenAI Realtime: Response completed')
          break
          
        case 'error':
          console.error('⚡ OpenAI Realtime: Error:', message.error)
          if (this.onErrorCallback) {
            this.onErrorCallback(message.error.message || 'OpenAI API error')
          }
          break
          
        case 'input_audio_buffer.speech_started':
          console.log('⚡ OpenAI Realtime: Speech detected')
          break
          
        case 'input_audio_buffer.speech_stopped':
          console.log('⚡ OpenAI Realtime: Speech ended')
          break
      }

    } catch (error) {
      console.error('⚡ OpenAI Realtime: Message parse error:', error)
    }
  }

  private async playAudioDelta(base64Audio: string) {
    try {
      if (!this.audioContext) return

      // Decode base64 PCM16 audio
      const audioData = atob(base64Audio)
      const arrayBuffer = new ArrayBuffer(audioData.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i)
      }

      // Convert PCM16 to AudioBuffer
      const int16Array = new Int16Array(arrayBuffer)
      const audioBuffer = this.audioContext.createBuffer(1, int16Array.length, 24000)
      const channelData = audioBuffer.getChannelData(0)
      
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0 // Convert to float32
      }

      // Play audio
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start()

    } catch (error) {
      console.error('⚡ OpenAI Realtime: Audio playback error:', error)
    }
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 24000,
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
      console.log('⚡ OpenAI Realtime: Recording started')

    } catch (error) {
      console.error('⚡ OpenAI Realtime: Recording error:', error)
      throw error
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
      this.mediaRecorder = null
      console.log('⚡ OpenAI Realtime: Recording stopped')
    }
  }

  private async sendAudioData(audioBlob: Blob): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return

    try {
      // Convert WebM to PCM16 for OpenAI (simplified - in production use proper audio conversion)
      const arrayBuffer = await audioBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const base64 = btoa(String.fromCharCode(...uint8Array))

      const audioMessage = {
        type: "input_audio_buffer.append",
        audio: base64
      }

      this.websocket.send(JSON.stringify(audioMessage))

    } catch (error) {
      console.error('⚡ OpenAI Realtime: Send audio error:', error)
    }
  }

  sendTextMessage(text: string): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return

    // Create conversation item
    const createMessage = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: text
        }]
      }
    }

    // Create response
    const createResponse = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"]
      }
    }

    this.websocket.send(JSON.stringify(createMessage))
    this.websocket.send(JSON.stringify(createResponse))
    
    console.log('⚡ OpenAI Realtime: Text sent:', text)
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
    console.log('⚡ OpenAI Realtime: Disconnected')
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