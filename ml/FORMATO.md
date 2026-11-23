# Formato dei dati

Tutto quello che passa nella pipeline è un **record**, un file JSON per caso (`NNN.record.json`) nella cartella dei dati, che sta
**fuori dal repository** (variabile d'ambiente `MURDOKU_DATA`). Il caso vero e proprio è nel formato `.murdoku.json` dell'app, così
l'editor, il solver e `npm run check:case` lo capiscono senza conversioni.

```json
{
  "format": "murdoku-ml-case",
  "version": 1,
  "source": {
    "number": 2,
    "title": "Casa vacanze",
    "tagline": "Qualcuno perderà la cauzione del suo B&B…",
    "pages": { "personaggi": "caso-002/personaggi.jpg", "mappa": "caso-002/mappa.jpg", "passaggi": "caso-002/passaggi.jpg" }
  },
  "puzzle": { "...": "il caso nel formato .murdoku.json dell'app" },
  "printed": {
    "culprit": "Arianna",
    "placements": [{ "name": "Arianna", "row": 5, "col": 1 }],
    "steps": ["Possiamo isolare B sulla sedia, e D nella riga 3, colonna 6.", "…"]
  },
  "extraction": {
    "status": "ok",
    "issues": ["il nome del personaggio C è incerto (OCR 61%)"],
    "report": { "...": "il rapporto di tools/ml-validate.mjs" }
  },
  "unsupported": []
}
```

| Campo | Significato |
|---|---|
| `source` | Da dove viene: numero del caso, titolo, sottotitolo, le foto (percorsi relativi alla cartella dei dati) |
| `puzzle` | Il caso come lo legge l'app. `null` se non si è riusciti a ricostruirlo |
| `printed` | Quello che dice il libro: colpevole, soluzione (righe e colonne **da 0**), passaggi logici in italiano |
| `extraction.status` | `incerto` (da guardare), `ok` (il solver dice: soluzione unica uguale alla stampata), `scartato`, `verificato` (guardato dall'autore nella pagina di correzione) |
| `extraction.report` | Il rapporto del giudice (`tools/ml-validate.mjs`): unicità, soluzione, colpevole, livello del solver umano |
| `unsupported` | Codici degli elementi del caso che l'app non rappresenta (`murdoku_ml/unsupported.py`). Un caso con codici non entra nel dataset |

Regole: lettere dei personaggi = ordine alfabetico dei nomi (V = vittima); la vittima è l'ultima; un oggetto che nel libro occupa
due caselle (il letto) sono due oggetti dell'app.

## Il giudice

`node tools/ml-validate.mjs < input.json > rapporto.json`, o da Python `murdoku_ml.validate.validate_case(puzzle, printed)`.
Ingresso: `{ "puzzle": …, "printed": { "placements": [{ "name", "row", "col" }] } }`. Uscita: `ok`, `stage` (`shape` | `search` |
`done`), `problems`, `solutionCount`, `unique`, `solution`, `matchesPrinted`, `mismatches`, `culprit`, `human`, `declared`.
`ok` è vero solo per un caso valido con **una** soluzione che, se la si dà, è quella stampata.
