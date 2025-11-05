Write-Host "Checking Vercel deployment readiness..." -ForegroundColor Yellow

# Check that all package.json files exist
Write-Host "Checking package.json files..." -ForegroundColor Cyan

$files = @(
    "package.json",
    "backend/package.json", 
    "admin-panel/package.json",
    "frontend/package.json"
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Host "Missing: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "All package.json files found" -ForegroundColor Green

# Check vercel.json
if (-not (Test-Path "vercel.json")) {
    Write-Host "Missing: vercel.json" -ForegroundColor Red
    exit 1
}

Write-Host "vercel.json found" -ForegroundColor Green

# Check API file
if (-not (Test-Path "api/index.ts")) {
    Write-Host "Missing: api/index.ts" -ForegroundColor Red
    exit 1
}

Write-Host "api/index.ts found" -ForegroundColor Green

# Try to install and build
Write-Host "Installing dependencies..." -ForegroundColor Yellow

try {
    & npm run install:all
    
    if ($LASTEXITCODE -ne 0) {
        throw "Dependencies installation failed"
    }
    
    Write-Host "Building project..." -ForegroundColor Cyan
    & npm run build
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    
    Write-Host "Ready for Vercel deployment!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Create project on vercel.com" -ForegroundColor White
    Write-Host "2. Connect this Git repository" -ForegroundColor White  
    Write-Host "3. Add environment variables:" -ForegroundColor White
    Write-Host "   - GEMINI_API_KEY" -ForegroundColor Gray
    Write-Host "   - JWT_SECRET" -ForegroundColor Gray
    Write-Host "   - ADMIN_USERNAME" -ForegroundColor Gray
    Write-Host "   - ADMIN_PASSWORD" -ForegroundColor Gray
    Write-Host "4. Click Deploy" -ForegroundColor White
    Write-Host ""
    Write-Host "Full instructions: VERCEL-DEPLOYMENT.md" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}