"""Gli elementi dei Murdoku stampati che l'app (e il suo solver) non rappresentano ancora.

Un caso che ne usa uno non entra nel dataset: nel suo record resta con il codice e il motivo. L'elenco dei codici usati è la base
per decidere, a foto finite, cosa estendere nell'app e nel solver (non si estende nulla prima).
"""

from __future__ import annotations

# codice -> (descrizione, dove l'abbiamo visto)
UNSUPPORTED: dict[str, tuple[str, str]] = {
    "hidden_roles": (
        "Ruoli nascosti da scoprire: alcuni personaggi hanno «ruolo sconosciuto» e gli indizi parlano di ruoli (l'Acrobata, il Lanciatore di coltelli…)",
        "caso 75 «Al circo»",
    ),
    "not_next_to_wall": ("«Non era accanto a un muro»", "caso 4 «Quattro finestre»"),
    "relative_empty_column": (
        "«La colonna direttamente a est/ovest di lei/lui era vuota» (colonna vuota relativa a chi parla)",
        "caso 75",
    ),
    "object_columns": ("Indizi sulle colonne che contengono un oggetto («tutte le altre colonne con un barile erano vuote»)", "caso 75"),
    "animals": ("Animali come oggetti: cavallo (si può occupare e ci si siede), leone (non si può occupare)", "caso 75"),
    "non_square_grid": ("Griglia non quadrata (più colonne che righe, con colonne vuote)", "caso 75: 9 righe × 12 colonne"),
    "unknown_clue": ("Frase di un indizio che la grammatica non sa ancora convertire", "da guardare caso per caso"),
}


def describe(code: str) -> str:
    text, seen = UNSUPPORTED.get(code, ("codice sconosciuto", ""))
    return f"{text} ({seen})" if seen else text
