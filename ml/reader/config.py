"""Percorsi e programmi esterni. Le foto sono pagine di un libro: stanno FUORI dal repository (variabile `MURDOKU_DATA`)."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

_TESSERACT_WINDOWS = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")


class ConfigError(RuntimeError):
    pass


def data_dir() -> Path:
    """La cartella dei dati (foto + lavoro). Variabile d'ambiente `MURDOKU_DATA`."""
    value = os.environ.get("MURDOKU_DATA")
    if not value:
        raise ConfigError("Imposta la variabile d'ambiente MURDOKU_DATA sulla cartella con le foto (fuori dal repository).")
    path = Path(value)
    if not path.is_dir():
        raise ConfigError(f"MURDOKU_DATA non è una cartella: {path}")
    return path


def take_data_option(argv: list[str]) -> list[str]:
    """Toglie da `argv` l'opzione `--dati CARTELLA` e la usa per QUESTO programma, senza toccare la variabile d'ambiente del sistema.

    `CARTELLA` può essere un percorso, oppure il nome di una cartella sorella di quella in `MURDOKU_DATA` (`--dati Murdoku1`)."""
    argv = [a for a in argv]
    for k, a in enumerate(argv):  # anche --dati=Murdoku1 e --data
        if a.startswith(("--dati=", "--data=")):
            argv[k : k + 1] = [a.split("=", 1)[0], a.split("=", 1)[1]]
            break
    option = next((o for o in ("--dati", "--data") if o in argv), None)
    if option is None:
        return argv
    k = argv.index(option)
    if k + 1 >= len(argv):
        raise ConfigError(f"{option} vuole una cartella: {option} Murdoku1  oppure  {option} C:\percorso\Murdoku1")
    value = argv[k + 1]
    path = Path(value)
    current = os.environ.get("MURDOKU_DATA")
    candidates = [path]
    if current:
        candidates.append(Path(current).parent / value)  # cartella sorella di quella in MURDOKU_DATA
    candidates.append(Path.cwd().parent / value)  # o sorella della cartella da cui si lancia
    path = next((c for c in candidates if c.is_dir()), path)
    if not path.is_dir():
        raise ConfigError(f"{option}: non trovo la cartella «{value}» (provata anche accanto a MURDOKU_DATA)")
    os.environ["MURDOKU_DATA"] = str(path)
    return argv[:k] + argv[k + 2 :]


def work_dir() -> Path:
    """Dove il lettore scrive cache, manifest e record: una sottocartella della cartella dei dati."""
    path = data_dir() / "lavoro"
    path.mkdir(exist_ok=True)
    return path


def tesseract_cmd() -> str:
    found = shutil.which("tesseract")
    if found:
        return found
    if _TESSERACT_WINDOWS.exists():
        return str(_TESSERACT_WINDOWS)
    raise ConfigError("Tesseract non trovato: installalo con la lingua italiana (ita).")


def setup_tesseract():
    try:
        import pytesseract
    except ValueError:  # pandas installato ma incompatibile con numpy: pytesseract lo usa solo per image_to_data(output_type=DATAFRAME)
        import sys

        for name in [n for n in sys.modules if n == "pandas" or n.startswith("pandas.")]:
            del sys.modules[name]
        sys.modules["pandas"] = None  # fa fallire l'import di pandas con ImportError, che pytesseract sa gestire
        import pytesseract

    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd()
    os.environ.setdefault("OMP_THREAD_LIMIT", "1")  # un solo thread per processo: si parallelizza sulle foto
    return pytesseract


def photos() -> list[Path]:
    """Le foto in ordine di scatto (il nome è data_ora)."""
    return sorted(data_dir().glob("*.jpg"))
