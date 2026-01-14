# AI Quick Actions - Production Verification Script
# Run this after deployment to verify everything works

Write-Host "🔍 AI Quick Actions - Production Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$SUPABASE_URL = "https://ddwqkkiqgjptguzoeohr.supabase.co"
$FUNCTION_URL = "$SUPABASE_URL/functions/v1/ai-chat-direct"
$passed = 0
$failed = 0

# Get API key from .env
if (Test-Path .env) {
    $ANON_KEY = (Get-Content .env | Select-String "VITE_SUPABASE_PUBLISHABLE_KEY=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Running verification tests..." -ForegroundColor White
Write-Host ""

# Test 1: OPTIONS (CORS Preflight)
Write-Host "[1/5] Testing CORS preflight (OPTIONS)..." -ForegroundColor Gray
try {
    $headers = @{
        "Origin" = "http://localhost:8083"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type,apikey"
    }
    $response = Invoke-WebRequest -Uri $FUNCTION_URL -Method OPTIONS -Headers $headers -UseBasicParsing -TimeoutSec 5
    
    if ($response.StatusCode -eq 200) {
        Write-Host "      ✅ PASS - OPTIONS returns 200" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "      ❌ FAIL - OPTIONS returned $($response.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "      ❌ FAIL - OPTIONS request failed: $_" -ForegroundColor Red
    $failed++
}

# Test 2: POST returns 200
Write-Host "[2/5] Testing POST request (basic)..." -ForegroundColor Gray
try {
    $headers = @{
        "apikey" = $ANON_KEY
        "Content-Type" = "application/json"
    }
    $body = @{
        messages = @(@{ role = "user"; content = "test" })
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri $FUNCTION_URL -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 10
    
    if ($response.StatusCode -eq 200) {
        Write-Host "      ✅ PASS - POST returns 200" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "      ❌ FAIL - POST returned $($response.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "      ❌ FAIL - POST failed with status $statusCode" -ForegroundColor Red
    $failed++
}

# Test 3: Content-Type is text/event-stream (streaming)
Write-Host "[3/5] Testing streaming response..." -ForegroundColor Gray
try {
    $headers = @{
        "apikey" = $ANON_KEY
        "Content-Type" = "application/json"
    }
    $body = @{
        messages = @(@{ role = "user"; content = "Say hi" })
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri $FUNCTION_URL -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 10
    $contentType = $response.Headers["Content-Type"]
    
    if ($contentType -match "text/event-stream") {
        Write-Host "      ✅ PASS - Content-Type is text/event-stream" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "      ❌ FAIL - Content-Type is $contentType (expected text/event-stream)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "      ❌ FAIL - Could not check Content-Type: $_" -ForegroundColor Red
    $failed++
}

# Test 4: No 503 BOOT_ERROR
Write-Host "[4/5] Testing for BOOT_ERROR (503)..." -ForegroundColor Gray
try {
    $headers = @{
        "apikey" = $ANON_KEY
        "Content-Type" = "application/json"
    }
    $body = @{
        messages = @(@{ role = "user"; content = "test" })
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri $FUNCTION_URL -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 10
    
    if ($response.StatusCode -ne 503) {
        Write-Host "      ✅ PASS - No 503 BOOT_ERROR" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "      ❌ FAIL - Function returned 503 BOOT_ERROR" -ForegroundColor Red
        $failed++
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 503) {
        Write-Host "      ❌ FAIL - Function returned 503 BOOT_ERROR" -ForegroundColor Red
        $failed++
    } else {
        Write-Host "      ✅ PASS - No 503 BOOT_ERROR (got $statusCode instead)" -ForegroundColor Green
        $passed++
    }
}

# Test 5: CORS headers present
Write-Host "[5/5] Testing CORS headers..." -ForegroundColor Gray
try {
    $headers = @{
        "apikey" = $ANON_KEY
        "Content-Type" = "application/json"
    }
    $body = @{
        messages = @(@{ role = "user"; content = "test" })
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri $FUNCTION_URL -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 10
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    
    if ($corsHeader -eq "*") {
        Write-Host "      ✅ PASS - CORS headers present" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "      ❌ FAIL - CORS header missing or incorrect: $corsHeader" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "      ❌ FAIL - Could not check CORS headers: $_" -ForegroundColor Red
    $failed++
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor White
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "AI Quick Actions is working correctly! 🎉" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. Supabase function logs" -ForegroundColor White
    Write-Host "  2. OPENAI_API_KEY is set in Supabase secrets" -ForegroundColor White
    Write-Host "  3. Function was deployed successfully" -ForegroundColor White
    Write-Host ""
    exit 1
}
