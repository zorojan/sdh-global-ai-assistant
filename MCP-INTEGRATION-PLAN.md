# MCP Server Integration with Google GenAI SDK

## Overview

Официальная библиотека `@google/genai` имеет **встроенную поддержку MCP (Model Context Protocol)** server. Это открывает новые возможности для интеграции нашего AI-assistant с MCP экосистемой.

## Ключевые Возможности

### 1. MCP Server Support (Experimental)

```typescript
import { GoogleGenAI, mcpToTool } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
```

### 2. Встроенный MCP-to-Tool Converter

```typescript
// Автоматическое преобразование MCP server в tool для Gemini
const tool = mcpToTool(mcpClient1, mcpClient2, config);

// Использование в Live API
const session = await ai.live.connect({
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  config: {
    tools: [tool], // MCP tools автоматически интегрируются
    responseModalities: [Modality.AUDIO, Modality.TEXT],
  },
  callbacks: { ... }
});
```

## Примеры из Официальной Библиотеки

### 1. Простой MCP Server

```typescript
// Создание MCP server с инструментами
const server = new McpServer({
  name: 'printer',
  version: '1.0.0',
});

server.tool(
  'print_message',
  {
    text: z.string(),
    color: z.string().regex(/red|blue|green|white/),
  },
  async ({text, color}) => {
    // Логика выполнения инструмента
    console.log(colorMap[color] + text);
    return {
      content: [{ type: 'text', text: `Printed: ${text}` }],
    };
  },
);

// Подключение транспорта
const transports = InMemoryTransport.createLinkedPair();
await server.connect(transports[0]);

// Создание клиента
const client = new Client({
  name: 'printer',
  version: '1.0.0',
});
client.connect(transports[1]);
```

### 2. MCP с Structured Output

```typescript
async function greetServerStructuredOutput(): Promise<McpClient> {
  const server = new McpServer({
    name: 'greeter',
    version: '1.0.0',
  });

  server.registerTool(
    'greet',
    {
      description: 'Greet the user',
      inputSchema: {
        name: z.string(),
        greeting: z.string(),
      },
      outputSchema: {
        name: z.string(),
        greeting: z.string(),
        completeMessage: z.string(),
      },
    },
    async ({name, greeting}) => {
      const structuredOutput = {
        name,
        greeting,
        completeMessage: `Hello ${name}, ${greeting}`
      };
      
      return {
        content: [{
          type: 'text',
          text: `Greeted: ${structuredOutput.completeMessage}`,
        }],
        structuredContent: structuredOutput,
      };
    },
  );
}
```

### 3. Live API Server Integration

```typescript
// Из sdk-samples/live_server.ts - WebSocket server для Live API
async function main() {
  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onmessage: (message: LiveServerMessage) => {
        // Handle audio/text responses
        if (message.serverContent.modelTurn.parts[0].inlineData) {
          io.emit('audioStream', 
            message.serverContent.modelTurn.parts[0].inlineData.data
          );
        }
      },
      // ... other callbacks
    },
  });

  // Express server with Socket.IO
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  // Handle client connections
  io.on('connection', async function (socket: Socket) {
    // Handle realtime audio input
    socket.on('realtimeInput', function (audioData: string) {
      session.sendRealtimeInput({media: createBlob(audioData)});
    });

    // Handle text content
    socket.on('contentUpdateText', function (text: string) {
      session.sendClientContent({turns: text, turnComplete: true});
    });
  });

  await server.listen(8000);
}
```

## Применение в Нашем Проекте

### 1. Backend MCP Server

```typescript
// backend/src/mcp-server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class SDHAIAssistantMcpServer {
  private server: McpServer;

  constructor() {
    this.server = new McpServer({
      name: 'sdh-ai-assistant',
      version: '4.1.0',
    });

    this.setupTools();
  }

  private setupTools() {
    // Agent management tools
    this.server.tool(
      'list_agents',
      {
        search: z.string().optional(),
        language: z.string().optional(),
      },
      async (params) => {
        // Получение списка агентов из базы данных
        const agents = await this.getAgents(params);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(agents, null, 2)
          }]
        };
      }
    );

    this.server.tool(
      'create_voice_session',
      {
        agent_id: z.string(),
        voice_config: z.object({
          voice_name: z.string(),
          language: z.string(),
        }).optional(),
      },
      async ({agent_id, voice_config}) => {
        // Создание голосовой сессии с агентом
        const session = await this.createVoiceSession(agent_id, voice_config);
        return {
          content: [{
            type: 'text',
            text: `Voice session created: ${session.id}`
          }],
          structuredContent: { session_id: session.id, agent_id }
        };
      }
    );

    this.server.tool(
      'get_conversation_history',
      {
        session_id: z.string(),
        limit: z.number().optional(),
      },
      async (params) => {
        const history = await this.getConversationHistory(params);
        return {
          content: [{
            type: 'text', 
            text: JSON.stringify(history, null, 2)
          }]
        };
      }
    );
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### 2. Integration в Live API

```typescript
// backend/src/live-api-with-mcp.ts
import { GoogleGenAI, mcpToTool } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class LiveAPIWithMCP {
  private client: GoogleGenAI;
  
  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async connectWithMCP() {
    // Подключение к нашему MCP server
    const mcpClient = new Client({
      name: 'sdh-ai-assistant-client',
      version: '1.0.0'
    });

    const transport = new StdioClientTransport({
      command: 'node',
      args: ['./dist/mcp-server.js']
    });

    await mcpClient.connect(transport);

    // Преобразование MCP tools для Gemini
    const mcpTool = mcpToTool(mcpClient);

    // Создание Live API session с MCP tools
    const session = await this.client.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: ['AUDIO', 'TEXT'],
        tools: [mcpTool], // Наши MCP инструменты
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Orus' }
          }
        },
        systemInstruction: `You are an AI assistant with access to agent management tools.
        You can list agents, create voice sessions, and get conversation history.
        CRITICAL: Respond in Armenian (Հայերեն) when interacting with Armenian agents.`,
      },
      callbacks: {
        onmessage: this.handleMessage.bind(this),
        onerror: this.handleError.bind(this),
        onopen: () => console.log('MCP-Enhanced Live API connected'),
        onclose: () => console.log('MCP-Enhanced Live API disconnected'),
      }
    });

    return session;
  }

  private handleMessage(message: any) {
    // Handle both audio responses and tool calls
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData) {
          // Audio response
          this.handleAudioResponse(part.inlineData.data);
        }
        if (part.functionCall) {
          // MCP tool was called
          console.log('MCP tool called:', part.functionCall);
        }
      }
    }
  }
}
```

### 3. WordPress Plugin Integration

```typescript
// wordpress-plugin/includes/mcp-integration.php
class SDH_AI_MCP_Integration {
  
  public function init() {
    // Создание WordPress MCP server
    add_action('wp_ajax_mcp_agent_list', [$this, 'handle_agent_list']);
    add_action('wp_ajax_mcp_voice_chat', [$this, 'handle_voice_chat']);
  }

  public function handle_agent_list() {
    // Получение агентов через MCP protocol
    $agents = $this->get_agents_via_mcp();
    wp_send_json_success($agents);
  }

  public function handle_voice_chat() {
    // Создание голосовой сессии через MCP
    $session = $this->create_voice_session_via_mcp($_POST);
    wp_send_json_success($session);
  }

  private function get_agents_via_mcp() {
    // Вызов MCP server для получения агентов
    $mcp_client = new MCPClient('http://localhost:3001/mcp');
    return $mcp_client->call_tool('list_agents', [
      'search' => $_GET['search'] ?? '',
      'language' => get_locale(),
    ]);
  }
}
```

## Архитектурные Преимущества

### 1. Унифицированный Protocol
- **Стандартизация**: MCP - это стандартный протокол для AI tools
- **Переносимость**: Инструменты работают с любыми MCP-совместимыми клиентами
- **Расширяемость**: Легко добавлять новые инструменты

### 2. Встроенная Интеграция с Live API
- **Автоматическое преобразование**: `mcpToTool()` конвертирует MCP server в Gemini tools
- **Реальное время**: MCP tools работают в Live API sessions
- **Structured Output**: Поддержка типизированных ответов

### 3. Масштабируемость
- **Microservices**: Каждый MCP server - отдельный сервис
- **Load Balancing**: Можно распределять MCP servers
- **Версионирование**: Независимые версии для разных tools

## Миграционный План

### Фаза 1: MCP Server Setup
- [ ] Создать базовый MCP server для agent management
- [ ] Интегрировать с существующей базой данных
- [ ] Добавить основные tools (list_agents, create_session, etc.)

### Фаза 2: Live API Integration  
- [ ] Интегрировать MCP server с Live API
- [ ] Обновить frontend для работы с MCP-enhanced Live API
- [ ] Тестировать voice + MCP tools комбинацию

### Фаза 3: Advanced Features
- [ ] Добавить conversation management tools
- [ ] Интегрировать с WordPress через MCP
- [ ] Создать MCP tools для voice synthesis control

### Фаза 4: Production Deployment
- [ ] Настроить MCP server в production
- [ ] Мониторинг и логирование MCP calls
- [ ] Документация для разработчиков

## Технические Требования

### Dependencies
```json
{
  "@google/genai": "^0.3.0",
  "@modelcontextprotocol/sdk": "^1.0.0",
  "zod": "^3.20.0"
}
```

### Environment Variables
```bash
GEMINI_API_KEY=your_api_key
MCP_SERVER_PORT=3001
MCP_SERVER_HOST=localhost
```

## Заключение

Использование официальной библиотеки Google GenAI SDK с встроенной MCP поддержкой даст нам:

1. **Стандартизированный подход** к созданию AI tools
2. **Простую интеграцию** с Live API
3. **Расширяемую архитектуру** для новых функций
4. **Совместимость** с другими MCP-системами
5. **Официальную поддержку** от Google

Это идеальное решение для эволюции нашего AI-assistant в полноценную MCP-совместимую платформу!

---

*Основано на анализе:* https://github.com/googleapis/js-genai  
*Статус:* Готов к реализации  
*Приоритет:* Высокий