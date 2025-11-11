
# Technical Specification (TЗ) v1.0
# Project: FSM (Financial System Mediator of Armenia) Voice Assistant

## 1. Executive Summary & Architectural Justification

### 1.1. Project Goal
The primary objective, as defined in `FSM_Voice_Assistant_Project.docx`, is to create an intelligent assistant that provides real-time, "Full-Duplex" (live) voice interaction for Armenian citizens. This assistant must provide factually accurate answers based on FSM's private knowledge base (RAG).

### 1.2. The Core Technical Challenge: RAG vs. "Full-Duplex"
A "Full-Duplex" or "live" voice stream (where a user can speak and be heard at any time, even interrupting the AI) is a monolithic audio-in/audio-out process. A "RAG" query (searching a vector database like ChromaDB) is an external, blocking, data-in/data-out process.

These two requirements are in direct conflict. We analyzed two potential architectures:

#### 1.2.1. Rejected Architecture: "RAG-before-Voice" (Sequential)
* **Flow:** STT $\rightarrow$ RAG (LangChain) $\rightarrow$ LLM (Text) $\rightarrow$ TTS (Audio).
* **Justification:** This pattern gives the backend full control over RAG. It is simple to implement.
* **Reason for Rejection:** This architecture **fails the core "Full-Duplex" requirement**. It is a slow, sequential chain. The user experiences a 2-4 second lag for every turn (STT + RAG/LLM + TTS). This is a classic "walkie-talkie" (half-duplex) mode, not a "live" conversation.

#### 1.2.2. Selected Architecture: "VoiceRAG (Agent + Tools)"
* **Flow:** A single, persistent "Live" API (like Gemini Live or GPT-4o Realtime) manages the STT/TTS stream. This API is configured as an **Agent** that has access to **Tools**.
* **Justification:** When the Agent hears a query it cannot answer, it *pauses the audio stream* and makes a **Function Call** to a "Tool." We define our **LangChain RAG pipeline as this Tool**.
* **Conclusion:** This is the only architecture that meets all project requirements. It preserves the "live" Full-Duplex stream while allowing the backend (via a Tool call) to inject the necessary RAG context.

### 1.3. Precedent & Inspiration
This "VoiceRAG (Agent + Tools)" pattern is the emerging industry standard for solving this exact problem. Our architecture is based on successful proof-of-concepts demonstrated by:
* **LangChain (YouTube):** "Talking to a LangChain ReAct Voice Agent"
    * `https://www.youtube.com/watch?v=TdZtr1nrhJg`
* **Azure (GitHub):** "aisearch-openai-rag-audio"
    * `https://github.com/Azure-Samples/aisearch-openai-rag-audio`

Both examples show a real-time voice API being "paused" to call an external data retrieval tool (search/RAG).

---

## 2. System Architecture Diagram (Flow)

```

(User: React/Flutter)           (Backend: FastAPI/Node.js)          (Vector DB: ChromaDB)       (Live API: Gemini/OpenAI)
|                                |                                   |                               |
|--- 1. Audio Stream (WebRTC) ---\>|--- 2. Proxy Audio Stream --------\>|                               |--- 3. STT (Internal)
|                                |                                   |                               |
|                                |                                   |                               |--- 4. LLM Agent Decides
|                                |                                   |                               |    (Needs FSM data)
|                                |                                   |                               |
|                                |\<--- 5. Function Call:             |                               |
|                                |     "search\_fsm\_rag(query)"       |                               |
|                                |                                   |                               |
|--- 6. Call LangChain RAG -----\>|--- 7. Similarity Search ---------\>|
|                                |                                   |                               |
|                                |\<--- 8. Return FSM Context --------|
|                                |                                   |                               |
|--- 9. Return RAG Context ----\> |                                   |--- 10. Inject Context
|                                |                                   |                               |
|                                |                                   |                               |--- 11. LLM Generates
|                                |                                   |                               |     + TTS (Armenian)
|                                |                                   |                               |
|\<--- 12. Audio Stream (Response) |\<--- 13. Proxy Audio Stream ------|                               |
|                                |                                   |                               |

```

---

## 3. Component Specification

### 3.1. Component 0: Knowledge Base Ingestion (Offline Process)
This is a preparatory process executed *before* the application is live.
* **Objective:** To populate the Vector Database (ChromaDB) with FSM knowledge.
* **Sources:**
    * All relevant FSM normative acts, regulations, and resolutions.
    * MVP Scope: 5-10 key documents.
* **Process (LangChain):**
    1.  **Load:** Use `PyPDFLoader`, `Docx2txtLoader`, etc., to read the source files.
    2.  **Split:** Use `RecursiveCharacterTextSplitter` to break documents into semantic chunks (e.g., 1000-char paragraphs).
    3.  **Embed:** Use an embedding model (e.g., Gemini) to convert each chunk into a vector.
    4.  **Store:** Save these vectors in the persistent **ChromaDB** database.

### 3.2. Component 1: Frontend (Client)
* **Objective:** Provide the user interface for both voice (Full-Duplex) and text interaction.
* **Stack:** React (for Web) and Flutter (for Mobile).
* **Key Features:**
    1.  **Audio Interface:**
        * Uses **WebRTC** to capture and stream microphone audio with low latency.
        * Connects to the Backend Proxy via a persistent **WebSocket**.
        * Receives the response audio stream and plays it immediately (e.g., via `AudioContext`).
    2.  **Text Interface (Hybrid Chat):**
        * Provides a **text input box** and "Send" button. This is critical for sending codes, numbers, or specific terms.
        * When text is sent, the Frontend sends a JSON message over the *same* WebSocket (e.g., `{"type": "text_message", "content": "..."}`).
    3.  **Dialogue Display:** Renders a live transcript of the conversation (both user speech and AI responses) for clarity and accessibility.

### 3.3. Component 2: Backend (Proxy Server)
* **Objective:** Act as the central orchestrator, managing the "live" session and executing RAG tool calls.
* **Stack:** FastAPI (Python) or Node.js (for high-performance async I/O).
* **Core Logic:**
    1.  **WebSocket Gateway:** Manages WebSocket connections from the Frontend.
    2.  **Session Proxy:**
        * On connection, it establishes a persistent session with the "Live" API (e.g., Gemini Live).
        * It relays audio bytes from the Frontend to the Live API.
        * It relays audio responses from the Live API back to the Frontend.
    3.  **Tool/Agent Orchestrator (LangChain):**
        * This is the "brain" of the backend.
        * It listens for **Function Call** requests from the Live API.
        * When it receives a `search_fsm_rag` call, it triggers the **LangChain RAG Tool (Component 3.4)**.
        * It takes the RAG context and sends it back to the Live API to complete the function call.
    4.  **Hybrid Input Router:**
        * Monitors incoming WebSocket messages.
        * If `type == "audio_stream"`, it relays to the Live API.
        * If `type == "text_message"`, it injects this text *directly* into the Live API session, which then triggers the same RAG/Agent logic.
    5.  **Security Layer:** Implements OAuth2 and data encryption to protect all Personal Identifiable Information (PII) and ensure data confidentiality.

### 3.4. Component 3: RAG Tool (LangChain)
* **Objective:** To be the "Tool" that the Live API Agent calls.
* **Stack:** LangChain (Python).
* **Definition:** This is a Python function (e.g., `def search_fsm_rag(query: str) -> str:`) registered with the Backend Orchestrator.
* **Process:**
    1.  Receives the `query` (text) from the Agent.
    2.  Initializes the `ChromaDB` retriever.
    3.  Performs a similarity search in ChromaDB (e.g., `db.similarity_search(query, k=3)`).
    4.  Formats the 3 retrieved document chunks into a single string.
    5.  **Returns** this context string to the Backend Orchestrator.

### 3.5. Component 4: Core Models (LLM / STT / TTS)
* **Objective:** Provide the core AI, language understanding, and voice generation.
* **Stack:** Gemini Live API (preferred) or OpenAI GPT-4o.
* **Key Requirements:**
    1.  **LLM (Gemini / GPT-4o):** Must support Agentic behavior and Tool/Function calling.
    2.  **STT (Speech-to-Text):** Must have high-accuracy, real-time support for the **Armenian language**.
    3.  **TTS (Text-to-Speech):** Must generate natural, human-like, real-time audio in the **Armenian language**, complete with appropriate pauses and intonation.
```