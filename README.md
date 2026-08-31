# Gestionale Assunzioni

Gestionale web per la gestione delle assunzioni aziendali: anagrafica candidati/dipendenti (anche su più società), checklist di onboarding, calendario operativo, buste paga e bonifici mensili.

## Funzionalità

- **Aziende**: gestisci più società, ogni persona può essere assegnata a un'azienda specifica.
- **Anagrafica**: candidati, dipendenti in onboarding, attivi e cessati. Documenti allegabili (CV, contratto, documenti identità...).
- **Checklist**: lista di attività di onboarding per ogni assunzione (creata automaticamente, personalizzabile).
- **Calendario operativo**: colloqui, inizio contratti, scadenze.
- **Buste paga & bonifici**: registrazione mensile di importi, stato pagamento e caricamento del PDF della busta paga.
- **Login** protetto da password (singolo utente amministratore).

## Requisiti

- Node.js 22.5 o superiore (usa il modulo nativo `node:sqlite`, nessuna dipendenza da compilare).

## Avvio in locale

```bash
npm install
cp .env.example .env
```

Modifica `.env` con le tue credenziali:

```
PORT=3000
SESSION_SECRET=una-stringa-lunga-e-casuale
ADMIN_USERNAME=admin
ADMIN_PASSWORD=scegli-una-password-sicura
```

Poi avvia:

```bash
npm start
```

L'app sarà disponibile su `http://localhost:3000`. Al primo avvio viene creato automaticamente l'utente amministratore con le credenziali indicate in `.env`.

> Le credenziali admin vengono salvate nel database solo al primo avvio. Per cambiarle in seguito, modifica direttamente l'utente nella tabella `users` oppure cancella il file `data/gestionale.db` (perderai tutti i dati) e riavvia con le nuove variabili d'ambiente.

## Dati salvati

- `data/gestionale.db` — database SQLite con tutti i dati (aziende, persone, checklist, eventi, buste paga).
- `uploads/documenti/` — documenti caricati per candidati/dipendenti.
- `uploads/buste_paga/` — PDF delle buste paga.

Questi percorsi vanno **conservati/backuppati** quando ospiti l'app: sono l'unica copia dei dati.

## Come hostarlo online

Qualsiasi hosting che supporti Node.js va bene. Alcune opzioni semplici:

### Render / Railway (consigliato, gratis per iniziare)
1. Carica il progetto su un repository GitHub (privato, contiene dati aziendali sensibili).
2. Crea un nuovo "Web Service" collegato al repository.
3. Comando di build: `npm install` — comando di avvio: `npm start`.
4. Imposta le variabili d'ambiente (`SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`) nel pannello del servizio.
5. **Importante**: aggiungi un "persistent disk"/volume montato su `/data` e `/uploads` (o l'intera working directory), altrimenti i dati vengono persi ad ogni deploy. Su Render questo si chiama "Disk".

### VPS proprio (es. Hetzner, DigitalOcean)
1. Installa Node.js 22+.
2. Copia il progetto sul server, esegui `npm install --omit=dev` e `npm start` (meglio con un process manager come `pm2` per farlo ripartire in automatico).
3. Metti un reverse proxy (Nginx/Caddy) davanti con HTTPS (es. Caddy con certificato automatico).

### Note di sicurezza per la produzione
- Cambia sempre `SESSION_SECRET` e la password admin rispetto ai valori di esempio.
- Servi l'app sempre dietro HTTPS: le credenziali viaggiano in chiaro su HTTP.
- Fai backup regolari di `data/gestionale.db` e della cartella `uploads/` (contengono documenti e buste paga).
