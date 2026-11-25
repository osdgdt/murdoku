"""Lancia un programma del lettore da QUALSIASI cartella (anche da quella delle foto):

    python C:\...\murdoku-app\ml\run.py review --dati Murdoku1 8766
    python C:\...\murdoku-app\ml\run.py batch 1-80 --workers 4 --dati Murdoku1

Equivale a `python -m reader.review …` lanciato da `ml/`, ma non serve spostarsi in `ml/`.
"""

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    from reader import config

    module = sys.argv[1]
    sys.argv = [module] + sys.argv[2:]
    try:
        importlib.import_module("reader." + module).main()
    except config.ConfigError as error:
        sys.exit(f"Errore: {error}")
