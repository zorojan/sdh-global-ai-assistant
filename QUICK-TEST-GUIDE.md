# 🚀 Quick Test Guide - Gemini Live Audio with Armenian Support

## ⚡ 30-Second Setup

```bash
# Terminal 1: Backend
cd backend
npx ts-node src/server.ts

# Terminal 2: Frontend
cd test-frontend
npm run dev

# Open browser: http://localhost:5175
```

## 🎯 Test Steps

### 1. Verify Setup ✅
- [ ] Backend running on port 3001
- [ ] Frontend running on port 5175
- [ ] Browser console shows "🎙️ Gemini Live: Client initialized"

### 2. Select Gemini Live 🤖
- [ ] Click "🤖 Gemini Live" button
- [ ] Should be highlighted (green/active state)

### 3. Select Voice Mode 🎤
- [ ] Click "🎤 Voice Chat" button
- [ ] Should be highlighted

### 4. Select Agent 👤
- [ ] Click "Agent" dropdown
- [ ] Select any agent (e.g., "Armenian Support")

### 5. Start Recording 🎙️
- [ ] Click "🎤 Start Voice Session" button
- [ ] Browser will request microphone access
- [ ] Grant access when prompted
- [ ] Console shows "🎙️ Gemini Live: Recording started"

### 6. Speak Armenian/Russian/English 🗣️
- [ ] Speak clearly into microphone
- [ ] After ~1 second, audio chunk sent to backend
- [ ] Console shows "🎙️ Gemini Live: Sending audio chunk"

### 7. Receive Response 📨
- [ ] Console shows "🎙️ Gemini Live: Text response:"
- [ ] Text appears in chat
- [ ] AI voice response plays automatically
- [ ] Console shows "🎙️ Gemini Live: Playing audio response"

### 8. Stop Recording 🛑
- [ ] Click "🛑 Stop Voice Session" button
- [ ] Microphone access released
- [ ] Console shows "🎙️ Gemini Live: Recording stopped"

## 📊 What You Should See

### Console Output Example
```
🎙️ Gemini Live: Client initialized
🎙️ Gemini Live: Connecting...
   Supports: Armenian (Հայերեն), Russian, English, and more
   Audio Model: gemini-2.5-flash-native-audio-preview-09-2025
   TTS Model: gemini-2.5-flash
🎙️ Gemini Live: Session created: session_1730872845123_a1b2c3d
🎙️ Gemini Live: Recording started
🎙️ Gemini Live: Sending audio chunk {size: 12 KB, time: 12:34:56 PM}
🎙️ Gemini Live: Text response: Բարեւ, ինչ եմ կարող կատարել Ձեզ համար?
🎙️ Gemini Live: Playing audio response
```

### Chat Display
```
User: [audio of you speaking in Armenian]
AI:   Բարեւ, ինչ եմ կարող կատարել Ձեզ համար?
      (Hello, how can I help you?)
```

## 🔧 Troubleshooting

### No Audio Chunk Sent
**Symptom**: Console shows nothing after speaking
**Solution**:
1. Check browser console (F12)
2. Look for microphone permission errors
3. Verify network tab shows `/api/gemini/live/send` requests
4. Check backend logs for errors

### No AI Response Text
**Symptom**: Audio chunks sent but no response
**Solution**:
1. Check backend console for API errors
2. Verify Gemini API key in admin panel
3. Check network response in browser DevTools
4. Backend should show "🎙️ Gemini Live Proxy: Response received"

### Microphone Not Working
**Symptom**: Browser doesn't request microphone access
**Solution**:
1. Refresh page
2. Check browser privacy settings
3. Try another browser
4. Check console for getUserMedia errors

### Port Already in Use
**Symptom**: "EADDRINUSE: address already in use :::3001"
**Solution**:
```bash
# Find process on port 3001
netstat -ano | findstr :3001

# Kill process
taskkill /PID <PID> /F
```

### Model Not Recognized
**Symptom**: Backend returns model error
**Solution**:
1. Verify model name: `gemini-2.5-flash-native-audio-preview-09-2025`
2. Check Gemini API documentation for latest models
3. Ensure API key has access to this model

## 📈 Performance Metrics

| Metric | Expected |
|--------|----------|
| Audio chunk size | 10-15 KB |
| Network latency | 100-200 ms |
| API response time | 500-2000 ms |
| Total roundtrip | 1-3 seconds |
| Microphone lag | <100 ms |

## 🎤 Test Prompts in Armenian

Try these phrases to test:
- "Բարեւ" (Hello)
- "Ինչ է ժամանակը?" (What time is it?)
- "Ինչ եղանակ կա?" (How is the weather?)
- "Ինչ կա նոր?" (What's new?)

## ✅ Verification Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads on port 5175
- [ ] Diagnostics panel shows all variables
- [ ] Provider selection works
- [ ] Mode selection works
- [ ] Agent selection works
- [ ] Microphone access granted
- [ ] Audio chunks sent to backend
- [ ] AI response text appears
- [ ] AI response audio plays

## 🎉 Success Criteria

✅ **All working if**:
1. You can start voice session
2. You speak and audio is sent
3. You receive text response from AI
4. You hear AI voice response
5. No errors in browser console
6. Backend shows successful proxy calls

## 📞 Support

If something doesn't work:
1. Check `GEMINI-LIVE-IMPLEMENTATION.md`
2. Review console logs with `🎙️` prefix
3. Check backend logs
4. Verify all services running
5. Restart backend/frontend

## 🚀 Next Steps

Once verified working:
1. Test multiple languages (Armenian, Russian, English)
2. Try different agents
3. Test session management
4. Check error handling
5. Performance testing with longer conversations

**Happy testing! 🎉**
