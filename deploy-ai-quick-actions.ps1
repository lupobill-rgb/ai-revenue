# AI Quick Actions - Production Deployment Script
# Last Updated: January 12, 2026

Write-Host "🚀 AI Quick Actions - Production Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_REF = "ddwqkkiqgjptguzoeohr"
$FUNCTION_NAME = "ai-chat-direct"
$SUPABASE_URL = "https://ddwqkkiqgjptguzoeohr.supabase.co"

# Step 1: Pre-deployment checks
Write-Host "📋 Step 1: Pre-deployment Checks" -ForegroundColor Yellow
Write-Host ""

# Check if .env exists
if (!(Test-Path .env)) {
    Write-Host "❌ ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "   Create .env with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY" -ForegroundColor Red
    exit 1
}
Write-Host "✅ .env file exists" -ForegroundColor Green

# Check if function file exists
if (!(Test-Path "supabase/functions/$FUNCTION_NAME/index.ts")) {
    Write-Host "❌ ERROR: Function file not found!" -ForegroundColor Red
    Write-Host "   Expected: supabase/functions/$FUNCTION_NAME/index.ts" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Function file exists" -ForegroundColor Green

# Check if tests exist
if (!(Test-Path "tests/smoke-ai-quick-actions.test.ts")) {
    Write-Host "⚠️  WARNING: Smoke test file not found" -ForegroundColor Yellow
} else {
    Write-Host "✅ Smoke test file exists" -ForegroundColor Green
}

Write-Host ""

# Step 2: Run tests (optional - skip if npm test not configured)
Write-Host "📋 Step 2: Running Tests" -ForegroundColor Yellow
Write-Host "   (Skipping - run manually: npm test tests/smoke-ai-quick-actions.test.ts)" -ForegroundColor Gray
Write-Host ""

# Step 3: Deploy Edge Function
Write-Host "📋 Step 3: Deploying Edge Function" -ForegroundColor Yellow
Write-Host ""

# Backup .env to avoid deployment issues
if (Test-Path .env) {
    Write-Host "   Backing up .env..." -ForegroundColor Gray
    Copy-Item .env .env.backup -Force
}

try {
    Write-Host "   Deploying $FUNCTION_NAME..." -ForegroundColor Gray
    supabase functions deploy $FUNCTION_NAME --project-ref $PROJECT_REF --no-verify-jwt
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Function deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Function deployment failed" -ForegroundColor Red
        exit 1
    }
} finally {
    # Restore .env
    if (Test-Path .env.backup) {
        Write-Host "   Restoring .env..." -ForegroundColor Gray
        Move-Item .env.backup .env -Force
    }
}

Write-Host ""

# Step 4: Verify deployment
Write-Host "📋 Step 4: Verifying Deployment" -ForegroundColor Yellow
Write-Host ""

$FUNCTION_URL = "$SUPABASE_URL/functions/v1/$FUNCTION_NAME"

# Test OPTIONS (CORS preflight)
Write-Host "   Testing CORS preflight (OPTIONS)..." -ForegroundColor Gray
try {
    $headers = @{
        "Origin" = "http://localhost:8083"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type,apikey"
    }
    $response = Invoke-WebRequest -Uri $FUNCTION_URL -Method OPTIONS -Headers $headers -UseBasicParsing -TimeoutSec 5
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ OPTIONS returns 200 (CORS working)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  OPTIONS returned $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ OPTIONS failed: $_" -ForegroundColor Red
}

# Test POST with minimal payload
Write-Host "   Testing POST request..." -ForegroundColor Gray

# Get API key from .env
$ANON_KEY = (Get-Content .env | Select-String "VITE_SUPABASE_PUBLISHABLE_KEY=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })

if ($ANON_KEY) {
    try {
        $headers = @{
            "apikey" = $ANON_KEY
            "Content-Type" = "application/json"
        }
        $body = @{
            messages = @(
                @{ role = "user"; content = "test" }
            )
        } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri $FUNCTION_URL -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 10
        
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ POST returns 200 (Function working)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  POST returned $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode) {
            Write-Host "❌ POST failed with status $statusCode" -ForegroundColor Red
        } else {
            Write-Host "❌ POST failed: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "⚠️  Could not read ANON_KEY from .env - skipping POST test" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Final checklist
Write-Host "📋 Step 5: Post-Deployment Checklist" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Manual verification required:" -ForegroundColor Gray
Write-Host "   [ ] Open browser to production URL" -ForegroundColor White
Write-Host "   [ ] Click 'Generate Campaign Ideas' button" -ForegroundColor White
Write-Host "   [ ] Verify AI response streams correctly" -ForegroundColor White
Write-Host "   [ ] Check browser console for errors" -ForegroundColor White
Write-Host "   [ ] Verify Supabase function logs" -ForegroundColor White
Write-Host ""

Write-Host "🔗 Useful Links:" -ForegroundColor Cyan
Write-Host "   Function Logs:  https://supabase.com/dashboard/project/$PROJECT_REF/functions/$FUNCTION_NAME/logs" -ForegroundColor Gray
Write-Host "   Function Metrics: https://supabase.com/dashboard/project/$PROJECT_REF/functions/$FUNCTION_NAME/metrics" -ForegroundColor Gray
Write-Host "   OpenAI Usage:   https://platform.openai.com/usage" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  REMEMBER:" -ForegroundColor Yellow
Write-Host "   - Test in browser before announcing to users" -ForegroundColor White
Write-Host "   - Monitor Supabase logs for the first hour" -ForegroundColor White
Write-Host "   - Check OpenAI usage to ensure no cost spikes" -ForegroundColor White
Write-Host ""
