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

Il solver, il solver umano e i controlli dei casi sono in JavaScript e non si riscrivono: `murdoku_ml/validate.py` li chiama
come sottoprocesso (`tools/ml-validate.mjs`).
