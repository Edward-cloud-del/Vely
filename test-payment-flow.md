# 🚀 FrameSense Real Payment Authentication Test Guide

## 🎯 **System Overview**

**PROBLEM SOLVED:** No more test@framesense.se stuck in "pro" mode!  
**SOLUTION:** Real JWT tokens from payments → Real user authentication in app

---

## 🔧 **Prerequisites**

Make sure all servers are running:

```bash
# Terminal 1: Backend
cd backend && OPENAI_API_KEY=sk-dummy-for-dev JWT_SECRET=dev-secret npm run dev

# Terminal 2: Website  
cd website && npm run dev

# Terminal 3: Tauri App
npm run dev
```

**Verify servers:**
- ✅ Backend: http://localhost:3001/health
- ✅ Website: http://localhost:3000/ 
- ✅ Payments: http://localhost:8080/payments.html
- ✅ Tauri: Alt+Space to open app

---

## 🧪 **Method 1: Test Simulation (Recommended)**

### **Step 1: Clear Old Session**
1. Open Tauri app (Alt+Space)
2. Click **🔍 debug button** 
3. Click **🗑️ Clear Session** to remove test@framesense.se
4. Verify shows **"NO USER"**

### **Step 2: Create Real User**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "realuser@example.com", "password": "password123", "name": "Real User"}'
```

### **Step 3: Simulate Payment**
```bash
curl -X POST http://localhost:3001/api/subscription/simulate-payment-success \
  -H "Content-Type: application/json" \
  -d '{"email": "realuser@example.com", "plan": "premium"}'
```

**Copy the `successUrl` from response!**

### **Step 4: Visit Success Page**
1. Open the `successUrl` in browser
2. Should see **"Credentials Ready - Return to App"** (green button)
3. Check browser localStorage for `framesense_payment_token`

### **Step 5: Authenticate in App**
1. Go back to Tauri app
2. Click **🔍** to see debug info - should still show **"NO USER"**
3. Click **"Models"** button
4. Click **"Already paid? Check status"**
5. **🎉 SUCCESS:** Debug should now show `realuser@example.com` with `PREMIUM` tier!

---

## 💳 **Method 2: Real Stripe Payment**

### **Step 1: Real Payment Flow**
1. Go to http://localhost:8080/payments.html
2. Login or create account
3. Choose Premium or Pro plan
4. Use Stripe test card: `4242 4242 4242 4242`
5. Complete payment

### **Step 2: Success Page**
- Should redirect to success page with real JWT token
- Look for green "Credentials Ready" button

### **Step 3: App Authentication**
- Same as Method 1, Step 5

---

## 🔍 **Debugging Checklist**

### **Debug Panel (🔍 button)**
- **NO USER** = Good start, no old test user
- **Email shown** = Real user authenticated  
- **Tier badge** = Correct tier (PREMIUM/PRO)

### **Console Logs**
```javascript
// Look for these in browser/app console:
🎉 Found payment credentials in localStorage!
✅ Payment user authenticated successfully: realuser@example.com → premium
🔄 User tier updated from free to premium
```

### **localStorage Check (Browser)**
```javascript
// In success page, check:
localStorage.getItem('framesense_payment_token') // Should have JWT
localStorage.getItem('framesense_payment_email') // Should have email
```

---

## ✅ **Success Criteria**

1. **Old test user eliminated** - NO test@framesense.se in app
2. **Real user shows in debug** - Correct email and tier displayed
3. **Tier access works** - Premium models available after payment
4. **Token cleanup** - localStorage cleared after successful auth

---

## 🚨 **Troubleshooting**

### **"NO USER" after check status**
- Check localStorage has `framesense_payment_token`
- Check backend is running on port 3001
- Try 🔄 refresh session button

### **Still shows test@framesense.se**
- Click 🗑️ clear session first
- Make sure success page visited after payment
- Check browser localStorage has new token

### **"Authentication failed" error**
- Check JWT_SECRET matches between backend and token
- Token might be expired (1h limit)
- Try new simulation/payment

---

## 🎯 **Expected Result**

**BEFORE:** test@framesense.se (pro) stuck forever  
**AFTER:** Real paying user with correct tier shows in app!

The bridge between Stripe payments and Tauri app is now complete! 🎉 