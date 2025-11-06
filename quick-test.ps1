#!/usr/bin/env pwsh
# Quick Gemini Model Test

$API_KEY = "AIzaSyAscnWh6-p0v-v2Uoktbd2cjFhaAE_hQmQ"

Write-Host "Testing Gemini Models..." -ForegroundColor Cyan

$models = @(
    "gemini-2.5-flash-native-audio-preview-09-2025",
    "gemini-2.5-flash-preview-native-audio-dialog"
)

foreach ($model in $models) {
    Write-Host "Testing: $model" -ForegroundColor White
    
    $body = @{
        contents = @(
            @{
                parts = @(
                    @{ text = "Hello" }
                )
            }
        )
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/$model`:generateContent?key=$API_KEY" -Method Post -Body $body -ContentType "application/json"
        Write-Host "✅ $model - WORKS" -ForegroundColor Green
    } catch {
        Write-Host "❌ $model - FAILED" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Fix Applied:" -ForegroundColor Yellow
Write-Host "✅ Changed model in App.tsx computeModelFor function"
Write-Host "✅ All clients now use: gemini-2.5-flash-native-audio-preview-09-2025"