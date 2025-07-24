# 🌉 File System Bridge Test Guide

## 🎯 **BREAKTHROUGH SOLUTION**

**Problem SOLVED:** Browser localStorage isolation from Tauri app!  
**Solution:** File system bridge via `~/.framesense/payment_ready.json`

---

## 🔧 **Setup (All 4 Servers Must Run)**

```bash
# Terminal 1: Backend (Port 3001)
cd backend && OPENAI_API_KEY=sk-dummy-for-dev JWT_SECRET=dev-secret npm run dev

# Terminal 2: Website (Port 3000) 
cd website && npm run dev

# Terminal 3: Payments (Port 8080)
cd website && node payments-server.js

# Terminal 4: Tauri App
npm run dev
```

**Verify:** All servers should be running without errors.

---

## 🧪 **TEST FLOW: Real Payment Authentication**

### **Step 1: Clear Everything First**
1. Open Tauri app: `Alt+Space`
2. Click **🔍** (debug toggle)
3. Should show **"NO USER"** (test user eliminated ✅)
4. Click **🗑️** (clear session) - just to be sure
5. Click **📄** (clear payment file) - new button!

### **Step 2: Real Payment Flow**
1. Go to: http://localhost:8080/payments.html
2. Login or create new account
3. Select **Premium (99 SEK)** or **Pro (299 SEK)**
4. Use Stripe test card: `4242 4242 4242 4242`
5. Complete payment

### **Step 3: Success Page Magic ✨**
- Success page loads: http://localhost:3000/success.html?token=...
- **Watch console logs:** `💾 Saving payment credentials to file system...`
- **Should see:** "✅ Payment credentials saved to file system for Tauri pickup"
- Button changes to **"Credentials Ready - Return to App"** (green)

### **Step 4: File System Verification**
```bash
# Check if file was created:
ls -la ~/.framesense/payment_ready.json

# View file contents:
cat ~/.framesense/payment_ready.json
```

**Should contain:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "user@example.com",
  "plan": "premium",
  "timestamp": 1752230154,
  "session_id": "cs_1234...",
  "created_at": "2025-01-11T10:35:46.120Z"
}
```

### **Step 5: Tauri App Authentication**
1. Go back to Tauri app
2. **Debug should still show "NO USER"** (normal - file not read yet)
3. Click **"Models"** button  
4. Click **"Already paid? Check status"**

**🎉 MAGIC HAPPENS:**
- **Console:** `💾 Found payment credentials in file system!`
- **Console:** `✅ Payment user authenticated from file system: user@example.com → premium`
- **Debug panel:** Shows real user email + tier (PREMIUM/PRO)
- **File automatically deleted** (security cleanup)

---

## 🚀 **QUICK TEST METHOD**

```bash
# Create test user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "testpay@example.com", "password": "password123", "name": "Test Payment User"}'

# Manually create payment file (for testing)
curl -X POST http://localhost:3001/api/save-payment-credentials \
  -H "Content-Type: application/json" \
  -d '{"token": "test_jwt_123", "email": "testpay@example.com", "plan": "premium"}'

# Check file was created
ls -la ~/.framesense/payment_ready.json

# Go to app → Models → "Check status" → Should authenticate!
```

---

## 🔍 **Debug Panel Features**

**New buttons:**
- **🔍** Toggle debug info
- **🗑️** Clear user session
- **🔄** Refresh from backend  
- **📄** Clear payment file (NEW!)

**Expected flow:**
1. **Before payment:** Shows "NO USER"
2. **After payment + check:** Shows real user email + tier
3. **File cleanup:** payment_ready.json deleted automatically

---

## ✅ **Success Criteria**

1. **✅ File created:** `~/.framesense/payment_ready.json` exists after payment
2. **✅ Real authentication:** Debug shows paying user, not test user
3. **✅ Correct tier:** Premium payment → PREMIUM badge in debug
4. **✅ File cleanup:** payment_ready.json deleted after authentication
5. **✅ Model access:** Premium models available in Models selector

---

## 🚨 **Troubleshooting**

### **File not created**
- Check backend console for save errors
- Verify success page reached (not skipped)
- Check network tab for /save-payment-credentials request

### **"No payment credentials file found"**
- File might have been read already (check console logs)
- Use **📄** button to clear any stuck files
- Try payment flow again

### **Authentication failed**
- Check JWT token validity (1h expiry)
- Verify backend JWT_SECRET matches
- Try refreshing user session with **🔄**

### **Still shows "NO USER"**
- Make sure you clicked "Check status" after payment
- File might not exist - check `ls ~/.framesense/`
- Try manual file creation with curl command above

---

## 🎯 **Expected Result**

**BEFORE:** test@framesense.se stuck forever  
**AFTER:** Real paying user from web payment shows in Tauri app!

**The bridge between web payments and desktop app is now complete!** 🌉✨ 