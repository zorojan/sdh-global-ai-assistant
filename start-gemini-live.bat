@echo off
REM Gemini Live Audio - Complete Test Script
REM Starts backend and frontend automatically

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  🎙️  Gemini Live Audio - Armenian Language Support        ║
echo ║  Starting Backend and Frontend...                          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Kill any existing processes on ports 3001 and 5175
echo 🛑 Cleaning up existing processes...
netstat -ano | findstr :3001 > nul && taskkill /F /PID 15956 /T 2>nul || echo Port 3001 is free
netstat -ano | findstr :5175 > nul && taskkill /F /PID 30796 /T 2>nul || echo Port 5175 is free

REM Small delay
timeout /t 2 /nobreak

REM Start Backend
echo.
echo 📦 Starting Backend on port 3001...
cd backend
start "Backend - Gemini Live Proxy" cmd /k "echo Backend starting... && npx ts-node src/server.ts"

REM Wait for backend to start
timeout /t 5 /nobreak

REM Start Frontend
echo.
echo 🎨 Starting Frontend on port 5175...
cd ..\test-frontend
start "Frontend - Test App" cmd /k "echo Frontend starting... && npm run dev"

REM Wait for frontend to start
timeout /t 5 /nobreak

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  ✅ Services Started!                                       ║
echo ║                                                             ║
echo ║  🌐 Backend:  http://localhost:3001                        ║
echo ║  🌐 Frontend: http://localhost:5175                        ║
echo ║  🌐 Health:   http://localhost:3001/api/health             ║
echo ║                                                             ║
echo ║  📱 Open browser to: http://localhost:5175                 ║
echo ║                                                             ║
echo ║  🎯 Test Steps:                                             ║
echo ║  1. Select "🤖 Gemini Live" provider                       ║
echo ║  2. Select "🎤 Voice Chat" mode                            ║
echo ║  3. Select an agent                                        ║
echo ║  4. Click "Start Voice Session"                            ║
echo ║  5. Speak in Armenian/Russian/English                      ║
echo ║  6. Listen to AI response                                  ║
echo ║                                                             ║
echo ║  📊 Model: gemini-2.5-flash-native-audio-preview-09-2025   ║
echo ║  🗣️  Languages: Armenian, Russian, English                 ║
echo ║                                                             ║
echo ║  ℹ️  Console logs show: 🎙️ Gemini Live: ...                │
echo ║  ℹ️  Check DevTools (F12) for detailed logs                 ║
echo ║                                                             ║
echo ║  Press Ctrl+C in each window to stop                       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Open browser automatically
echo 🌐 Opening browser...
timeout /t 3 /nobreak
start http://localhost:5175

echo.
echo 💡 Tips:
echo   - Watch console.logs in browser DevTools (F12)
echo   - Check backend console for API calls
echo   - Test different agents
echo   - Try different languages (Armenian, Russian, English)
echo.
echo ⏳ Waiting for services to fully initialize...
timeout /t 10 /nobreak

echo.
echo ✅ Ready to test! Browser should open automatically.
echo 🎉 Enjoy testing Gemini Live Audio with Armenian support!
echo.
pause
