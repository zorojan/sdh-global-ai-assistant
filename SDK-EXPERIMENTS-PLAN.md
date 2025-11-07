# 🧪 Эксперименты и улучшения для New SDK Client

## 📚 **Изученные лучшие практики из официальной библиотеки**

### 1. **AsyncQueue Pattern** (из live_client_content.ts)
```typescript
class AsyncQueue<T> {
  private items: T[] = [];
  private resolvers: ((value: T) => void)[] = [];

  put(item: T) {
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(item);
    } else {
      this.items.push(item);
    }
  }

  async get(): Promise<T> {
    if (this.items.length > 0) {
      return this.items.shift()!;
    }
    return new Promise<T>(resolve => {
      this.resolvers.push(resolve);
    });
  }

  clear() {
    this.items = [];
    this.resolvers.forEach(resolve => resolve(null as any));
    this.resolvers = [];
  }
}
```

### 2. **Proper Message Handling** (из live.ts)
```typescript
async function handleWebSocketMessage(
  apiClient: ApiClient,
  onmessage: (msg: types.LiveServerMessage) => void,
  event: MessageEvent,
): Promise<void> {
  const serverMessage: types.LiveServerMessage = new types.LiveServerMessage();
  let jsonData: string;
  
  if (event.data instanceof Blob) {
    jsonData = await event.data.text();
  } else if (event.data instanceof ArrayBuffer) {
    jsonData = new TextDecoder().decode(event.data);
  } else {
    jsonData = event.data;
  }

  const data = JSON.parse(jsonData) as types.LiveServerMessage;
  Object.assign(serverMessage, data);
  onmessage(serverMessage);
}
```

### 3. **Server-Side Real-time Architecture** (из live_server.ts)
```typescript
// Express + Socket.IO для WebSocket proxy
const session = await ai.live.connect({
  model: model,
  callbacks: {
    onmessage: (message: types.LiveServerMessage) => {
      if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
        io.emit('audioStream', message.serverContent.modelTurn.parts[0].inlineData.data);
      }
    }
  }
});

// Handle realtime audio input from clients
socket.on('realtimeInput', function (audioData: string) {
  session.sendRealtimeInput({media: createBlob(audioData)});
});
```

## 🚀 **Конкретные улучшения для нашего SDK Client**

### ✅ **Улучшение 1: AsyncQueue для сообщений**
```typescript
export class GeminiLiveClientSDK {
  private messageQueue = new AsyncQueue<types.LiveServerMessage>();
  private isProcessingMessages = false;

  private async processMessageQueue() {
    if (this.isProcessingMessages) return;
    this.isProcessingMessages = true;

    try {
      while (true) {
        const message = await this.messageQueue.get();
        if (!message) break;
        await this.processMessage(message);
      }
    } finally {
      this.isProcessingMessages = false;
    }
  }

  private handleMessage(message: any): void {
    this.messageQueue.put(message);
    if (!this.isProcessingMessages) {
      this.processMessageQueue();
    }
  }
}
```

### ✅ **Улучшение 2: Enhanced Audio Streaming**
```typescript
// Основано на createBlob из live_server.ts
private createOptimizedBlob(audioData: Float32Array): Blob {
  // Convert Float32Array to Int16Array for PCM
  const int16Array = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    int16Array[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7FFF;
  }

  return new Blob([int16Array.buffer], { 
    type: 'audio/pcm;rate=16000;channels=1' 
  });
}

// Optimized audio processing with VAD (Voice Activity Detection)
private processAudioWithVAD(inputData: Float32Array): boolean {
  // Simple VAD: calculate RMS energy
  const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
  const threshold = 0.01; // Adjust based on testing
  
  return rms > threshold; // Return true if voice detected
}
```

### ✅ **Улучшение 3: Connection Resilience**
```typescript
// Основано на официальных error handling patterns
private async connectWithRetry(maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.connect();
      return; // Success
    } catch (error) {
      console.warn(`Connection attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to connect after ${maxRetries} attempts`);
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### ✅ **Улучшение 4: Turn-based Conversation**
```typescript
// Основано на handleTurn() patterns из примеров
private async handleTurn(): Promise<types.LiveServerMessage[]> {
  const turn: types.LiveServerMessage[] = [];
  let turnComplete = false;

  while (!turnComplete) {
    const message = await this.messageQueue.get();
    turn.push(message);
    
    if (message.serverContent?.turnComplete) {
      turnComplete = true;
    }
  }

  return turn;
}

// Enhanced conversation management
private async startConversation(initialMessage?: string): Promise<void> {
  if (initialMessage) {
    this.session?.sendClientContent({
      turns: initialMessage,
      turnComplete: true
    });
  }

  // Process conversation turns
  while (this.isConnected) {
    const turn = await this.handleTurn();
    this.processTurn(turn);
  }
}
```

### ✅ **Улучшение 5: Advanced Configuration**
```typescript
// Основано на официальных LiveConnectConfig patterns
interface AdvancedSDKConfig {
  // Voice configuration
  voiceConfig?: {
    voiceName?: string;
    languageCode?: string;
    speakingRate?: number;
    pitch?: number;
  };
  
  // Audio configuration  
  audioConfig?: {
    sampleRateHertz?: number;
    bufferSize?: number;
    enableVAD?: boolean;
    vadSensitivity?: number;
  };
  
  // Context management
  contextConfig?: {
    maxContextLength?: number;
    enableCompression?: boolean;
    slidingWindow?: boolean;
  };
}

private buildAdvancedConfig(config: AdvancedSDKConfig): types.LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO, Modality.TEXT],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { 
          voiceName: config.voiceConfig?.voiceName || 'Orus' 
        }
      }
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    contextWindowCompression: config.contextConfig?.enableCompression ? {
      triggerTokens: config.contextConfig.maxContextLength?.toString() || '1000',
      slidingWindow: {
        targetTokens: '500'
      }
    } : undefined
  };
}
```

### ✅ **Улучшение 6: Performance Monitoring**
```typescript
// Основано на официальных diagnostic patterns
interface PerformanceMetrics {
  connectionLatency: number;
  audioLatency: number;
  messageRate: number;
  errorRate: number;
  totalMessages: number;
}

private metrics: PerformanceMetrics = {
  connectionLatency: 0,
  audioLatency: 0,
  messageRate: 0,
  errorRate: 0,
  totalMessages: 0
};

private startPerformanceMonitoring(): void {
  setInterval(() => {
    console.log('📊 Performance Metrics:', {
      ...this.metrics,
      averageLatency: (this.metrics.connectionLatency + this.metrics.audioLatency) / 2,
      successRate: ((this.metrics.totalMessages - this.metrics.errorRate) / this.metrics.totalMessages * 100).toFixed(2) + '%'
    });
  }, 10000); // Log every 10 seconds
}
```

## 🎯 **План экспериментов**

### **Эксперимент 1: AsyncQueue Implementation**
- Заменить простую обработку сообщений на AsyncQueue
- Тестировать с высокой частотой сообщений
- Измерить улучшение производительности

### **Эксперимент 2: Advanced VAD**
- Реализовать Voice Activity Detection
- Отправлять только аудио с голосом
- Сравнить качество и производительность

### **Эксперимент 3: Connection Resilience**
- Добавить автоматические переподключения
- Тестировать при нестабильном интернете
- Измерить надежность соединения

### **Эксперимент 4: Context Management**
- Реализовать sliding window для контекста
- Тестировать длинные разговоры
- Оптимизировать использование токенов

### **Эксперимент 5: Multi-modal Features**
- Добавить поддержку изображений
- Реализовать text + audio одновременно
- Тестировать rich interactions

## 🔧 **Инструменты для экспериментов**

### **Debug Panel Enhancement**
```typescript
interface DebugInfo {
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  messageStats: PerformanceMetrics;
  audioStats: {
    inputLevel: number;
    outputLevel: number;
    latency: number;
  };
  lastMessages: Array<{
    timestamp: number;
    type: string;
    content: string;
  }>;
}

private createDebugPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'sdk-debug-panel';
  panel.innerHTML = `
    <div class="debug-header">🔧 SDK Debug Panel</div>
    <div class="debug-metrics"></div>
    <div class="debug-messages"></div>
  `;
  
  // Update panel every second
  setInterval(() => this.updateDebugPanel(panel), 1000);
  
  return panel;
}
```

### **A/B Testing Framework**
```typescript
class ExperimentFramework {
  private experiments = new Map<string, any>();
  
  runExperiment<T>(name: string, controlFn: () => T, experimentFn: () => T): T {
    const useExperiment = Math.random() < 0.5; // 50/50 split
    
    const startTime = performance.now();
    const result = useExperiment ? experimentFn() : controlFn();
    const duration = performance.now() - startTime;
    
    this.logExperiment(name, useExperiment, duration, result);
    return result;
  }
  
  private logExperiment(name: string, wasExperiment: boolean, duration: number, result: any): void {
    console.log(`🧪 Experiment "${name}":`, {
      variant: wasExperiment ? 'experiment' : 'control',
      duration: `${duration.toFixed(2)}ms`,
      success: !!result
    });
  }
}
```

## 🎓 **Что изучить дальше**

1. **Ephemeral Tokens** - для production безопасности
2. **MCP Tools Integration** - для расширения функционала
3. **Live Music API** - для аудио генерации
4. **Context Caching** - для оптимизации
5. **Advanced Speech Config** - для лучшего качества голоса

Хотите начать с какого-то конкретного эксперимента? 🚀

---

*Источники изучения:*
- `sdk-samples/live_client_content.ts` - AsyncQueue patterns
- `sdk-samples/live_server.ts` - Server-side architecture  
- `src/live.ts` - Core Live API implementation
- `test/unit/live_test.ts` - Testing patterns
- `api-report/genai.api.md` - Complete API reference