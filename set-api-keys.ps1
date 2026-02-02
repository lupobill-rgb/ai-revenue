# ============================================
# SET API KEYS - Phase 3
# Run this script after getting your API keys
# ============================================

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "PHASE 3 API KEY CONFIGURATION" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# Change to project directory
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"

Write-Host "Please enter your API keys (press Enter to skip optional ones):`n" -ForegroundColor Cyan

# RESEND (Required)
Write-Host "1. RESEND API KEY (Email - REQUIRED):" -ForegroundColor Yellow
$ResendKey = Read-Host "   Enter Resend API key (starts with re_)"

if ($ResendKey) {
    Write-Host "   Setting RESEND_API_KEY..." -ForegroundColor Gray
    supabase secrets set RESEND_API_KEY="$ResendKey"
    Write-Host "   ✓ RESEND_API_KEY set!`n" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Skipped (Email campaigns won't work)`n" -ForegroundColor Yellow
}

# TWILIO (Optional)
Write-Host "2. TWILIO CREDENTIALS (SMS - Optional):" -ForegroundColor Yellow
$TwilioSid = Read-Host "   Enter Twilio Account SID (starts with AC, or press Enter to skip)"

if ($TwilioSid) {
    $TwilioToken = Read-Host "   Enter Twilio Auth Token"
    $TwilioPhone = Read-Host "   Enter Twilio Phone Number (format: +12345678900)"
    
    Write-Host "   Setting Twilio credentials..." -ForegroundColor Gray
    supabase secrets set TWILIO_AUTH_TOKEN="$TwilioSid"
    supabase secrets set TWILIO_AUTH_TOKEN="$TwilioToken"
    supabase secrets set TWILIO_FROM_NUMBER="$TwilioPhone"
    Write-Host "   ✓ Twilio credentials set!`n" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Skipped (SMS campaigns won't work)`n" -ForegroundColor Yellow
}

# VAPI (Optional)
Write-Host "3. VAPI PRIVATE KEY (Voice - Optional):" -ForegroundColor Yellow
$VapiKey = Read-Host "   Enter VAPI Private Key (or press Enter to skip)"

if ($VapiKey) {
    Write-Host "   Setting VAPI_PRIVATE_KEY..." -ForegroundColor Gray
    supabase secrets set VAPI_PRIVATE_KEY="$VapiKey"
    Write-Host "   ✓ VAPI_PRIVATE_KEY set!`n" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Skipped (Voice campaigns won't work)`n" -ForegroundColor Yellow
}

# ELEVENLABS (Optional)
Write-Host "4. ELEVENLABS API KEY (Voice Quality - Optional):" -ForegroundColor Yellow
$ElevenLabsKey = Read-Host "   Enter ElevenLabs API Key (or press Enter to skip)"

if ($ElevenLabsKey) {
    Write-Host "   Setting ELEVENLABS_API_KEY..." -ForegroundColor Gray
    supabase secrets set ELEVENLABS_API_KEY="$ElevenLabsKey"
    Write-Host "   ✓ ELEVENLABS_API_KEY set!`n" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Skipped (Will use default voice quality)`n" -ForegroundColor Yellow
}

# Verify secrets
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VERIFYING SECRETS..." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Running: supabase secrets list`n" -ForegroundColor Gray
supabase secrets list

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "CONFIGURATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Test email send from UI" -ForegroundColor White
Write-Host "  2. Launch test campaign" -ForegroundColor White
Write-Host "  3. Ship to production!`n" -ForegroundColor White

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

