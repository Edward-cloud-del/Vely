# 🚨 FrameSense Payment Integration - Problem Analysis & Solutions

## 📋 **Aktuellt Problem**
**Symptom**: När användare loggar in på hemsidan (localhost:3000) registreras inte denna inloggning i desktop-appen.

## 🔍 **Möjliga Rotorsaker - Komplett Analys**

### **1. BACKEND WEBHOOK PROBLEM**
**Problem**: Stripe webhook når aldrig backend eller processas inte korrekt.

**Möjliga orsaker**:
- Webhook URL är fel konfigurerad i Stripe Dashboard
- Webhook secret är fel eller saknas
- Backend lyssnar inte på rätt endpoint
- Webhook events når backend men parsas fel

**Diagnostik**:
```bash
# Kolla Stripe webhook logs i dashboard
# Kolla backend logs för webhook events
# Testa manuellt med ngrok/webhook test
```

**Lösning A - Verifiera Webhook**:
```javascript
// Lägg till debug logging i webhook
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  console.log('🎯 RAW WEBHOOK RECEIVED:', req.body.toString());
  console.log('🎯 HEADERS:', req.headers);
  // ... fortsätt med webhook processing
});
```

---

### **2. DATABASE UPDATE PROBLEM**  
**Problem**: Webhook når backend men användaren uppdateras inte i databasen.

**Möjliga orsaker**:
- User ID matching misslyckas (client_reference_id vs user.id)
- AuthService.updateUser() funktion är trasig
- Databas-fil har fel permissions
- Race condition mellan webhook och status check

**Diagnostik**:
```bash
# Inspektera users.json efter webhook
# Kolla console logs för user ID matching
# Verifiera att updateUser() anropas
```

**Lösning B - Debug Database Updates**:
```javascript
// I webhook handler
console.log('🔍 Looking for user with ID:', userId);
console.log('🔍 Available users:', Object.keys(userData.users));
console.log('🔍 Found user email:', userEmail);

// Efter update
console.log('🔍 User updated in database:', userData.users[userEmail]);
```

---

### **3. FRONTEND STATUS CHECK PROBLEM**
**Problem**: Desktop-appen kör aldrig status check eller kollar fel endpoint.

**Möjliga orsaker**:
- Auth token är utgånget eller ogiltigt
- API endpoint URL är fel
- CORS problem mellan frontend och backend
- Fetch request misslyckas tyst

**Diagnostik**:
```bash
# Kolla network tab i dev tools
# Kolla console för fetch errors
# Verifiera auth token format
```

**Lösning C - Debug Status Check**:
```typescript
// I checkUserStatus()
console.log('🔍 Making status check request with token:', this.currentUser.token.substring(0, 20) + '...');
console.log('🔍 Request URL:', 'http://localhost:3001/api/check-status');

const response = await fetch('http://localhost:3001/api/check-status', {
  headers: {
    'Authorization': `Bearer ${this.currentUser.token}`,
  }
});

console.log('🔍 Response status:', response.status);
console.log('🔍 Response data:', await response.clone().json());
```

---

### **4. USER AUTHENTICATION STATE PROBLEM**
**Problem**: Desktop-appen har ingen användare inloggad för att kolla status på.

**Möjliga orsaker**:
- Användaren är inte inloggad i desktop-appen alls
- Session har försvunnit eller rensats
- Auth token har gått ut
- Login flow i appen är trasig

**Diagnostik**:
```bash
# Kolla currentUser state i debug mode
# Verifiera att login fungerar i appen
# Testa refresh status med inloggad user
```

**Lösning D - Fix Auth State**:
```typescript
// Lägg till automatic login check vid app start
useEffect(() => {
  const checkAuthState = async () => {
    const user = await authService.getCurrentUser();
    if (!user) {
      console.log('⚠️ No user logged in - status check not possible');
      // Visa login prompt eller automatisk guest mode
    }
  };
  checkAuthState();
}, []);
```

---

### **5. TIMING/RACE CONDITION PROBLEM**
**Problem**: Desktop-appen kollar status innan webhook har uppdaterat databasen.

**Möjliga orsaker**:
- Webhook processar långsamt
- Status check händer för snabbt efter betalning
- Stripe webhook leverans är försenad
- Database write är async och inte väntar

**Lösning E - Retry Mechanism**:
```typescript
// Lägg till retry logic i status check
async checkUserStatusWithRetry(maxRetries = 3, delayMs = 2000): Promise<User | null> {
  for (let i = 0; i < maxRetries; i++) {
    const user = await this.checkUserStatus();
    
    if (user && user.tier !== 'free') {
      return user; // Success!
    }
    
    if (i < maxRetries - 1) {
      console.log(`🔄 Status check attempt ${i + 1} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return null;
}
```

---

## 🛠️ **ALTERNATIVA LÖSNINGAR - Från Enklast till Komplexast**

### **🥇 LÖSNING 1: MANUAL STATUS POLLING**
**Koncept**: Desktop-appen polllar backend med intervall för att kolla status.

**Implementation**:
```typescript
// I App.tsx - Auto polling efter payment
const startPaymentPolling = () => {
  const pollInterval = setInterval(async () => {
    const user = await authService.checkUserStatus();
    if (user && user.tier !== 'free') {
      clearInterval(pollInterval);
      alert(`🎉 Payment detected! You are now ${user.tier}!`);
    }
  }, 5000); // Kolla var 5:e sekund

  // Stop efter 2 minuter
  setTimeout(() => clearInterval(pollInterval), 120000);
};

// Anropa efter "Upgrade to Pro" klick
```

**För/Nackdelar**:
✅ Enkel implementation
✅ Fungerar oavsett webhook timing
❌ Polling är inte effektivt
❌ Användaren måste vänta

---

### **🥈 LÖSNING 2: SHARED FILE SYSTEM**
**Koncept**: Backend skriver till fil när webhook triggas, appen läser filen.

**Implementation**:
```javascript
// I webhook handler (backend)
const fs = require('fs').promises;
const path = require('path');

// När payment lyckas
const paymentStatusFile = path.join(os.homedir(), '.framesense', 'payment_status.json');
await fs.writeFile(paymentStatusFile, JSON.stringify({
  userId: userId,
  tier: newTier,
  timestamp: Date.now(),
  processed: true
}));
```

```typescript
// I desktop app
const checkPaymentFile = async () => {
  try {
    const statusFile = await invoke('read_payment_status_file');
    if (statusFile && statusFile.processed) {
      // Payment detected!
      await authService.checkUserStatus(); // Sync with server
      await invoke('clear_payment_status_file'); // Clean up
    }
  } catch (error) {
    // No file yet
  }
};
```

**För/Nackdelar**:
✅ Real-time detection
✅ Fungerar offline
❌ File system komplexitet
❌ Platform-specifik

---

### **🥉 LÖSNING 3: WEBSOCKET REAL-TIME**
**Koncept**: Backend skickar real-time meddelande till desktop-app via WebSocket.

**Implementation**:
```javascript
// Backend WebSocket setup
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// I webhook handler
wss.clients.forEach(client => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      type: 'payment_success',
      userId: userId,
      tier: newTier
    }));
  }
});
```

```typescript
// Desktop app WebSocket client
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'payment_success' && data.userId === currentUser?.id) {
      authService.checkUserStatus(); // Refresh från server
      alert(`🎉 Payment Success! You are now ${data.tier}!`);
    }
  };
  
  return () => ws.close();
}, []);
```

**För/Nackdelar**:
✅ Instant real-time updates
✅ Skalbar för många users
❌ Komplex setup
❌ Kräver WebSocket infrastructure

---

### **🏆 LÖSNING 4: BROWSER-APP BRIDGE**
**Koncept**: Hemsidan kommunicerar direkt med desktop-appen via custom protocol.

**Implementation**:
```html
<!-- I success.html på hemsidan -->
<script>
window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan');
  
  // Försök öppna custom protocol
  window.location.href = `framesense://payment-success?plan=${plan}&timestamp=${Date.now()}`;
  
  // Fallback - visa meddelande
  setTimeout(() => {
    alert('Payment successful! Please refresh your FrameSense app.');
  }, 2000);
};
</script>
```

```rust
// I Tauri main.rs - Custom protocol handler
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.listen_global("framesense://", |event| {
                if event.url().contains("payment-success") {
                  // Trigger app refresh
                  app.emit_all("payment_detected", {}).unwrap();
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**För/Nackdelar**:
✅ Direct browser-to-app communication
✅ User-friendly (automatic)
❌ Platform-specific protocol setup
❌ Kan blockeras av browser security

---

## 🎯 **REKOMMENDERAD LÖSNING - HYBRID APPROACH**

**Kombinera LÖSNING 1 + 2** för bästa resultat:

```typescript
// I App.tsx
const handleUpgradeClick = async () => {
  // 1. Öppna Stripe checkout
  window.open('http://localhost:3000/payments', '_blank');
  
  // 2. Starta payment detection
  startPaymentDetection();
};

const startPaymentDetection = () => {
  console.log('🔍 Starting payment detection...');
  
  let attempts = 0;
  const maxAttempts = 24; // 2 minuter (24 * 5s)
  
  const detectInterval = setInterval(async () => {
    attempts++;
    
    // Check file system first (fast)
    const fileStatus = await checkPaymentFile();
    if (fileStatus?.processed) {
      clearInterval(detectInterval);
      await authService.checkUserStatus();
      showPaymentSuccess(fileStatus.tier);
      return;
    }
    
    // Fallback: Direct server check
    const user = await authService.checkUserStatus();
    if (user && user.tier !== 'free') {
      clearInterval(detectInterval);
      showPaymentSuccess(user.tier);
      return;
    }
    
    // Timeout after max attempts
    if (attempts >= maxAttempts) {
      clearInterval(detectInterval);
      showPaymentTimeout();
    }
    
  }, 5000);
};

const showPaymentSuccess = (tier: string) => {
  alert(`🎉 Payment Successful!\n\nYou now have ${tier} access with all premium AI models!`);
};

const showPaymentTimeout = () => {
  alert('⏱️ Payment detection timed out.\n\nIf you completed payment, click the 🔄 button to refresh manually.');
};
```

**Denna hybrid-lösning**:
✅ **Snabb** - File system check först
✅ **Robust** - Server fallback om fil saknas  
✅ **User-friendly** - Automatisk detection + manual fallback
✅ **Enkel** - Minimal komplexitet
✅ **Reliable** - Fungerar även om webhook är långsam

---

## 🧪 **DEBUG PLAN - Steg för steg**

### **STEG 1: Verifiera Webhook**
```bash
# Kolla Stripe Dashboard → Webhooks → Logs
# Ser du 'checkout.session.completed' events?
# Är webhook URL korrekt: http://localhost:3001/api/webhooks/stripe
```

### **STEG 2: Testa Webhook Manually**
```bash
# I backend console, lägg till:
console.log('🎯 WEBHOOK EVENT RECEIVED:', event.type);
console.log('🎯 USER ID FROM SESSION:', session.client_reference_id);
```

### **STEG 3: Verifiera Database Update**
```bash
# Efter webhook, kolla backend/data/users.json
# Har user tier uppdaterats från 'free' till 'premium'?
```

### **STEG 4: Testa Status Check**  
```bash
# I appen, klicka 🔄 button och kolla console
# Ser du API request till /api/check-status?
# Returnerar det uppdaterad tier?
```

### **STEG 5: Implementera Rekommenderad Lösning**
```bash
# Om alla ovan fungerar men timing är problemet
# Implementera hybrid payment detection
```

Detta kommer att lösa problemet systematiskt! 🚀 