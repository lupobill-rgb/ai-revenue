# 🔐 CONFIGURE API KEYS - PHASE 3

**Status:** Ready to Configure  
**Date:** 2026-01-08  
**Project:** ddwqkkiqgjptguzoeohr

---

## 🎯 REQUIRED API KEYS

### **1. RESEND (Email) - REQUIRED** ⭐

**What it does:** Sends campaign emails  
**Where to get it:** https://resend.com/api-keys

**Steps:**
1. Go to: https://resend.com/api-keys
2. Sign in (or create free account)
3. Click "Create API Key"
4. Name it: "UbiGrowth Production"
5. Copy the key (starts with `re_`)

**Cost:** Free tier: 100 emails/day, 3,000/month

---

### **2. TWILIO (SMS) - REQUIRED** ⭐

**What it does:** Sends campaign SMS messages  
**Where to get it:** https://console.twilio.com/

**Steps:**
1. Go to: https://console.twilio.com/
2. Sign in (or create trial account)
3. Get these 3 values from dashboard:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (click to reveal)
   - **Phone Number** (from Phone Numbers section)

**Cost:** Trial: $15 credit, then ~$0.0075/SMS

**Note:** You need to verify your Twilio phone number first!

---

### **3. VAPI (Voice/Voicemail) - OPTIONAL**

**What it does:** Makes AI voice calls and voicemail drops  
**Where to get it:** https://vapi.ai/dashboard

**Steps:**
1. Go to: https://vapi.ai/dashboard
2. Sign in (or create account)
3. Go to Settings → API Keys
4. Create new key
5. Copy the private key

**Cost:** Pay-as-you-go, ~$0.05-0.15/minute

---

### **4. ELEVENLABS (Voice Quality) - OPTIONAL**

**What it does:** High-quality AI voice synthesis  
**Where to get it:** https://elevenlabs.io/

**Steps:**
1. Go to: https://elevenlabs.io/
2. Sign in
3. Go to Profile → API Keys
4. Copy your API key

**Cost:** Free tier: 10,000 characters/month

---

## 🔧 SET API KEYS VIA COMMAND LINE

Once you have the keys, run these commands:

### **Email (Resend):**
```powershell
cd "C:\Users\bill\.cursor\ubigrowth-marketing-hub"
supabase secrets set RESEND_API_KEY="re_your_actual_key_here"
```

### **SMS (Twilio):**
```powershell
supabase secrets set TWILIO_ACCOUNT_SID="ACyour_sid_here"
supabase secrets set TWILIO_AUTH_TOKEN="your_auth_token_here"
supabase secrets set TWILIO_FROM_NUMBER="+12345678900"
```

### **Voice (VAPI) - Optional:**
```powershell
supabase secrets set VAPI_PRIVATE_KEY="your_vapi_key_here"
```

### **Voice Quality (ElevenLabs) - Optional:**
```powershell
supabase secrets set ELEVENLABS_API_KEY="your_elevenlabs_key_here"
```

---

## 🌐 SET API KEYS VIA DASHBOARD (Alternative)

If command line doesn't work:

1. Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/functions
2. Click "Secrets" or "Environment Variables"
3. Add each key manually:
   - Name: `RESEND_API_KEY`
   - Value: `re_your_key`
   - Click "Add"
4. Repeat for all keys

---

## ✅ VERIFY KEYS ARE SET

### **Via Command Line:**
```powershell
supabase secrets list
```

**Expected output:**
```
RESEND_API_KEY=re_****
TWILIO_ACCOUNT_SID=AC****
TWILIO_AUTH_TOKEN=****
TWILIO_FROM_NUMBER=+1234567890
VAPI_PRIVATE_KEY=****
ELEVENLABS_API_KEY=****
```

### **Via Dashboard:**
1. Go to: https://supabase.com/dashboard/project/ddwqkkiqgjptguzoeohr/settings/functions
2. Click "Secrets"
3. Verify all keys are listed

---

## 🧪 TEST API KEYS

### **Test Email (Resend):**

**Option 1: Via UI**
1. Go to http://localhost:8081/
2. Navigate to Campaigns
3. Create test email campaign
4. Send to your own email
5. Check inbox!

**Option 2: Via SQL**
```sql
-- NOTE: Revenue OS Kernel invariant:
-- Do not write directly to channel_outbox from docs exports/fixtures.
-- Outbox rows must only be created by dispatcher/allowlisted code paths.
-- Removed outbox seeding here. Dispatcher-only.

-- Then invoke run-job-queue function
```

### **Test SMS (Twilio):**
Similar to email, but use `channel = 'sms'`

### **Test Voice (VAPI):**
Similar to email, but use `channel = 'voice'`

---

## 🚨 TROUBLESHOOTING

### **Error: "Secrets not set"**
- Make sure you're in the right directory
- Run `supabase link --project-ref ddwqkkiqgjptguzoeohr` first
- Try setting via Dashboard instead

### **Error: "Invalid API key"**
- Double-check the key format:
  - Resend: starts with `re_`
  - Twilio SID: starts with `AC`
  - No extra spaces or quotes
- Regenerate key from provider dashboard

### **Error: "Unauthorized"**
- For Resend: Verify domain ownership first
- For Twilio: Complete phone number verification
- For VAPI: Check account is activated

---

## 📋 QUICK START CHECKLIST

**Minimum Required (Email only):**
- [ ] Get Resend API key
- [ ] Set `RESEND_API_KEY` secret
- [ ] Test email send
- [ ] ✅ Ready to launch email campaigns!

**Full Setup (All channels):**
- [ ] Get Resend API key (Email)
- [ ] Get Twilio credentials (SMS)
- [ ] Get VAPI key (Voice)
- [ ] Set all secrets
- [ ] Test each channel
- [ ] ✅ Ready for multi-channel campaigns!

---

## 🎉 AFTER KEYS ARE SET

Once API keys are configured:

1. **Launch Test Campaign:**
   - Target 1 lead (yourself)
   - Send via email
   - Check inbox
   - Verify delivery!

2. **Check Logs:**
   - Dashboard → Edge Functions → run-job-queue → Logs
   - Look for successful sends

3. **Monitor Outbox:**
   ```sql
   SELECT * FROM channel_outbox 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

4. **Ship to Production!** 🚀

---

*Generated: 2026-01-08*  
*API Configuration Guide*

