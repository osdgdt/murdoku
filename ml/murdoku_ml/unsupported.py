"""Gli elementi dei Murdoku stampati che l'app (e il suo solver) non rappresentano ancora.

Un caso che ne usa uno non entra nel dataset: nel suo record resta con il codice e il motivo. L'elenco dei codici usati è la base
per decidere, a foto finite, cosa estendere nell'app e nel solver (non si estende nulla prima).
"""

from __future__ import annotations

# codice -> (descrizione, dove l'abbiamo visto)
UNSUPPORTED: dict[str, tuple[str, str]] = {
    "hidden_roles": (
        "Ruoli nascosti da scoprire: alcuni personaggi hanno «ruolo sconosciuto» e gli indizi parlano di ruoli (l'Acrobata, il Lanciatore di coltelli…). "
        "L'app ora li rappresenta (nobili, fuorilegge, mansioni: `puzzle.roles`) ma il lettore non li legge ancora: né i ruoli, né i conteggi, né gli indizi sui ruoli",
        "caso 75 «Al circo»",
    ),
    # (ora c'è: l'indizio «È accanto a un muro», che la grammatica legge; il codice resta per i record già salvati)
    "not_next_to_wall": ("«Non era accanto a un muro» (ora l'app lo rappresenta)", "caso 4 «Quattro finestre»"),
    "relative_empty_column": (
        "«La colonna direttamente a est/ovest di lei/lui era vuota» (colonna vuota relativa a chi parla)",
        "caso 75",
    ),
    "object_columns": ("Indizi sulle colonne che contengono un oggetto («tutte le altre colonne con un barile erano vuote»)", "caso 75"),
    "animals": ("Animali che l'app non ha ancora (leone, pecora…): cavallo, mucca, cinghiale, tigre, maiale e squalo ci sono", "caso 75"),
    "parrot": (
        "Il pappagallo dei Pirati: ripete l'indizio di un altro sospettato (da dedurre chi). L'app non lo rappresenta ancora: "
        "serve prima una pagina d'esempio per fissare il significato",
        "Pirati",
    ),
    "non_square_grid": ("Griglia non quadrata (più colonne che righe, con colonne vuote)", "caso 75: 9 righe × 12 colonne"),
    "unknown_clue": ("Frase di un indizio che la grammatica non sa ancora convertire", "da guardare caso per caso"),
}


def describe(code: str) -> str:
    text, seen = UNSUPPORTED.get(code, ("codice sconosciuto", ""))
    return f"{text} ({seen})" if seen else text
