@echo off
echo Checking Vercel deployment readiness...
echo.

echo Checking required files...
if exist "package.json" (
    echo ✓ package.json
) else (
    echo ✗ package.json ^(MISSING^)
    goto :error
)

if exist "backend\package.json" (
    echo ✓ backend\package.json
) else (
    echo ✗ backend\package.json ^(MISSING^)
    goto :error
)

if exist "admin-panel\package.json" (
    echo ✓ admin-panel\package.json
) else (
    echo ✗ admin-panel\package.json ^(MISSING^)
    goto :error
)

if exist "frontend\package.json" (
    echo ✓ frontend\package.json
) else (
    echo ✗ frontend\package.json ^(MISSING^)
    goto :error
)

if exist "vercel.json" (
    echo ✓ vercel.json
) else (
    echo ✗ vercel.json ^(MISSING^)
    goto :error
)

if exist "api\index.ts" (
    echo ✓ api\index.ts
) else (
    echo ✗ api\index.ts ^(MISSING^)
    goto :error
)

echo.
echo All required files found!
echo.
echo Ready for Vercel deployment:
echo 1. Go to vercel.com
echo 2. Import Git Repository  
echo 3. Add environment variables:
echo    - GEMINI_API_KEY
echo    - JWT_SECRET
echo    - ADMIN_USERNAME
echo    - ADMIN_PASSWORD
echo 4. Deploy!
echo.
echo To test build locally run: npm run build
echo.
pause
exit /b 0

:error
echo.
echo Some files are missing. Please check the setup.
pause
exit /b 1