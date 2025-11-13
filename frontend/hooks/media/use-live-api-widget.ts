/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import GenAILiveProxyClient from '../../lib/genai-live-proxy-client';
import { LiveConnectConfig } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { DEFAULT_LIVE_API_MODEL } from '../../lib/constants';

// Runtime type-guard for clients that implement simple event methods
function hasOnOff(c: any): c is { on: (...args: any[]) => any; off: (...args: any[]) => any } {
  return c && typeof c.on === 'function' && typeof c.off === 'function';
}

export type UseLiveApiResults = {
  client: GenAILiveClient | GenAILiveProxyClient | any;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  reset: () => void;
  connected: boolean;
  lastError: string | null;

  volume: number;
};

export function useLiveApiWidget({
  apiKey,
  model = DEFAULT_LIVE_API_MODEL,
}: {
  apiKey: string;
  model?: string;
}): UseLiveApiResults {
  const client = useMemo(() => {
    // If apiKey is empty use backend proxy client which does not expose keys in browser
    if (!apiKey || apiKey.trim() === '') {
      // @ts-ignore - proxy client intentionally differs from Google client but implements needed events
      return new GenAILiveProxyClient(undefined, model);
    }
    return new GenAILiveClient(apiKey, model);
  }, [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [lastError, setLastError] = useState<string | null>(null);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out-widget' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out-widget', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            console.log('🎤 Widget: Audio worklet initialized');
          })
          .catch(err => {
            console.error('❌ Widget: Error adding worklet:', err);
          });
        // Add a one-time click handler so a user gesture can resume the AudioContext
        const resumeHandler = async () => {
          try {
            if (audioStreamerRef.current) {
              await audioStreamerRef.current.resume();
              console.debug('🎧 Widget: AudioStreamer resumed via user gesture');
            }
          } catch (e) {
            console.warn('Widget: resume handler error', e);
          } finally {
            window.removeEventListener('click', resumeHandler);
          }
        };
        window.addEventListener('click', resumeHandler);
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onOpen = () => {
      console.log('✅ Widget: Voice connection established');
      setConnected(true);
    };

    const onClose = (event?: any) => {
      console.log('🔒 Widget: Voice connection closed');
      
      // Handle specific error codes
      if (event?.code === 1011) {
        const errorMsg = 'QUOTA EXCEEDED: Your Google Gemini API key has exceeded its quota limits.';
        setLastError(errorMsg);
        console.error('❌ Widget: QUOTA EXCEEDED');
      } else if (event?.code && event.code !== 1000) {
        setLastError(`Connection closed with error code ${event.code}: ${event.reason}`);
        console.warn(`⚠️ Widget: Connection closed with error code ${event.code}: ${event.reason}`);
      } else {
        setLastError(null); // Normal close
      }
      
      setConnected(false);
    };

    const onError = (error?: any) => {
      console.error('❌ Widget: Voice error:', error);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    const onAudio = (payload: ArrayBuffer | { data: ArrayBuffer; mimeType?: string }) => {
      if (!audioStreamerRef.current) return;

      // debug log audio arrival at hook level
      try { console.debug('Widget: onAudio called, payload type=', typeof payload); } catch (e) {}

      // Handle two shapes: raw ArrayBuffer (assumed PCM16) or object with mimeType
      if (payload instanceof ArrayBuffer) {
        audioStreamerRef.current.addPCM16(new Uint8Array(payload));
        return;
      }

      // payload is object with data and optional mimeType
      const data = (payload as any).data as ArrayBuffer;
      const mime = (payload as any).mimeType as string | undefined;

      if (!data) return;

      // If PCM with sample rate metadata, adjust streamer sampleRate then add PCM
      if (mime && mime.startsWith('audio/pcm')) {
        try {
          const m = /rate=(\d+)/.exec(mime || '');
          if (m && m[1]) {
            const sr = parseInt(m[1], 10);
            if (sr && audioStreamerRef.current) audioStreamerRef.current.setSampleRate(sr);
          }
        } catch (e) {}
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
        // try to ensure context is resumed (may require user gesture)
        try { audioStreamerRef.current.resume().catch(()=>{}); } catch (e) {}
        return;
      }

      // Otherwise treat as encoded container (mp3/ogg/webm). Decode and play via AudioContext
      try {
        const ctx = (audioStreamerRef.current as any).context as AudioContext;
        if (ctx && ctx.decodeAudioData) {
          // decodeAudioData expects an ArrayBuffer
          ctx.decodeAudioData(data.slice(0), (decoded) => {
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.connect(ctx.destination);
            try { src.start(); } catch (e) { console.warn('Failed to start decoded audio source', e); }
          }, (err) => {
            console.warn('Widget: failed to decode audio payload', err);
          });
        }
      } catch (e) {
        console.warn('Widget: error playing encoded audio payload', e);
      }
    };

    // Bind event listeners (guarded because proxy and SDK clients differ)
    if (hasOnOff(client)) {
      const evtClient = client as any;
      evtClient.on('open', onOpen);
      evtClient.on('close', onClose);
      evtClient.on('error', onError);
      evtClient.on('interrupted', stopAudioStreamer);
      evtClient.on('audio', onAudio);

      return () => {
        // Clean up event listeners
        try { evtClient.off('open', onOpen); } catch (e) {}
        try { evtClient.off('close', onClose); } catch (e) {}
        try { evtClient.off('error', onError); } catch (e) {}
        try { evtClient.off('interrupted', stopAudioStreamer); } catch (e) {}
        try { evtClient.off('audio', onAudio); } catch (e) {}
      };
    }

    // If client has no on/off methods, log and no-op cleanup
    console.warn('Widget: client does not implement .on/.off event methods');
    return () => {};
  }, [client]);

  const connect = useCallback(async () => {
    console.log('🎤 Widget: Connecting to voice...');
    
    if (!config) {
      console.error('❌ Widget: No config provided');
      throw new Error('config has not been set');
    }
    
    // Prevent multiple concurrent connections
    if (connected) {
      console.log('🎤 Widget: Already connected, skipping');
      return;
    }
    
    // Clear any previous errors
    setLastError(null);
    
    try {
      // First ensure we're fully disconnected
      if (client) {
        client.disconnect();
        // Wait for disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('🎤 Widget: Starting connection...');
      const success = await client.connect(config);
      
      if (success) {
        console.log('✅ Widget: Connection completed successfully');
        // Wait for the 'open' event with a timeout to avoid false-positive warnings
        try {
          const opened = await new Promise<boolean>((resolve) => {
            let settled = false;
            const onOpen = () => {
              if (settled) return;
              settled = true;
              try { (client as any).off('open', onOpen); } catch (e) {}
              resolve(true);
            };

            // If already connected state is true, resolve immediately
            if ((connected)) {
              try { if (hasOnOff(client)) (client as any).off('open', onOpen); } catch (e) {}
              return resolve(true);
            }

            if (hasOnOff(client)) {
              const evtClient = client as any;
              evtClient.on('open', onOpen);

              // Timeout after 3500ms
              setTimeout(() => {
                if (settled) return;
                settled = true;
                try { evtClient.off('open', onOpen); } catch (e) {}
                resolve(false);
              }, 3500);
            } else {
              // Client has no event emitter; we can't wait for 'open' event.
              // Resolve based on current connected state.
              return resolve(!!connected);
            }
          });

          if (!opened) {
            console.warn('⚠️ Widget: Connection completed but onOpen did not fire within timeout');
          }
        } catch (e) {
          console.warn('⚠️ Widget: Error waiting for open event', e);
        }
      } else {
        console.error('❌ Widget: client.connect() returned false');
        throw new Error('Connection failed');
      }
    } catch (error) {
      console.error('❌ Widget: Connection failed:', error);
      setConnected(false);
      throw error;
    }
  }, [client, config, connected]);

  const disconnect = useCallback(async () => {
    console.log('🔒 Widget: Disconnecting voice...');
    try {
      if (client) {
        client.disconnect();
      }
      setConnected(false);
      setVolume(0);
    } catch (error) {
      console.error('❌ Widget: Disconnect error:', error);
      setConnected(false);
    }
  }, [client]);

  const reset = useCallback(() => {
    console.log('🔄 Widget: Resetting voice connection...');
    try {
      // Force disconnect
      if (client) {
        client.disconnect();
      }
      
      setConnected(false);
      setVolume(0);
      setLastError(null);
      
      // Stop audio streamer
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
        audioStreamerRef.current = null;
      }
      
      // Reinitialize audio context after a delay
      setTimeout(() => {
        audioContext({ id: 'audio-out-widget' }).then((audioCtx: AudioContext) => {
          audioStreamerRef.current = new AudioStreamer(audioCtx);
          audioStreamerRef.current
            .addWorklet<any>('vumeter-out-widget', VolMeterWorket, (ev: any) => {
              setVolume(ev.data.volume);
            })
            .then(() => {
              console.log('🎤 Widget: Audio worklet reinitialized');
            })
            .catch(err => {
              console.error('❌ Widget: Error reinitializing worklet:', err);
            });
        });
      }, 1000);
      
      console.log('✅ Widget: Reset completed');
    } catch (error) {
      console.error('❌ Widget: Reset error:', error);
    }
  }, [client]);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    reset,
    lastError,
    volume,
  };
}
