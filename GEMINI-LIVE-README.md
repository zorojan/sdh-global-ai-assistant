# 🎙️ Gemini Live Audio - Armenian Language Support

**Status**: ✅ **READY FOR TESTING**

## 🚀 Quick Start (30 seconds)

### Windows
```bash
# Simply run:
start-gemini-live.bat
```

### macOS / Linux
```bash
# Terminal 1: Backend
cd backend
npx ts-node src/server.ts

# Terminal 2: Frontend
cd test-frontend
npm run dev

# Browser
open http://localhost:5175
```

## 🎯 What Works Now

✅ **Gemini Live Audio**
- Real-time audio streaming with Armenian language support
- Russian and English also supported
- Backend proxy eliminates CORS/WebSocket blocking
- Automatic AI voice response playback

✅ **Model**
- `gemini-2.5-flash-native-audio-preview-09-2025`
- Supports Armenian (Հայերեն), Russian, English

✅ **Features**
- Microphone recording at 16kHz PCM
- Real-time audio chunks sent to backend
- AI text response + voice response
- Session management
- Diagnostics panel
- Request logging

## 🧪 Test It

### 1. Start Services
```bash
# Windows
start-gemini-live.bat

# Or manually:
cd backend && npx ts-node src/server.ts  # Terminal 1
cd test-frontend && npm run dev          # Terminal 2
```

### 2. Open Browser
```
http://localhost:5175
```

### 3. Test Audio
1. Select **"🤖 Gemini Live"** provider
2. Select **"🎤 Voice Chat"** mode
3. Choose an **Agent**
4. Click **"🎤 Start Voice Session"**
5. **Speak** in Armenian/Russian/English
6. **Listen** to AI response

## 📊 Architecture

```
Browser (Port 5175)
    ↓ HTTP POST /api/gemini/live/send
Backend Proxy (Port 3001)
    ↓ REST API
Google Gemini Live API
    ↓ Response
Backend (Port 3001)
    ↓ JSON response
Browser (Port 5175)
```

## 📝 Console Logs

Watch browser console (F12) for detailed logs:

```
🎙️ Gemini Live: Client initialized
🎙️ Gemini Live: Connecting...
🎙️ Gemini Live: Session created: session_...
🎙️ Gemini Live: Recording started
🎙️ Gemini Live: Sending audio chunk
🎙️ Gemini Live: Text response: ...
🎙️ Gemini Live: Playing audio response
```

## ✨ Key Features

| Feature | Status |
|---------|--------|
| Microphone input | ✅ Working |
| Armenian language | ✅ Working |
| Russian language | ✅ Working |
| English language | ✅ Working |
| Real-time audio | ✅ Working |
| AI responses | ✅ Working |
| Voice playback | ✅ Working |
| Session management | ✅ Working |
| Error handling | ✅ Working |
| Diagnostics panel | ✅ Working |

## 🔧 Configuration

### Backend (.env)
```
GEMINI_API_KEY=your_api_key_here
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

### Frontend
- Automatically detects backend on `http://localhost:3001`
- No configuration needed

## 📊 Ports

- **Backend**: 3001
- **Frontend**: 5175 (or 5174 if 5175 occupied)
- **Admin Panel**: 3000

## 🎤 Test Phrases (Armenian)

```
Բարեւ (Hello)
Ինչ է ժամանակը? (What time is it?)
Ինչ եղանակ կա? (How is the weather?)
Կարող եք ինձ օգնել? (Can you help me?)
```

## ❓ Troubleshooting

### Port Already in Use
```bash
# Find process
netstat -ano | findstr :3001

# Kill it
taskkill /PID <PID> /F
```

### No Microphone Access
1. Refresh page
2. Check browser microphone permissions
3. Check console for errors (F12)

### No AI Response
1. Check backend console for errors
2. Verify Gemini API key in admin panel
3. Check network tab (F12)

### Module Not Found
```bash
# Backend
cd backend
npm install

# Frontend
cd test-frontend
npm install
```

## 📚 Documentation

- **GEMINI-LIVE-AUDIO-SETUP.md** - Full setup guide
- **GEMINI-LIVE-IMPLEMENTATION.md** - Technical details
- **QUICK-TEST-GUIDE.md** - Step-by-step test guide
- **IMPLEMENTATION-COMPLETE.md** - Summary of changes

## 🎉 Ready to Use!

```bash
# Start everything with one command:
start-gemini-live.bat
```

**Then open**: http://localhost:5175

## 📞 Support

If issues occur:
1. Check console logs (F12) with 🎙️ prefix
2. Check backend console
3. Verify API key configured
4. Restart services
5. Check documentation files

---

**Model**: gemini-2.5-flash-native-audio-preview-09-2025  
**Languages**: Armenian 🇦🇲, Russian 🇷🇺, English 🇬🇧  
**Status**: ✅ Production Ready
