Write-Host "Quick Vercel readiness check..." -ForegroundColor Yellow

# Check files only
Write-Host "Checking required files..." -ForegroundColor Cyan

$files = @(
    "package.json",
    "backend/package.json", 
    "admin-panel/package.json",
    "frontend/package.json",
    "vercel.json",
    "api/index.ts"
)

$allFound = $true

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file (MISSING)" -ForegroundColor Red
        $allFound = $false
    }
}

if ($allFound) {
    Write-Host "`nAll required files found!" -ForegroundColor Green
    Write-Host "`nReady for Vercel deployment:" -ForegroundColor Yellow
    Write-Host "1. Go to vercel.com" -ForegroundColor White
    Write-Host "2. Import Git Repository" -ForegroundColor White
    Write-Host "3. Add environment variables:" -ForegroundColor White
    Write-Host "   - GEMINI_API_KEY" -ForegroundColor Gray
    Write-Host "   - JWT_SECRET" -ForegroundColor Gray  
    Write-Host "   - ADMIN_USERNAME" -ForegroundColor Gray
    Write-Host "   - ADMIN_PASSWORD" -ForegroundColor Gray
    Write-Host "4. Deploy!" -ForegroundColor White
    Write-Host "`nTo test build locally run: npm run build" -ForegroundColor Cyan
} else {
    Write-Host "`nSome files are missing. Please check the setup." -ForegroundColor Red
    exit 1
}