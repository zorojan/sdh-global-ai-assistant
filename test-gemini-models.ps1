#!/usr/bin/env pwsh
# Быстрый тест Gemini Live API моделей для PowerShell

Write-Host "🔍 Тестирование доступных Gemini Live моделей..." -ForegroundColor Cyan

$API_KEY = "AIzaSyAscnWh6-p0v-v2Uoktbd2cjFhaAE_hQmQ"

# Тест 1: Список доступных моделей
Write-Host ""
Write-Host "📋 Получение списка моделей..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models?key=$API_KEY" -Method Get
    $models = $response.models | Select-Object -First 20 | ForEach-Object { $_.name }
    Write-Host "Найдено моделей: $($models.Count)"
    $models | ForEach-Object { Write-Host "  - $_" }
} catch {
    Write-Host "❌ Ошибка получения списка моделей: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 Тестирование конкретных моделей для Gemini Live:" -ForegroundColor Cyan

# Модели для тестирования
$testModels = @(
    "gemini-2.5-flash-native-audio-preview-09-2025",
    "gemini-2.5-flash-preview-native-audio-dialog", 
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp"
)

foreach ($model in $testModels) {
    Write-Host ""
    Write-Host "🧪 Тестирование модели: $model" -ForegroundColor White
    
    $body = @{
        contents = @(
            @{
                parts = @(
                    @{ text = "Hello, can you hear me?" }
                )
            }
        )
    } | ConvertTo-Json -Depth 10
    
    try {
        $testResponse = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/$model`:generateContent?key=$API_KEY" -Method Post -Body $body -ContentType "application/json"
        Write-Host "✅ $model - РАБОТАЕТ" -ForegroundColor Green
        
        # Попробуем проверить поддержку аудио
        $audioBody = @{
            contents = @(
                @{
                    parts = @(
                        @{ text = "Test audio support" }
                    )
                }
            )
            generationConfig = @{
                responseModalities = @("AUDIO")
            }
        } | ConvertTo-Json -Depth 10
        
        try {
            $audioResponse = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/$model`:generateContent?key=$API_KEY" -Method Post -Body $audioBody -ContentType "application/json"
            Write-Host "  🎵 Поддерживает AUDIO модальность" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️ Не поддерживает AUDIO модальность" -ForegroundColor Yellow
        }
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        
        Write-Host "❌ $model - НЕ РАБОТАЕТ (код: $statusCode)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            try {
                $errorStream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorStream)
                $errorBody = $reader.ReadToEnd()
                $errorJson = $errorBody | ConvertFrom-Json
                Write-Host "   Ошибка: $($errorJson.error.message)" -ForegroundColor Red
            } catch {
                Write-Host "   Ошибка: $errorMessage" -ForegroundColor Red
            }
        }
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "🎙️ Проверка конфигурации для Gemini Live..." -ForegroundColor Cyan

# Проверим какую модель использует рабочий фронтенд
$frontendConstants = Get-Content "frontend\lib\constants.ts" -ErrorAction SilentlyContinue
if ($frontendConstants) {
    $workingModel = $frontendConstants | Select-String "DEFAULT_LIVE_API_MODEL.*=.*'(.*)'" | ForEach-Object { $_.Matches[0].Groups[1].Value }
    if ($workingModel) {
        Write-Host "✅ Рабочая модель из frontend: $workingModel" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "📊 Результаты анализа логов:" -ForegroundColor Cyan
Write-Host "❌ Проблема: WebSocket закрывается с кодом 1008" -ForegroundColor Red
Write-Host "❌ Причина: 'models/gemini-2.5-flash-preview-native-audio-dialog is not supported for bidiGenera'" -ForegroundColor Red
Write-Host ""
Write-Host "💡 Рекомендации:" -ForegroundColor Yellow
Write-Host "1. Замените модель на: gemini-2.5-flash-native-audio-preview-09-2025"
Write-Host "2. Эта модель работает в основном фронтенде"  
Write-Host "3. Проблема в неправильном имени модели во всех клиентах"

Write-Host ""
Write-Host "🔧 Быстрое исправление:" -ForegroundColor Green
Write-Host "Замените во всех клиентах:"
Write-Host "  ❌ gemini-2.5-flash-preview-native-audio-dialog"
Write-Host "  ✅ gemini-2.5-flash-native-audio-preview-09-2025"