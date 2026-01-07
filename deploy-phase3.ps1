# Phase 3 Deployment Script (PowerShell)
# Run this script to deploy all Phase 3 changes

$ErrorActionPreference = "Stop"

Write-Host "🚀 Phase 3 Deployment Starting..." -ForegroundColor Green
Write-Host ""

# Step 1: Apply Migration
Write-Host "📊 Step 1: Applying database migration..." -ForegroundColor Yellow
try {
    supabase db push
    Write-Host "✅ Migration applied successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Migration failed! Check your database connection." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Deploy Edge Functions
Write-Host "⚡ Step 2: Deploying Edge Functions..." -ForegroundColor Yellow
$functions = @(
    "run-job-queue",
    "campaign-schedule-outbox",
    "cmo-campaign-orchestrate",
    "ai-cmo-autopilot-build"
)

foreach ($func in $functions) {
    Write-Host "  Deploying $func..." -ForegroundColor Cyan
    try {
        supabase functions deploy $func
    } catch {
        Write-Host "❌ Failed to deploy $func" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ All functions deployed successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Check Twilio Configuration
Write-Host "🔧 Step 3: Checking Twilio configuration..." -ForegroundColor Yellow
$secrets = supabase secrets list 2>&1
if ($secrets -match "TWILIO_ACCOUNT_SID") {
    Write-Host "✅ Twilio credentials configured" -ForegroundColor Green
} else {
    Write-Host "⚠️  Twilio credentials not found!" -ForegroundColor Yellow
    Write-Host "   Run these commands to configure SMS:" -ForegroundColor Yellow
    Write-Host "   supabase secrets set TWILIO_ACCOUNT_SID=your_sid" -ForegroundColor Gray
    Write-Host "   supabase secrets set TWILIO_AUTH_TOKEN=your_token" -ForegroundColor Gray
    Write-Host "   supabase secrets set TWILIO_FROM_NUMBER=+1234567890" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Verification
Write-Host "🔍 Step 4: Running verification checks..." -ForegroundColor Yellow
Write-Host "  Checking migration status..." -ForegroundColor Cyan
try {
    supabase db diff
} catch {
    Write-Host "  Note: No pending migrations" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Phase 3 Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Run smoke tests (see PHASE3_DEPLOYMENT_GUIDE.md)" -ForegroundColor White
Write-Host "2. Monitor channel_outbox table for status distribution" -ForegroundColor White
Write-Host "3. Check campaign_audit_log for any errors" -ForegroundColor White
Write-Host ""
Write-Host "📖 Full documentation: RELEASE_READINESS_REPORT_PHASE3.md" -ForegroundColor Cyan

