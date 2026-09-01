# Gestionale Assunzioni

Gestionale web per la gestione delle assunzioni aziendali: anagrafica candidati/dipendenti (anche su più società), checklist di onboarding, calendario operativo, buste paga e bonifici mensili.

## Funzionalità

- **Aziende**: gestisci più società, ogni persona può essere assegnata a un'azienda specifica.
- **Anagrafica**: candidati, dipendenti in onboarding, attivi e cessati. Documenti allegabili (CV, contratto, documenti identità...).
- **Checklist**: lista di attività di onboarding per ogni assunzione (creata automaticamente, personalizzabile).
- **Calendario operativo**: colloqui, inizio contratti, scadenze.
- **Buste paga & bonifici**: registrazione mensile di importi, stato pagamento e caricamento del PDF della busta paga.
- **Login** protetto da password (singolo utente amministratore).

## Come sono salvati i dati

Tutto — anagrafica, checklist, eventi, buste paga e i file caricati (documenti, PDF) — è salvato in un **database Postgres**, tipicamente [Supabase](https://supabase.com) (gratuito). Non viene scritto nulla sul filesystem del server: questo è importante perché molti hosting gratuiti (Render, Railway free tier, Vercel...) hanno un filesystem "effimero" che si azzera ad ogni riavvio/redeploy. Con Postgres esterno i dati restano al sicuro qualunque cosa succeda al server web.

## Requisiti

- Node.js 18 o superiore.
- Un database Postgres. Il modo più semplice è creare un progetto gratuito su [supabase.com](https://supabase.com).

## Configurare Supabase (una tantum)

1. Crea un account su [supabase.com](https://supabase.com) e un nuovo progetto (scegli una password del database e conservala).
2. Vai su **Project Settings → Database → Connection string**.
3. Copia la stringa **"Connection pooling"** (modalità *Session*, porta `5432`, oppure *Transaction*, porta `6543`) — è quella compatibile anche con hosting che non supportano IPv6 come Render.
4. Sostituisci `[YOUR-PASSWORD]` nella stringa con la password del database scelta al punto 1.

Il risultato è qualcosa tipo:
```
postgresql://postgres.xxxxxxxx:LaTuaPassword@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

Questa stringa va messa nella variabile `DATABASE_URL`.

## Avvio in locale

```bash
npm install
cp .env.example .env
```

Modifica `.env` con i tuoi valori:

```
PORT=3000
SESSION_SECRET=una-stringa-lunga-e-casuale
ADMIN_USERNAME=admin
ADMIN_PASSWORD=scegli-una-password-sicura
DATABASE_URL=postgresql://...   # la stringa di Supabase
```

Poi avvia:

```bash
npm start
```

L'app sarà disponibile su `http://localhost:3000`. Al primo avvio vengono creati automaticamente le tabelle nel database, l'utente amministratore e un'azienda di default, usando le variabili di `.env`.

> Le credenziali admin vengono create nel database **solo la prima volta** che il database è vuoto. Per cambiarle in seguito, modifica la password direttamente nella tabella `users` di Supabase (usando l'SQL Editor) oppure svuota quella tabella e riavvia l'app con le nuove variabili.

## Come hostarlo online (es. Render, gratis)

1. Carica il progetto su un repository GitHub (privato, contiene dati aziendali sensibili).
2. Vai su [render.com](https://render.com) → **New + → Web Service** → collega il repository.
3. Configurazione:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Nella sezione **Environment**, imposta le variabili d'ambiente:
   - `SESSION_SECRET` → una stringa lunga e casuale
   - `ADMIN_USERNAME` → il tuo utente
   - `ADMIN_PASSWORD` → una password sicura
   - `DATABASE_URL` → la stringa di connessione Supabase (vedi sopra)
5. **Create Web Service** → il deploy parte da solo, in 2-3 minuti l'app è online.

Non serve **nessun disco persistente**: essendo tutto su Postgres/Supabase, i dati sopravvivono a riavvii, redeploy e al risveglio dal "sleep" del piano gratuito.

### Note di sicurezza per la produzione
- Cambia sempre `SESSION_SECRET` e la password admin rispetto ai valori di esempio.
- Servi l'app sempre dietro HTTPS (Render lo fa automaticamente).
- Il piano gratuito di Supabase mette in pausa il database dopo un periodo di inattività prolungato: la prima richiesta dopo la pausa può risultare più lenta mentre si "risveglia", ma i dati non vengono persi.
