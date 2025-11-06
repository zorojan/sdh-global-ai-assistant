# 🎤 Voice Testing Checklist

## 📋 **Step-by-Step Voice Testing Guide**

### **🔄 1. Refresh & Start Fresh**
1. **Refresh** the test-frontend page (`http://localhost:5174/`)
2. **Select**: Gemini + Voice Mode
3. **Enable**: "Use New SDK Client" checkbox
4. **Open**: Browser Developer Console (F12)

### **🎙️ 2. Test Voice Input**

#### **Expected Console Output When Speaking:**
```
🎙️ Gemini Live SDK: Received audio data, size: [number]
🎙️ Gemini Live SDK: Converted to ArrayBuffer, size: [number]  
✅ Gemini Live SDK: Audio chunk sent successfully, size: [number]
```

#### **If You See Errors:**
- `⚠️ Received empty audio data` = Microphone not working
- `❌ Error sending audio` = Network/API issue
- `⚠️ Cannot send audio - session not ready` = Connection problem

### **🔊 3. Test Audio Output**

#### **Expected Console Output for Responses:**
```
📨 Gemini Live SDK: Raw message received: [object]
🔊 Gemini Live SDK: Audio response received, size: [number]
🎙️ Gemini Live SDK: Playing audio response
```

### **📝 4. Test Text Transcription**

#### **Expected Console Output:**
```
🎤➡️📝 Input transcription (what you said): [your words]
📝 Text response received: [AI response in Armenian]
🤖➡️📝 Output transcription (what AI said): [AI words]
```

### **🧪 5. Test Scenarios**

#### **Test 1: Simple Armenian Greeting**
1. **Say**: "Բարև ձեզ" (Hello)
2. **Expected**: Armenian audio response + transcription

#### **Test 2: English Input**
1. **Say**: "Hello, how are you?"
2. **Expected**: Response in Armenian (per system prompt)

#### **Test 3: Question About Company**
1. **Say**: "Ինչ է ֆինանսական համակարգի հաշտարարը?" (What is the financial system ombudsman?)
2. **Expected**: Detailed Armenian response about your company

### **🔍 6. Troubleshooting**

#### **No Audio Input Detected:**
- Check microphone permissions in browser
- Look for `🎙️ Received audio data` messages
- Try speaking louder/closer to mic

#### **No Audio Output:**
- Check browser audio settings
- Look for `🔊 Audio response received` messages
- Verify speakers/headphones work

#### **No Text Responses:**
- Look for `📝 Text response received` messages
- Check for error messages in console
- Verify API key is working

#### **Armenian Language Issues:**
- Check system prompt includes Armenian instruction
- Look for language detection messages
- Try speaking in Armenian vs English

### **📊 7. Success Indicators**

**✅ Full Success Looks Like:**
1. Audio chunks being sent every 250ms while speaking
2. Raw messages received from Gemini
3. Both audio and text responses in Armenian
4. Input/output transcriptions appearing
5. Actual audio playback in Armenian

**🎯 Test Each Component:**
- 🎤 **Input**: Audio chunks sent ✅/❌
- 🧠 **Processing**: Messages received ✅/❌  
- 🔊 **Audio Out**: Sound plays ✅/❌
- 📝 **Text Out**: Armenian text appears ✅/❌
- 📋 **Transcription**: Input/output transcribed ✅/❌

### **📋 Report Template**

When testing, note:
```
🎤 Voice Input: ✅/❌ - [details]
🔊 Audio Output: ✅/❌ - [details] 
📝 Text Display: ✅/❌ - [details]
🗣️ Armenian Responses: ✅/❌ - [details]
📋 Transcription: ✅/❌ - [details]
```

Copy any error messages or unusual console output for debugging!