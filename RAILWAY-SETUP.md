# 🚀 Railway Setup Guide för FrameSense

## 📋 **Steg för att konfigurera Railway med PostgreSQL**

### **1. Lägg till PostgreSQL på Railway**

1. Gå till din Railway dashboard
2. Klicka på ditt projekt
3. Klicka "New" → "Database" → "PostgreSQL"
4. Railway kommer automatiskt att skapa databasen

### **2. Konfigurera miljövariabler på Railway**

I din backend-app på Railway, lägg till dessa miljövariabler:

```env
# Railway PostgreSQL (automatiskt genererat)
DATABASE_URL=postgresql://postgres:SlBzlcadKqxWpKgCLhkGYzUgaxPpBzrP@your-railway-domain:5432/railway

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# OpenAI API
OPENAI_API_KEY=sk-proj-1234567890abcdef

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Server Configuration
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
```

### **3. Kör databasschemat**

1. Gå till din PostgreSQL-databas på Railway
2. Klicka på "Connect" → "Query"
3. Kopiera innehållet från `backend/railway-setup.sql`
4. Kör SQL-koden

### **4. Railway kommer automatiskt att:**

- ✅ Deploya din kod från GitHub
- ✅ Starta om appen med nya miljövariabler
- ✅ Ansluta till PostgreSQL via `DATABASE_URL`
- ✅ Hantera SSL-anslutningar för produktion

### **5. Testa anslutningen**

När Railway har deployat, testa att backend fungerar:

```bash
curl https://api.finalyze.pro/health
```

Du ska få svar:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-12T...",
  "service": "FrameSense API"
}
```

### **6. Testa registrering**

Testa att registrera en användare:

```bash
curl -X POST https://api.finalyze.pro/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}'
```

## 🔧 **Felsökning**

### **Problem: Database connection failed**
- Kontrollera att `DATABASE_URL` är korrekt i Railway
- Kontrollera att PostgreSQL-databasen är igång
- Kontrollera att schemat har körts

### **Problem: 400 Bad Request**
- Kontrollera att alla miljövariabler är satta
- Kontrollera att JWT_SECRET är satt
- Kontrollera att OpenAI API key är giltig

### **Problem: CORS errors**
- Kontrollera att FRONTEND_URL är korrekt
- Kontrollera att CORS-konfigurationen i `server.ts` inkluderar din frontend-domain

## 📊 **Railway Miljövariabler**

Railway kommer automatiskt att generera dessa variabler för PostgreSQL:

```env
DATABASE_URL=postgresql://postgres:password@domain:5432/railway
PGDATABASE=railway
PGHOST=domain
PGPASSWORD=password
PGPORT=5432
PGUSER=postgres
```

Backend-koden kommer automatiskt att använda `DATABASE_URL` om den finns, annars fallback till individuella variabler.

## ✅ **När allt är klart**

Din Railway backend på `api.finalyze.pro` kommer att:

- ✅ Använda PostgreSQL istället för JSON-filer
- ✅ Hantera användarregistrering och inloggning
- ✅ Spara användardata i Railway PostgreSQL
- ✅ Hantera Stripe-betalningar
- ✅ Automatiskt deploya från GitHub
- ✅ Skala automatiskt baserat på trafik 