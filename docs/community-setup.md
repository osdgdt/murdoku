# Database dei casi condivisi: cosa serve per metterlo online

Il sito è statico (GitHub Pages). Il **database dei casi** (pubblicare un caso, aprirlo con un codice, un link o un QR) usa
in più **Firestore** (già in uso per la sfida del giorno e le campagne) e **Cloud Functions** (nuove: sono loro a scrivere i
casi, dopo aver ricontrollato tutto). Le Cloud Functions richiedono il piano **Blaze** di Firebase, quindi alcune cose si
possono fare solo dalla console di Firebase / Google Cloud, da te. Questa pagina le elenca nell'ordine in cui farle.

Finché non le hai fatte il sito funziona come prima: il pulsante «🌐 Pubblica» dell'editor risponde «Qualcosa è andato storto»
quando prova a chiamare le funzioni, e `player.html?c=CODICE` dice che il caso non è disponibile. Non si rompe nient'altro.

## 1. Piano Blaze e tetto di spesa

1. Console Firebase → progetto `murdoku-61284` → **Utilizzo e fatturazione** → passa al piano **Blaze** (collega un conto di
   fatturazione).
2. Subito dopo, in Google Cloud → **Fatturazione → Budget e avvisi**: crea un **budget** (per esempio 5 €/mese) con avvisi
   al 50 %, 90 % e 100 % via email. Un budget **non ferma** la spesa da solo, ti avvisa: per un freno vero, le funzioni hanno
   già `maxInstances: 5` (`functions/index.js`), che limita quante istanze possono girare insieme.
3. Il livello gratuito di Blaze (2 milioni di chiamate di funzione e 50 000 letture di Firestore al giorno, a oggi) basta
   per molti utenti: il database dei casi legge al massimo 30 schede per pagina e non legge mai tutti i casi insieme.

## 2. Dove sta Firestore, e in che regione girano le funzioni

1. Console Firebase → **Firestore Database** → scheda **Dati**: in alto trovi la **posizione** del database (per esempio
   `eur3` o `europe-west1`, `nam5`, `us-central1`).
2. Le funzioni sono configurate per `europe-west1` (Belgio). Se il tuo Firestore è in Europa va bene. Se è altrove,
   cambia la regione **in due posti** (devono coincidere) e rilascia di nuovo:
   `functions/index.js` (costante `REGION`) e `src/community/config.js` (`FUNCTIONS_REGION`).

## 3. Un account di servizio per il rilascio automatico (GitHub Actions)

Il workflow `.github/workflows/deploy-backend.yml` pubblica funzioni, regole e indici a ogni cambiamento su `main`. Gli serve
una chiave:

1. Google Cloud → **IAM e amministrazione → Account di servizio** (progetto `murdoku-61284`) → **Crea account di servizio**,
   per esempio `github-deploy`.
2. Dagli questi ruoli: **Amministratore Firebase** (`roles/firebase.admin`), **Amministratore Cloud Functions**
   (`roles/cloudfunctions.admin`), **Utente account di servizio** (`roles/iam.serviceAccountUser`), **Amministratore
   Artifact Registry** (`roles/artifactregistry.admin`) e **Editor Cloud Build** (`roles/cloudbuild.builds.editor`).
   (Se il rilascio si ferma con «permission denied», il messaggio dice quale ruolo manca: aggiungilo.)
3. Dall'account → **Chiavi → Aggiungi chiave → Crea nuova chiave → JSON**: scarica il file.
4. GitHub → repository → **Settings → Secrets and variables → Actions → New repository secret**: nome
   `FIREBASE_SERVICE_ACCOUNT`, valore = **tutto il contenuto** del file JSON. Poi cancella il file scaricato dal tuo computer.
   **Il modo più sicuro per incollare la chiave** (copiare a mano un file di 2300 caratteri a volte rovina la chiave privata: a
   capo cambiati in spazi, un pezzo tagliato; il workflow ripara i danni di formato ma non i caratteri persi). Apri Cloud Shell
   (icona `>_` in alto a destra nella console Google Cloud) e incolla:
   ```bash
   gcloud iam service-accounts keys create /tmp/key.json --iam-account=github-deploy@murdoku-61284.iam.gserviceaccount.com
   base64 -w0 /tmp/key.json; echo
   rm /tmp/key.json
   ```
   Il comando stampa **una sola riga lunga** (circa 3140 caratteri): selezionala tutta, copiala e incollala come valore del
   segreto `FIREBASE_SERVICE_ACCOUNT` (il workflow accetta sia il file JSON sia questa riga in base64). Poi, in **Account di
   servizio → Chiavi**, elimina le chiavi più vecchie che non usi più.
   Se il passo «Check the service-account key» del workflow fallisce, il log dice cosa non va (chiave tagliata, di un altro
   progetto, rifiutata da Google): ripeti la creazione della chiave.
5. Abilita le API del progetto se non lo sono già (il primo rilascio ti dice quali): Cloud Functions, Cloud Build, Artifact
   Registry, Cloud Run.

Senza il segreto il workflow finisce in verde dicendo che non ha rilasciato niente: nessun danno.

## 4. Primo rilascio

Dopo aver fatto il merge della PR: GitHub → **Actions → Backend → Run workflow** (sull'ultimo `main`). Controlla che il
rilascio finisca bene e che in Firebase → **Functions** compaiano `publishCase`, `updateCase`, `withdrawCase`, `deleteCase`
(regione `europe-west1`) e che in **Firestore → Regole** ci sia la sezione «Shared cases».

In alternativa, dal tuo computer (serve Node 22 e `firebase login`):

```bash
npm ci --prefix test/rules && npm ci --prefix functions
test/rules/node_modules/.bin/firebase deploy --only functions,firestore:rules,firestore:indexes --project murdoku-61284
```

## 4 bis. Aggiornare il backend dopo una nuova tappa (Cloud Shell)

Ogni tappa che cambia le funzioni, le regole o gli indici richiede un nuovo rilascio. Da Cloud Shell (progetto
`murdoku-61284`), con il tuo account già collegato la prima volta:

```bash
cd ~/murdoku && git pull && nvm use 22 && npm ci --prefix test/rules && npm ci --prefix functions
test/rules/node_modules/.bin/firebase deploy --only functions,firestore:rules,firestore:indexes --project murdoku-61284
```

Se `firebase` risponde che non sei collegato, ripeti `test/rules/node_modules/.bin/firebase login --no-localhost`.
**Gli indici nuovi si costruiscono in qualche minuto**: finché non sono pronti l'elenco dei casi dice «L'elenco si sta
ancora preparando». Si controlla in Firebase → Firestore → Indici (stato «Abilitato»).

**Casi pubblicati prima dell'elenco** (tappa 1) non hanno ancora la visibilità né la mini-mappa, quindi non compaiono
nell'elenco: il loro autore apre il caso nell'editor, «🌐 Pubblica», «Pubblica le modifiche…» e conferma (anche senza
cambiare nulla): la scheda si completa e il caso entra nell'elenco, senza nuova revisione.

## 5. Limiti regolabili senza rilasciare (facoltativo)

Le funzioni leggono `config/limits` da Firestore (solo l'amministratore del progetto lo scrive dalla console). Valori di
default se il documento non c'è:

| campo | default | significato |
|---|---|---|
| `publishPerDay` | 5 | nuovi casi che un account può pubblicare al giorno |
| `updatePerDay` | 20 | nuove revisioni al giorno |
| `activeCasesMax` | 100 | casi online per account |
| `revisionsMax` | 50 | revisioni per caso |

## 6. Provare tutto in locale (senza toccare il progetto vero)

Servono Java e `npm ci --prefix test/rules && npm ci --prefix functions`:

```bash
REQUIRE_RULES=1 npm run test:rules          # le regole di Firestore, sull'emulatore
REQUIRE_FUNCTIONS=1 npm run test:functions  # le funzioni vere, con Auth + Firestore emulati
npm run e2e:community                       # editor e giocatore, con un Firebase finto che esegue gli stessi handler
```

## Come funziona, in breve

- **Chi può fare cosa.** Leggere un caso è libero, senza accedere. Pubblicare, aggiornare, ritirare o eliminare richiede
  l'accesso con Google, un nickname e (per pubblicare) aver risolto il caso almeno una volta. Il browser **non scrive mai**
  nella raccolta `cases`: le regole lo vietano, scrivono solo le funzioni.
- **Cosa controllano le funzioni** (con lo stesso codice del sito, `src/community/casePolicy.js`, copiato in `functions/shared/`
  a ogni rilascio da `tools/build-functions.mjs`): forma del caso, lunghezze dei testi, titolo, descrizione, lingua,
  difficoltà, licenza, soluzione completa, nessun duplicato (impronta del contenuto), 5 pubblicazioni al giorno e 100 casi
  attivi per account.
- **Cosa non controllano:** che la soluzione sia davvero unica (lo verifica l'editor nel browser dell'autore prima di
  pubblicare; la ri-verifica sul server è prevista in una tappa successiva) e che l'autore abbia davvero risolto il caso
  (si fida del riepilogo dei traguardi sincronizzato dall'app: è un filtro contro i casi buttati lì, non una garanzia).
- **Amministratore.** Le tappe successive aggiungeranno la pagina di moderazione: per usarla serve il tuo `uid` nella raccolta
  `admins` (come per il resto del progetto).
