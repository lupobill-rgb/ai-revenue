#!/bin/bash
# Phase 3 Deployment Script
# Run this script to deploy all Phase 3 changes

set -e  # Exit on error

echo "🚀 Phase 3 Deployment Starting..."
echo ""

# Step 1: Apply Migration
echo "📊 Step 1: Applying database migration..."
supabase db push || {
    echo "❌ Migration failed! Check your database connection."
    exit 1
}
echo "✅ Migration applied successfully"
echo ""

# Step 2: Deploy Edge Functions
echo "⚡ Step 2: Deploying Edge Functions..."
FUNCTIONS=(
    "run-job-queue"
    "campaign-schedule-outbox"
    "cmo-campaign-orchestrate"
    "ai-cmo-autopilot-build"
)

for func in "${FUNCTIONS[@]}"; do
    echo "  Deploying $func..."
    supabase functions deploy "$func" || {
        echo "❌ Failed to deploy $func"
        exit 1
    }
done
echo "✅ All functions deployed successfully"
echo ""

# Step 3: Check Twilio Configuration
echo "🔧 Step 3: Checking Twilio configuration..."
if supabase secrets list | grep -q "TWILIO_ACCOUNT_SID"; then
    echo "✅ Twilio credentials configured"
else
    echo "⚠️  Twilio credentials not found!"
    echo "   Run these commands to configure SMS:"
    echo "   supabase secrets set TWILIO_ACCOUNT_SID=your_sid"
    echo "   supabase secrets set TWILIO_AUTH_TOKEN=your_token"
    echo "   supabase secrets set TWILIO_FROM_NUMBER=+1234567890"
fi
echo ""

# Step 4: Verification
echo "🔍 Step 4: Running verification checks..."
echo "  Checking migration applied..."
supabase db diff || echo "  Note: No pending migrations"

echo ""
echo "✅ Phase 3 Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Run smoke tests (see PHASE3_DEPLOYMENT_GUIDE.md)"
echo "2. Monitor channel_outbox table for status distribution"
echo "3. Check campaign_audit_log for any errors"
echo ""
echo "📖 Full documentation: RELEASE_READINESS_REPORT_PHASE3.md"

