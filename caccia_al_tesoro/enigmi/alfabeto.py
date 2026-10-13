"""Alfabeto italiano a 21 lettere (senza J, K, W, X, Y), usato da tutti i cifrari."""

ALFABETO = "ABCDEFGHILMNOPQRSTUVZ"
N = len(ALFABETO)


def sposta(testo, n):
    """Sposta ogni lettera di n posti nell'alfabeto (circolare). Gli altri caratteri restano uguali."""
    return "".join(ALFABETO[(ALFABETO.index(ch) + n) % N] if ch in ALFABETO else ch for ch in testo)


def valida_parola(parola):
    """Solo lettere dell'alfabeto italiano (spazi ammessi)."""
    mancanti = [ch for ch in parola if ch != " " and ch not in ALFABETO]
    if mancanti:
        raise ValueError(f"Lettere non supportate in '{parola}': {mancanti}")
    return parola
