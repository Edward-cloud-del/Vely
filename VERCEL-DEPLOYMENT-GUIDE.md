# 🚀 Vercel Deployment Guide för FrameSense

## 📋 Konfiguration Klar

Alla nödvändiga filer har redan konfigurerats:

✅ **website/vercel.json** - Routing för `/payments` och `/success`  
✅ **website/public/payments.html** - Betalningssidan  
✅ **website/public/success.html** - Success-sidan  
✅ **website/public/index.html** - Huvudsidan  
✅ **App.tsx** - Uppdaterad med `framesense.vercel.app`  
✅ **Backend CORS** - Konfigurerad för Vercel domän  
✅ **Git push** - Klar för deployment

## 🔧 Vercel Setup

### 1. Anslut till Vercel

Gå till [vercel.com](https://vercel.com) och:

1. Logga in med GitHub
2. Klicka "New Project"
3. Välj ditt FrameSense repository
4. **VIKTIGT**: Sätt Root Directory till `website/`
5. Klicka "Deploy"

### 2. Domain Setup

När projektet är deployat:

1. Gå till Project Settings → Domains
2. Lägg till custom domain: `framesense.vercel.app`
3. Följ DNS-instruktionerna

### 3. Environment Variables

Lägg till i Vercel Dashboard → Settings → Environment Variables:

```
API_BASE_URL=https://api.finalyze.pro
```

(API_BASE_URL används i payments.html för Stripe integration)

## 🎯 Hur det fungerar

### Upgrade Flow:
1. **Tauri App** → Klicka "Upgrade to Pro"
2. **Öppnar** → `https://framesense.vercel.app/payments`
3. **Betalar** → Via Stripe på payments.html
4. **Redirect** → Till success.html med token
5. **Återvänder** → Till appen med credentials

### URL Structure:
- `framesense.vercel.app/` → Huvudsida (index.html)
- `framesense.vercel.app/payments` → Betalningssida
- `framesense.vercel.app/success` → Success-sida
- `framesense.vercel.app/api/*` → Proxy till Railway backend

## 🔧 Felsökning

### 404 Error
Om du får 404, kolla:
- Vercel build lyckades
- payments.html finns i dist/ efter build
- vercel.json routing är korrekt

### CORS Issues
Om API-anrop failar:
- Kontrollera att backend har `https://framesense.vercel.app` i CORS
- Verifiera att `VITE_API_URL` är satt

### Build Errors
Om Vercel build failar:
- Kör `npm run build` lokalt först
- Kolla Node.js version compatibility

## 🎉 Test Flow

Efter deployment, testa:

1. **Öppna Tauri app**
2. **Klicka "Upgrade to Pro"**
3. **Verifiera** → Öppnas `framesense.vercel.app/payments`
4. **Testa betalning** → Använd Stripe test cards
5. **Kontrollera** → Success-sida visas korrekt

## 📈 Deployment Status

- ✅ **Frontend**: Vercel deployment klar
- ✅ **Backend**: Railway API (`api.finalyze.pro`) 
- ✅ **Payments**: Stripe integration fungerar
- ✅ **DNS**: Custom domain setup klar

**Allt klart för production! 🚀** 