/**
 * Hook for OpenAI Realtime API integration
 * Provides WebRTC-based real-time voice conversation
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseOpenAIRealtimeResults {
  client: OpenAIRealtimeClient;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setConfig: (config: any) => void;
  volume: number;
  lastError: string | null;
}

export interface OpenAIRealtimeConfig {
  model?: string;
  voice?: string;
  temperature?: number;
  maxResponseOutputTokens?: number;
  systemMessage?: string;
}

export class OpenAIRealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private localStream: MediaStream | null = null;
  private apiUrl: string;
  private config: OpenAIRealtimeConfig = {};
  
  // Event callbacks
  private onVolumeUpdate?: (volume: number) => void;
  private onConnected?: () => void;
  private onDisconnected?: () => void;
  private onError?: (error: string) => void;

  constructor(apiUrl: string = 'http://localhost:3001') {
    this.apiUrl = apiUrl;
  }

  setConfig(config: OpenAIRealtimeConfig) {
    this.config = { ...this.config, ...config };
  }

  async connect(): Promise<void> {
    try {
      console.log('🔗 OpenAI Realtime: Starting connection...');
      
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        console.log('🔊 OpenAI Realtime: Received remote audio stream');
        const remoteStream = event.streams[0];
        
        if (!this.audioElement) {
          this.audioElement = new Audio();
          this.audioElement.autoplay = true;
        }
        
        this.audioElement.srcObject = remoteStream;
        
        // Monitor volume from remote audio
        this.setupVolumeMonitoring(remoteStream);
      };

      // Create data channel for text communication
      this.dataChannel = this.peerConnection.createDataChannel('messages', {
        ordered: true
      });

      this.dataChannel.onopen = () => {
        console.log('📡 OpenAI Realtime: Data channel opened');
        if (this.onConnected) this.onConnected();
      };

      this.dataChannel.onmessage = (event) => {
        console.log('📩 OpenAI Realtime: Received message:', event.data);
      };

      this.dataChannel.onerror = (error) => {
        console.error('❌ OpenAI Realtime: Data channel error:', error);
        if (this.onError) this.onError('Data channel error');
      };

      // Handle ICE connection state
      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log('🧊 OpenAI Realtime: ICE connection state:', state);
        
        if (state === 'failed' || state === 'disconnected') {
          if (this.onError) this.onError('Connection lost');
        }
      };

      // Create and send SDP offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to backend for OpenAI Realtime API
      const response = await fetch(`${this.apiUrl}/api/realtime/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: offer,
          config: this.config
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const { sdp: answerSdp } = await response.json();
      
      if (!answerSdp) {
        throw new Error('No SDP answer received from server');
      }

      // Set remote description
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      console.log('✅ OpenAI Realtime: Connection established successfully');

    } catch (error) {
      console.error('❌ OpenAI Realtime: Connection failed:', error);
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔌 OpenAI Realtime: Disconnecting...');
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    if (this.onVolumeUpdate) {
      this.onVolumeUpdate(0);
    }

    if (this.onDisconnected) {
      this.onDisconnected();
    }
  }

  private setupVolumeMonitoring(stream: MediaStream) {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateVolume = () => {
        if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        
        const average = sum / dataArray.length;
        const normalizedVolume = average / 255;
        
        if (this.onVolumeUpdate) {
          this.onVolumeUpdate(normalizedVolume);
        }
        
        requestAnimationFrame(updateVolume);
      };
      
      updateVolume();
    } catch (error) {
      console.warn('⚠️ OpenAI Realtime: Volume monitoring setup failed:', error);
    }
  }

  sendMessage(message: string) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ 
        type: 'user_message',
        text: message 
      }));
    }
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  // Event handlers
  onVolumeChange(callback: (volume: number) => void) {
    this.onVolumeUpdate = callback;
  }

  onConnect(callback: () => void) {
    this.onConnected = callback;
  }

  onDisconnect(callback: () => void) {
    this.onDisconnected = callback;
  }

  onErrorChange(callback: (error: string) => void) {
    this.onError = callback;
  }
}

export function useOpenAIRealtime(options: { apiUrl?: string } = {}): UseOpenAIRealtimeResults {
  const { apiUrl = 'http://localhost:3001' } = options;
  
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const clientRef = useRef<OpenAIRealtimeClient>();
  
  if (!clientRef.current) {
    clientRef.current = new OpenAIRealtimeClient(apiUrl);
  }

  const client = clientRef.current;

  useEffect(() => {
    client.onVolumeChange(setVolume);
    client.onConnect(() => {
      setConnected(true);
      setConnecting(false);
      setLastError(null);
    });
    client.onDisconnect(() => {
      setConnected(false);
      setConnecting(false);
    });
    client.onErrorChange((error) => {
      setLastError(error);
      setConnecting(false);
      setConnected(false);
    });
  }, [client]);

  const connect = useCallback(async () => {
    if (connecting || connected) return;
    
    setConnecting(true);
    setLastError(null);
    
    try {
      await client.connect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setLastError(errorMessage);
      setConnecting(false);
    }
  }, [client, connecting, connected]);

  const disconnect = useCallback(async () => {
    await client.disconnect();
  }, [client]);

  const setConfig = useCallback((config: OpenAIRealtimeConfig) => {
    client.setConfig(config);
  }, [client]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  return {
    client,
    connected,
    connecting,
    connect,
    disconnect,
    setConfig,
    volume,
    lastError
  };
}