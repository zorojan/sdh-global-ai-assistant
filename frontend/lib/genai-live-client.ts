/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
} from '@google/genai';
import EventEmitter from 'eventemitter3';
import { DEFAULT_LIVE_API_MODEL } from './constants';
import { difference } from 'lodash';
import { base64ToArrayBuffer } from './utils';

/**
 * Represents a single log entry in the system.
 * Used for tracking and displaying system events, messages, and errors.
 */
export interface StreamingLog {
  // Optional count for repeated log entries
  count?: number;
  // Optional additional data associated with the log
  data?: unknown;
  // Timestamp of when the log was created
  date: Date;
  // The log message content
  message: string | object;
  // The type/category of the log entry
  type: string;
}

/**
 * Event types that can be emitted by the MultimodalLiveClient.
 * Each event corresponds to a specific message from GenAI or client state change.
 */
export interface LiveClientEventTypes {
  // Emitted when audio data is received
  audio: (data: ArrayBuffer) => void;
  // Emitted when the connection closes
  close: (event: CloseEvent) => void;
  // Emitted when content is received from the server
  content: (data: LiveServerContent) => void;
  // Emitted when an error occurs
  error: (e: ErrorEvent) => void;
  // Emitted when the server interrupts the current generation
  interrupted: () => void;
  // Emitted for logging events
  log: (log: StreamingLog) => void;
  // Emitted when the connection opens
  open: () => void;
  // Emitted when the initial setup is complete
  setupcomplete: () => void;
  // Emitted when a tool call is received
  toolcall: (toolCall: LiveServerToolCall) => void;
  // Emitted when a tool call is cancelled
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  // Emitted when the current turn is complete
  turncomplete: () => void;
  // Emitted when usage metadata is received (tokens, modality breakdown)
  usage: (usageMetadata: any) => void;
}

export class GenAILiveClient {
  public readonly model: string = DEFAULT_LIVE_API_MODEL;

  protected readonly client: GoogleGenAI;
  protected session?: Session;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private emitter = new EventEmitter<LiveClientEventTypes>();

  public get status() {
    return this._status;
  }

  /**
   * Creates a new GenAILiveClient instance.
   * @param apiKey - API key for authentication with Google GenAI
   * @param model - Optional model name to override the default model
   */
  constructor(apiKey: string, model?: string) {
    if (model) this.model = model;

    this.client = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  public on<E extends keyof LiveClientEventTypes>(
    event: E,
    listener: LiveClientEventTypes[E],
  ): this {
    this.emitter.on(event, listener as EventEmitter.ListenerFn);
    return this;
  }

  public off<E extends keyof LiveClientEventTypes>(
    event: E,
    listener: LiveClientEventTypes[E],
  ): this {
    this.emitter.off(event, listener as EventEmitter.ListenerFn);
    return this;
  }

  protected emit<E extends keyof LiveClientEventTypes>(
    event: E,
    ...args: Parameters<LiveClientEventTypes[E]>
  ): boolean {
    return this.emitter.emit.apply(this.emitter, [event, ...args]);
  }

  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this._status = 'connecting';
    const callbacks: LiveCallbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    };

    try {
      this.session = await this.client.live.connect({
        model: this.model,
        config: {
          ...config,
        },
        callbacks,
      });
    } catch (e) {
      console.error('Error connecting to GenAI Live:', e);
      this._status = 'disconnected';
      this.session = undefined;
      return false;
    }

    this._status = 'connected';
    return true;
  }

  public disconnect() {
    this.session?.close();
    this.session = undefined;
    this._status = 'disconnected';

    this.log('client.close', `Disconnected`);
    return true;
  }

  public send(parts: Part | Part[], turnComplete: boolean = true) {
    if (this._status !== 'connected' || !this.session) {
      this.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    this.session.sendClientContent({ turns: parts, turnComplete });
    this.log(`client.send`, parts);
  }

  public sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    if (this._status !== 'connected' || !this.session) {
      this.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    chunks.forEach(chunk => {
      this.session!.sendRealtimeInput({ media: chunk });
    });

    // Убрали избыточные логи realtimeInput
  }

  public sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (this._status !== 'connected' || !this.session) {
      this.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session.sendToolResponse({
        functionResponses: toolResponse.functionResponses!,
      });
    }

    this.log(`client.toolResponse`, { toolResponse });
  }

  protected onMessage(message: LiveServerMessage) {
    // store raw incoming messages for debugging (window.__GENAI_RAW__)
    try {
      const gw = globalThis as any;
      gw.__GENAI_RAW__ = gw.__GENAI_RAW__ || [];
      gw.__GENAI_RAW__.push(message);
      if (gw.__GENAI_RAW__.length > 1000) gw.__GENAI_RAW__.splice(0, gw.__GENAI_RAW__.length - 1000);
    } catch (err) {
      // ignore
    }

    // If the server provided usage metadata at the message level, emit it for UI
    try {
      const anyMsg = message as any;
      const usage = anyMsg.usageMetadata || anyMsg.serverContent?.usageMetadata;
      if (usage) {
        // Убрали избыточный лог server.usage
        this.emit('usage', usage);
      }
    } catch (err) {
      // ignore
    }
    if (message.setupComplete) {
      this.emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      this.log('server.toolCall', message);
      this.emit('toolcall', message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log('receive.toolCallCancellation', message);
      this.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      if ('interrupted' in serverContent) {
        this.log('receive.serverContent', 'interrupted');
        this.emit('interrupted');
        return;
      }
      if ('turnComplete' in serverContent) {
        // Убрали избыточный лог turnComplete
        this.emit('turncomplete');
      }

      if (serverContent.modelTurn) {
        let parts: Part[] = serverContent.modelTurn.parts || [];

        const audioParts = parts.filter(p =>
          p.inlineData?.mimeType?.startsWith('audio/pcm')
        );
        const base64s = audioParts.map(p => p.inlineData?.data);
        const otherParts = difference(parts, audioParts);

        base64s.forEach(b64 => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emit('audio', data);
            // Удалили избыточный лог audio buffer
          }
        });
        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        const content: LiveServerContent = { modelTurn: { parts } };
        this.emit('content', content);
        // Убрали избыточный лог server.content
      } else {
        // Message contains serverContent but no modelTurn (e.g. only turnComplete or usageMetadata).
        // These are valid lifecycle messages (usage, end-of-turn) and should not be treated as errors.
        // Убрали избыточный лог server.nocontent
        // emit a lightweight content event so UI can react if needed (no parts)
        this.emit('content', { serverContent: { parts: [] } } as any);
        return;
      }
    }
  }

  protected onError(e: ErrorEvent) {
    this._status = 'disconnected';
    console.error('error:', e);

    const message = `Could not connect to GenAI Live: ${e.message}`;
    this.log(`server.${e.type}`, message);
    this.emit('error', e);
  }

  protected onOpen() {
    this._status = 'connected';
    this.emit('open');
  }

  protected onClose(e: CloseEvent) {
    this._status = 'disconnected';
    let reason = e.reason || '';
    if (reason.toLowerCase().includes('error')) {
      const prelude = 'ERROR]';
      const preludeIndex = reason.indexOf(prelude);
      if (preludeIndex > 0) {
        reason = reason.slice(preludeIndex + prelude.length + 1, Infinity);
      }
    }

    this.log(
      `server.${e.type}`,
      `disconnected ${reason ? `with reason: ${reason}` : ``}`
    );
    this.emit('close', e);
  }

  /**
   * Internal method to emit a log event.
   * @param type - Log type
   * @param message - Log message
   */
  protected log(type: string, message: string | object) {
    const entry = {
      type,
      message,
      date: new Date(),
    };

    // Emit to any listeners
    this.emit('log', entry as any);

    // Also write to a global in-browser log for easier debugging in the frontend
    try {
  // @ts-ignore - attach to window for debugging
  const gw = (globalThis as any);
  gw.__GENAI_LOGS__ = gw.__GENAI_LOGS__ || [];
  const g = gw.__GENAI_LOGS__;
      g.push(entry);
      // keep logs bounded
      if (g.length > 1000) g.splice(0, g.length - 1000);

      // persist a lightweight copy to localStorage so logs survive page reloads
      try {
        const light = g.slice(-500).map((e: any) => ({ t: e.type, d: e.date, m: typeof e.message === 'string' ? e.message : JSON.stringify(e.message) }));
        localStorage.setItem('genai_logs', JSON.stringify(light));
      } catch (err) {
        // ignore localStorage errors (e.g., in private mode)
      }
    } catch (err) {
      // ignore any errors while writing logs
    }

    // Отключили console.debug логи для чистоты консоли
    // try {
    //   // eslint-disable-next-line no-console
    //   console.debug('[GenAI Log]', entry.type, entry.message);
    // } catch (err) {
    //   // noop
    // }
  }
}