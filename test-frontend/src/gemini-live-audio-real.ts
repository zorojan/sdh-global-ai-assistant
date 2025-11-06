/**
 * Real Gemini Live Audio Client
 * Connects to Google Gemini Live API via WebSocket for real audio interaction
 */

export class GeminiLiveAudioClient {
  private ws: WebSocket | null = null
  private audioContext: AudioContext | null = null
  private audioProcessorNode: ScriptProcessorNode | null = null
  private recordedAudioData: Int16Array[] = []
  private isConnected = false
  private isRecording = false
  private apiKey: string
  private model: string = 'gemini-2.5-flash-preview-native-audio-dialog'
  private ttsModel: string = 'gemini-2.5-flash'
  
  private onMessageCallback: ((message: string) => void) | null = null
  private onErrorCallback: ((error: string) => void) | null = null
  private onAudioCallback: ((audioData: Uint8Array) => void) | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async connect(agent: any, options?: { model?: string; ttsModel?: string }): Promise<void> {
    try {
      console.log('🎙️ Gemini Live Audio: Connecting...')
      
      if (options?.model) {
        this.model = options.model
        console.log('🎙️ Gemini Live Audio: Audio Model =', this.model)
      }
      if (options?.ttsModel) {
        this.ttsModel = options.ttsModel
        console.log('🎙️ Gemini Live Audio: TTS Model =', this.ttsModel)
      }

      // Initialize WebSocket connection to Gemini API
      const wsUrl = `wss://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`
      
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('🎙️ Gemini Live Audio: WebSocket connected')
        this.isConnected = true
        
        // Send initial setup message with model and system prompt
        const setupMessage = {
          setup: {
            model: `models/${this.model}`,
            generationConfig: {
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck'
                  }
                }
              },
              temperature: 0.8
            },
            systemInstruction: {
              parts: [
                {
                  text: agent?.system_prompt || 'You are a helpful AI assistant.'
                }
              ]
            }
          }
        }
        
        this.ws!.send(JSON.stringify(setupMessage))
        console.log('🎙️ Gemini Live Audio: Setup message sent')
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle server text response
          if (data.serverContent?.modelTurn?.parts) {
            for (const part of data.serverContent.modelTurn.parts) {
              if (part.text) {
                console.log('🎙️ Gemini Live Audio: Response text received:', part.text)
                if (this.onMessageCallback) {
                  this.onMessageCallback(part.text)
                }
              }
              
              // Handle audio response
              if (part.inlineData?.mimeType?.includes('audio')) {
                const audioBase64 = part.inlineData.data
                const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
                console.log('🎙️ Gemini Live Audio: Audio response received, size:', audioBytes.length)
                if (this.onAudioCallback) {
                  this.onAudioCallback(audioBytes)
                }
                // Play audio
                this.playAudio(audioBytes)
              }
            }
          }
          
          // Handle turn complete
          if (data.serverContent?.turnComplete) {
            console.log('🎙️ Gemini Live Audio: Turn complete')
          }
          
        } catch (error) {
          console.error('🎙️ Gemini Live Audio: Error parsing message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('🎙️ Gemini Live Audio: WebSocket error:', error)
        if (this.onErrorCallback) {
          this.onErrorCallback(`WebSocket error: ${error}`)
        }
      }

      this.ws.onclose = () => {
        console.log('🎙️ Gemini Live Audio: WebSocket closed')
        this.isConnected = false
      }

    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Connection failed:', error)
      this.isConnected = false
      if (this.onErrorCallback) {
        this.onErrorCallback(`Failed to connect: ${error}`)
      }
    }
  }

  async startRecording(): Promise<void> {
    try {
      console.log('🎙️ Gemini Live Audio: Recording started')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      })

      const source = this.audioContext.createMediaStreamSource(stream)
      this.audioProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1)

      this.audioProcessorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        const int16Data = this.convertFloat32ToInt16(inputData)
        this.recordedAudioData.push(int16Data)
        
        // Send audio chunk to API in real time
        if (this.ws && this.isConnected && this.recordedAudioData.length % 2 === 0) {
          this.sendAudioChunk(int16Data)
        }
      }

      source.connect(this.audioProcessorNode)
      this.audioProcessorNode.connect(this.audioContext.destination)
      
      this.isRecording = true

    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Recording failed:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(`Microphone access failed: ${error}`)
      }
    }
  }

  stopRecording(): void {
    if (this.audioProcessorNode) {
      this.audioProcessorNode.disconnect()
    }
    
    if (this.audioContext) {
      this.audioContext.close()
    }
    
    this.isRecording = false
    console.log('🎙️ Gemini Live Audio: Recording stopped')
    
    // Send finish message
    if (this.ws && this.isConnected) {
      const finishMessage = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: '' }]
            }
          ],
          turnComplete: true
        }
      }
      this.ws.send(JSON.stringify(finishMessage))
    }
  }

  private sendAudioChunk(audioData: Int16Array): void {
    if (!this.ws || !this.isConnected) return
    
    try {
      const audioBase64 = this.arrayBufferToBase64(audioData.buffer as ArrayBuffer)
      
      const audioMessage = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: audioBase64
                  }
                }
              ]
            }
          ]
        }
      }
      
      this.ws.send(JSON.stringify(audioMessage))
    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Error sending audio chunk:', error)
    }
  }

  private playAudio(audioBytes: Uint8Array): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioBuffer = this.audioContext.createBuffer(1, audioBytes.length / 2, 16000)
      const channelData = audioBuffer.getChannelData(0)
      
      // Convert byte array to float
      const int16Array = new Int16Array(audioBytes.buffer)
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0
      }

      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.start()
      
      console.log('🎙️ Gemini Live Audio: Playing audio response')
    } catch (error) {
      console.error('🎙️ Gemini Live Audio: Error playing audio:', error)
    }
  }

  private convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  disconnect(): void {
    console.log('🎙️ Gemini Live Audio: Disconnecting...')
    
    if (this.audioProcessorNode) {
      this.audioProcessorNode.disconnect()
    }
    
    if (this.audioContext) {
      this.audioContext.close()
    }
    
    if (this.ws) {
      this.ws.close()
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

  onAudio(callback: (audioData: Uint8Array) => void): void {
    this.onAudioCallback = callback
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  getRecordingStatus(): boolean {
    return this.isRecording
  }
}
