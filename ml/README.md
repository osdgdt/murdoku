# Una rete neurale che genera Murdoku

Progetto in passi (il contesto per riprendere il lavoro, le decisioni e cosa hanno insegnato le foto sono in `CONTESTO.md`; qui il riassunto operativo):

1. **Scheletro, giudice e formato dei dati** ← questa cartella (`murdoku_ml/`, `FORMATO.md`)
2. Lettore: foto → caso (`reader/`)
3. Pagina di correzione nell'app
4. Formato testo, trasformazioni e generatore sintetico
5. Addestramento (notebook Colab, LoRA su un modello piccolo)
6. Generazione con scarto dei casi non validi + pagina stampabile

## Dove stanno i dati

**Fuori dal repository.** Foto e record (le pagine sono di un libro) stanno in una cartella locale o su Drive; il codice la trova con
la variabile d'ambiente `MURDOKU_DATA`. Nel repository ci sono solo il codice e casi di prova **inventati**
(`tests/fixtures/`).

## Come si provano le cose

```bash
pip install -r ml/requirements.txt        # e: apt install tesseract-ocr tesseract-ocr-ita
npm run ml:test                            # i test di Python (serve Node: il giudice è il solver dell'app)
```

Su Windows: Tesseract con la lingua italiana (`tesseract --list-langs` deve mostrare `ita`), Node ≥ 20 nel PATH, un ambiente virtuale
Python (`python -m venv ...`), poi `python -m pytest ml -q` (al posto di `npm run ml:test`, che chiama `python3`).

Il lettore (dalla cartella `ml/`, con `MURDOKU_DATA` sulla cartella delle foto):

```bash
python -m reader.inventory 4        # classifica le foto e abbina i casi → MURDOKU_DATA/lavoro/manifest.json (4 processi)
python -m reader.pipeline 1-20      # legge i casi 1-20 → MURDOKU_DATA/lavoro/record/NNN.record.json
python -m reader.solution learn 1 3 # impara i colori delle pedine da casi con posizioni note (bozze corrette)
python -m reader.batch 1-80 --workers 4   # le bozze di molti casi (griglia, schede, soluzione, solver) + tabella lavoro/batch.json
python -m reader.solution autolearn # colori delle pedine di QUESTO volume, dalle bozze (lavoro/pawn_colors.json)
python -m reader.review             # pagina di correzione su http://127.0.0.1:8765 (foto + dati modificabili + solver)
python ml/run.py review --dati Murdoku1 8766   # da QUALSIASI cartella (run.py); --dati/--data valgono solo per quel comando
python -m reader.review --dati Murdoku1 8766   # lo stesso su un altro volume (cartella sorella di MURDOKU_DATA o percorso), senza cambiare la variabile; vale anche per reader.batch
python -m reader.review --lan              # anche dal telefono (stessa rete Wi-Fi): stampa un link con un codice segreto, diverso a ogni avvio; la pagina ha tocco, pizzico per ingrandire la foto e tasto «foto» a tutto schermo
```

### Le parole degli indizi (la tua grammatica)

La frase di ogni scheda si scrive come si preferisce («Era sul tappeto», «Si trovava sul tappeto», «Stava sulla panca»…): il programma
capisce già i verbi più comuni, «sul/sullo/sulla/sull'…», «sopra», «seduto/sdraiato», il «non» davanti. Per quello che non capisce si
**aggiunge** una grammatica personale, per quel libro, in `grammatica.json` nella cartella dei dati (accanto alle foto):

```bash
python ml/run.py frase --esempio --dati Murdoku1     # crea un grammatica.json d'esempio (non sovrascrive)
python ml/run.py frase "Si trovava sul tappeto" --dati Murdoku1   # prova una frase: cosa ha capito e che testo avrebbe nel gioco
```

```json
{
  "testo_indizi": "mio",
  "oggetti": { "pagliericcio": "pallet" },
  "verbi": ["si accomodava"],
  "frasi": [
    { "se": "riposava sul {oggetto}", "indizio": "onObjectType" },
    { "se": "stava a {direzione} di {persona}", "indizio": "directionDistance" },
    { "se": "dormiva", "indizio": "onObjectType", "parametri": { "objectTypeId": "bed" } }
  ]
}
```

- `oggetti`: parola del libro → tipo di oggetto dell'app; `verbi`: altri modi di cominciare una frase; `frasi`: una frase intera con dei buchi
  (`{oggetto} {persona} {stanza} {direzione} {n}`) → tipo di indizio (`parametri` per i valori fissi). Un «non» davanti inverte l'indizio.
  Le frasi personali si provano **per prime**; un buco che non si capisce (una persona che non c'è) non indovina: la frase resta «non capita».
- `testo_indizi`: **«mio»** = nel gioco l'indizio mostra le **tue parole** (la frase scritta nella scheda, una per ogni «e»: il campo `text`
  dell'indizio nell'app); «automatico» (predefinito) = le sceglie l'app. Nella pagina di correzione c'è la casella «Nel gioco gli indizi usano
  le mie parole» (per caso) e sotto ogni indizio capito si vede il testo che avrà. Il file si rilegge da solo: modificalo e ricarica la scheda.

Il solver, il solver umano e i controlli dei casi sono in JavaScript e non si riscrivono: `murdoku_ml/validate.py` li chiama
come sottoprocesso (`tools/ml-validate.mjs`).
