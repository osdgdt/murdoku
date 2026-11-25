"""Grammatica degli indizi: frase italiana del libro → indizi dell'app (`src/model/clues/*.js`).

Gli indizi escono con riferimenti **simbolici**, che il montaggio (assemble) risolve negli id del caso:
    {"name": "Clemenza"}            un personaggio
    {"room": "Cucina"}              una stanza (nome come sulla mappa)
    {"object": "chair"}             un tipo di oggetto (come in `OBJECT_TYPES` di src/model/icons.js)

Una frase può dare più indizi («Era a sud di Clemenza e a est di Vilfredo» → due). Quello che la grammatica non conosce non viene
indovinato: finisce in `unknown`, e il caso passa in revisione (o in `unsupported` se la frase è di un tipo noto ma non supportato).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from . import config

# Nomi italiani degli oggetti del libro → tipo dell'app. Quello che non c'è (cavallo, giaciglio di paglia…) è «non supportato».
OBJECT_WORDS: dict[str, str] = {
    "sedia": "chair", "sedie": "chair", "sgabello": "stool", "sgabelli": "stool", "tavolo": "table", "tavoli": "table",
    "tappeto": "carpet", "tappeti": "carpet", "letto": "bed", "letti": "bed", "panca": "bench", "panche": "bench",
    "trono": "throne", "troni": "throne", "botte": "barrel", "botti": "barrel", "forziere": "chest", "forzieri": "chest",
    "camino": "fireplace", "camini": "fireplace", "incudine": "anvil", "incudini": "anvil", "altare": "altar", "altari": "altar",
    "statua": "statue", "statue": "statue", "armatura": "armor", "armature": "armor", "rastrelliera": "weapon_rack",
    "rastrelliere": "weapon_rack", "calderone": "cauldron", "calderoni": "cauldron", "pozzo": "well", "pozzi": "well",
    "carro": "cart", "carri": "cart", "sarcofago": "sarcophagus", "sarcofagi": "sarcophagus", "leggio": "lectern",
    "leggii": "lectern", "stendardo": "banner", "stendardi": "banner", "candelabro": "candelabrum", "candelabri": "candelabrum",
    "gabbia": "cage", "gabbie": "cage", "lapide": "gravestone", "sfera": "crystal_ball", "pianta": "plant", "piante": "plant",
    "scaffale": "shelf", "scaffali": "shelf", "lampada": "lamp", "lampade": "lamp", "giaciglio": "pallet", "giacigli": "pallet",
    "pelle": "bearskin", "finestra": "window", "finestre": "window", "porta": "door", "porte": "door", "televisore": "tv",
    # animali e oggetti all'aperto (Medioevo, Far West, Preistoria)
    "cavallo": "horse", "cavalli": "horse", "pozza": "mud", "pozze": "mud", "cinghiale": "boar", "cinghiali": "boar",
    "mucca": "cow", "mucche": "cow", "tigre": "tiger", "tigri": "tiger", "albero": "tree", "alberi": "tree", "vaso": "vase",
    "vasi": "vase", "fuoco": "fire", "ossa": "bones",
    # mare e isole (Pirati)
    "barile": "barrel", "barili": "barrel", "zattera": "raft", "zattere": "raft", "amaca": "hammock", "amache": "hammock",
    "sabbia": "sand", "cannone": "cannon", "cannoni": "cannon", "cassa": "crate", "casse": "crate", "maiale": "pig",
    "maiali": "pig", "squalo": "shark", "squali": "shark", "masso": "rock", "massi": "rock", "corda": "rope", "corde": "rope",
}
# «Un animale» (qualunque): categoria di oggetti dell'app (`objtype:#animal`).
CATEGORY_WORDS = {"animale": "#animal", "animali": "#animal"}
# Oggetti del libro che l'app non rappresenta.
UNSUPPORTED_OBJECT_WORDS = {"leone": "animals", "pecora": "animals", "pappagallo": "parrot", "pappagalli": "parrot"}

ORDINALS = {
    "prima": 1, "primo": 1, "seconda": 2, "secondo": 2, "terza": 3, "terzo": 3, "quarta": 4, "quarto": 4, "quinta": 5,
    "quinto": 5, "sesta": 6, "sesto": 6, "settima": 7, "settimo": 7, "ottava": 8, "ottavo": 8, "nona": 9, "nono": 9,
    "decima": 10, "decimo": 10, "ultima": -1, "ultimo": -1,
}
DIRECTIONS = {"nord": "north", "sud": "south", "est": "east", "ovest": "west"}
NUMBER_WORDS = {"una": 1, "un": 1, "uno": 1, "due": 2, "tre": 3, "quattro": 4, "cinque": 5, "sei": 6}

# Come comincia un indizio: «Era», «C'era», «Si trovava», «Stava»… (anche negato: «Non si trovava»). Il presente va bene uguale,
# perché chi corregge una frase a mano può scriverla come preferisce.
VERB = r"(?:si\s+trovava|si\s+trovano|si\s+trova|trovava|stava|stavano|era|erano|c'era|è|e')"
# «su», «sul», «sullo», «sulla», «sull'», «sui», «sugli», «sulle», «sopra (a/al…)»: la preposizione che porta a un oggetto.
ON = r"(?:sull'|sopra\s+(?:(?:a|al|allo|alla|ai|agli|alle|il|lo|la|i|gli|le)\s+|l')?|(?:su|sul|sullo|sulla|sui|sugli|sulle)(?![a-zà-ÿ]))\s*"
# Il modo di stare su un oggetto: seduto, sdraiato, disteso (per l'app è sempre «su un oggetto di quel tipo»).
POSTURE = r"(?:sedut[oa]|sdraiat[oa]|distes[oa]|appoggiat[oa])"


from . import config  # noqa: E402


# ------------------------------------------------------------------------------------------- grammatica personale
# `grammatica.json` nella cartella dei dati (accanto alle foto) AGGIUNGE parole e frasi a quelle del programma, per quel libro:
#   {
#     "testo_indizi": "mio",                          «mio»: nel gioco l'indizio porta le TUE parole; «automatico» (predefinito): le sceglie l'app
#     "oggetti": {"pagliericcio": "pallet"},          parola del libro → tipo di oggetto dell'app
#     "verbi": ["si accomodava"],                     altri modi di cominciare una frase («Era», «Si trovava»… ci sono già)
#     "frasi": [                                      una frase intera, con dei buchi, → un tipo di indizio
#       {"se": "si trovava sul {oggetto}", "indizio": "onObjectType"},
#       {"se": "stava a {direzione} di {persona}", "indizio": "directionDistance"},
#       {"se": "dormiva", "indizio": "onObjectType", "parametri": {"objectTypeId": "bed"}}
#     ]
#   }
# I buchi: {oggetto} {persona} {stanza} {direzione} {n}. Una frase con «non» davanti vale il contrario. Per un tipo che non ha buchi
# («è sul sigillo di Ra») si dà il valore fisso in "parametri".
CUSTOM_FILE = "grammatica.json"
_EMPTY: dict = {"oggetti": {}, "verbi": [], "frasi": [], "testo_indizi": "automatico"}
_custom_override: dict | None = None
_custom_cache: dict = {"key": None, "data": _EMPTY}
PLACEHOLDERS = {
    "oggetto": r"(?P<oggetto>[^,.]+?)",
    "persona": r"(?P<persona>[^,.]+?)",
    "stanza": r"(?P<stanza>[^,.]+?)",
    "direzione": r"(?P<direzione>nord|sud|est|ovest)",
    "n": r"(?P<n>\d+|due|tre|quattro|cinque|sei|una|un|uno)",
}
TARGET_TYPES = {"adjacent", "diagonal", "facing", "sameRoomAs", "aloneWithPerson", "directionDistance"}


def set_custom(data: dict | None) -> None:
    """Per i test: usa questa grammatica personale invece del file (None = torna al file)."""
    global _custom_override
    _custom_override = data


def _checked(data: object, where: str) -> dict:
    if not isinstance(data, dict):
        raise ValueError(f"{where}: deve essere un oggetto JSON {{…}}")
    out = {"oggetti": {}, "verbi": [], "frasi": [], "testo_indizi": "automatico"}
    for word, kind in (data.get("oggetti") or {}).items():
        if not isinstance(word, str) or not isinstance(kind, str):
            raise ValueError(f"{where}: «oggetti» associa una parola a un tipo di oggetto, per esempio \"pagliericcio\": \"pallet\"")
        out["oggetti"][word.lower().strip()] = kind
    out["verbi"] = [v.lower().strip() for v in (data.get("verbi") or []) if isinstance(v, str) and v.strip()]
    for rule in data.get("frasi") or []:
        if not isinstance(rule, dict) or not isinstance(rule.get("se"), str) or not isinstance(rule.get("indizio"), str):
            raise ValueError(f"{where}: ogni frase vuole \"se\" (la frase) e \"indizio\" (il tipo di indizio)")
        unknown = set(re.findall(r"\{(\w+)\}", rule["se"])) - set(PLACEHOLDERS)
        if unknown:
            raise ValueError(f"{where}: buco sconosciuto {{{sorted(unknown)[0]}}} in «{rule['se']}» (si usano oggetto, persona, stanza, direzione, n)")
        out["frasi"].append(rule)
    wording = data.get("testo_indizi", "automatico")
    if wording not in ("automatico", "mio"):
        raise ValueError(f"{where}: \"testo_indizi\" è «automatico» o «mio»")
    out["testo_indizi"] = wording
    return out


def custom() -> dict:
    """La grammatica personale del libro in uso (vuota se non c'è `grammatica.json`, o se la cartella dei dati non è impostata)."""
    if _custom_override is not None:
        return _checked(_custom_override, "grammatica")
    try:
        path = config.data_dir() / CUSTOM_FILE
    except config.ConfigError:
        return _EMPTY
    if not path.exists():
        return _EMPTY
    key = (str(path), path.stat().st_mtime_ns, path.stat().st_size)
    if _custom_cache["key"] != key:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError(f"{path.name} non è JSON valido ({error})") from error
        _custom_cache.update(key=key, data=_checked(data, path.name))
    return _custom_cache["data"]


def default_wording() -> str:
    return custom()["testo_indizi"]


def _object_words() -> dict[str, str]:
    return {**OBJECT_WORDS, **custom()["oggetti"]}


def _verb() -> str:
    """Il modo di cominciare una frase: quelli del programma più quelli aggiunti in `grammatica.json`."""
    extra = [r"\s+".join(re.escape(w) for w in v.split()) for v in custom()["verbi"]]
    return "(?:" + "|".join(extra) + "|" + VERB[3:] if extra else VERB


def _as_sentence(part: str) -> str:
    """Una parte di frase scritta da una persona, come testo dell'indizio: maiuscola all'inizio e il punto alla fine."""
    text = part.strip()
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    return text if text[-1] in ".!?" else text + "."


@dataclass
class Parsed:
    clues: list[dict] = field(default_factory=list)
    victim: bool = False
    unknown: list[str] = field(default_factory=list)  # pezzi di frase non riconosciuti
    unsupported: list[str] = field(default_factory=list)  # codici di murdoku_ml/unsupported.py


def _clean(text: str) -> str:
    text = text.replace("’", "'").replace("`", "'").replace("|", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text.strip(" .,;:")


def _object_in(text: str) -> tuple[str | None, str | None]:
    """(tipo dell'app, codice non supportato) per la prima parola-oggetto in `text`."""
    words = _object_words()
    for token in re.findall(r"[a-zà-ÿ']+", text.lower()):
        word = token.split("'")[-1] if "'" in token else token  # «un'amaca», «dell'albero»: la parola dopo l'apostrofo
        if word in UNSUPPORTED_OBJECT_WORDS:
            return None, UNSUPPORTED_OBJECT_WORDS[word]
        if word in words:
            return words[word], None
    return None, None


def _target(text: str, names: list[str]) -> dict | None:
    """Il bersaglio di «accanto a …»: un oggetto o un personaggio (nome conosciuto)."""
    text = text.strip()
    for name in names:
        if re.search(rf"\b{re.escape(name)}\b", text, re.IGNORECASE):
            return {"name": name}
    for word in re.findall(r"[a-zà-ÿ']+", text.lower()):
        if word in CATEGORY_WORDS:
            return {"object": CATEGORY_WORDS[word]}
    obj, _ = _object_in(text)
    if obj:
        return {"object": obj}
    return None


_LAST_FREE_CELL = re.compile(
    r"(?i)(?:nell'|nella\s+|nel\s+|in\s+|sull'|sulla\s+)?(?:l')?(?:ultima|unica)\s+casella\s+"
    r"(?:rimasta|rimasta\s+libera|libera|libera\s+rimasta|che\s+restava|che\s+rimaneva|restante|disponibile|vuota)\b"
    r"(?:\s+sulla\s+mappa|\s+della\s+griglia)?\s*[.,;]?\s*(?:sol[ao]\s+con\s+l'assassino\.?)?\s*\.?$"
)


def parse_sentence(sentence: str, names: list[str], rooms: list[str] | None = None) -> Parsed:
    """Interpreta la frase di un personaggio. `names`: i personaggi del caso; `rooms`: le stanze (nomi come sulla mappa)."""
    out = Parsed()
    rooms = rooms or []
    text = _clean(sentence)
    if not text:
        out.unknown.append("")
        return out

    # «La vittima.» è una riga a parte: non è un indizio, è il ruolo.
    if re.match(r"(?i)la vittima\b", text):
        out.victim = True
        text = _clean(re.sub(r"(?i)^la vittima\.?", "", text))
        if not text:
            return out

    # Si spezza ai punti e alle congiunzioni fra due predicati «Era … e a est di …».
    split = r"(?<=[a-zà-ÿ])\.\s+|\s+e\s+(?=(?:a|in|su|sul|sullo|sulla|sull'|sopra|nella|nello|nel|accanto|vicino|di|era|stava|si trovava|non)\b)"
    parts = [p for p in re.split(split, text) if p and p.strip()]
    for part in parts:
        before = len(out.clues)
        _parse_clause(_clean(part), names, rooms, out)
        for clue in out.clues[before:]:  # le parole con cui la persona l'ha scritta: l'app può usarle come testo dell'indizio
            clue.setdefault("source", _as_sentence(_clean(part)))
    return out


def _clause(type_: str, params: dict, negate: bool = False) -> dict:
    clue = {"type": type_, "params": params}
    if negate:
        clue["negate"] = True
    return clue


def _parse_clause(text: str, names: list[str], rooms: list[str], out: Parsed) -> None:
    low = text.lower()
    if _custom_clause(text, names, rooms, out):
        return
    verb = _verb()
    negate = bool(re.match(rf"(?i)non\s+{verb}\b", text))
    body = re.sub(rf"(?i)^(?:non\s+)?{verb}\s+", "", text).strip()
    low = body.lower()

    # solo con l'assassino: regola base della vittima, già nel solver
    if re.match(r"(?i)solo con l'assassino", body):
        out.victim = True
        return

    # «Era nell'ultima casella rimasta/libera»: è la frase fissa della scheda della vittima (l'ultima casella libera è dove la
    # soluzione la mette), non un indizio. Anche con «, sola con l'assassino» dopo, o con «la casella libera rimasta».
    if _LAST_FREE_CELL.match(body):
        out.victim = True
        return

    # «Era sola/solo.» = unica persona nella stanza; «Non era sola» = il contrario; «Era sola con Bors» = nella stanza solo con lui
    if re.fullmatch(r"(?i)(?:sola|solo)", body):
        out.clues.append(_clause("aloneInRoom", {}, negate))
        return
    m = re.match(r"(?i)(?:sola|solo)\s+con\s+(.+)", body)
    if m:
        target = _target(m.group(1), names)
        if target and "name" in target:
            out.clues.append(_clause("aloneWithPerson", {"target": target}, negate))
        else:
            out.unknown.append(text)
        return

    # Mare e terra (Pirati): «in mare» = su una nave o nell'Acqua, «a terra» = ogni altro posto, «su una nave» = su una qualsiasi nave.
    if re.fullmatch(r"(?i)in mare", body):
        out.clues.append(_clause("inSea", {}, negate))
        return
    if re.fullmatch(r"(?i)a terra", body):
        out.clues.append(_clause("inSea", {}, not negate))
        return
    if re.fullmatch(r"(?i)(?:su|a bordo di|a bordo della|sopra)\s+(?:una|la|un'altra)\s+nave", body):
        out.clues.append(_clause("onShip", {}, negate))
        return

    # «O»: due alternative di indizi semplici («su una sedia o in sella a un cavallo»)
    if re.search(r"\so\s", low) and re.match(rf"(?i)(?:{POSTURE}|su|sul|sull'|sopra|in sella)", body):
        halves = re.split(r"\so\s", body, maxsplit=1)
        subs = []
        for half in halves:
            sub = Parsed()
            _parse_clause("Era " + half.strip(), names, rooms, sub)
            out.unknown += sub.unknown
            out.unsupported += sub.unsupported
            subs += sub.clues
        if len(subs) == 2:  # se una metà è sconosciuta o non supportata, l'indizio non c'è e il motivo è già registrato
            out.clues.append({"type": "orClue", "params": {"a": subs[0], "b": subs[1]}, **({"negate": True} if negate else {})})
        return

    # «Era l'unica persona seduta su una sedia / accanto a una finestra», «l'unica donna»: lei ha la caratteristica e nessun altro sulla mappa
    m = re.match(r"(?i)l'unic[oa]\s+(?:(uomo|donna)\b|persona\s+(.+))", body)
    if m:
        before = len(out.unsupported)
        prop = _only_one_property(m.group(1), m.group(2), names, rooms, out)
        if prop is not None:
            out.clues.append(_clause("onlyOneWithProperty", prop, negate))
        elif len(out.unsupported) == before:
            out.unknown.append(text)
        return

    m = re.match(rf"(?i)(?:{POSTURE}\s+)?{ON}(.+)", body)
    if m:
        obj, bad = _object_in(m.group(1))
        if bad:
            out.unsupported.append(bad)
        elif obj:
            out.clues.append(_clause("onObjectType", {"objectTypeId": obj}, negate))
        else:
            out.unknown.append(text)
        return
    m = re.match(r"(?i)in sella a(?:ll'|l|lla|llo|i|gli|lle)?\s*(.+)", body)
    if m:  # «in sella a un cavallo»: sul cavallo (solo il cavallo si cavalca)
        obj, bad = _object_in(m.group(1))
        if bad:
            out.unsupported.append(bad)
        elif obj:
            out.clues.append(_clause("onObjectType", {"objectTypeId": obj}, negate))
        else:
            out.unknown.append(text)
        return
    if re.fullmatch(r"(?i)sedut[oa]", body):
        out.clues.append(_clause("seated", {}, negate))
        return

    m = re.match(r"(?i)(?:accanto|vicino)\s+a(?:ll'|l|lla|llo|i|gli|lle)?\s*(.+)", body)
    if m:
        if re.search(r"(?i)\bmuro\b", m.group(1)):  # «accanto a un muro»: un lato della casella è parete
            out.clues.append(_clause("nextToWall", {}, negate))
            return
        target = _target(m.group(1), names)
        if target:
            out.clues.append(_clause("adjacent", {"target": target}, negate))
        elif _object_in(m.group(1))[1]:  # un oggetto che l'app non rappresenta (leone, pappagallo…)
            out.unsupported.append(_object_in(m.group(1))[1])
        else:
            out.unknown.append(text)
        return

    m = re.match(r"(?i)(?:a\s+)?(?:(\d+|due|tre|quattro|cinque)\s+(?:righe|colonne|caselle)\s+)?(?:a\s+)?(nord|sud|est|ovest)\s+di\s+(.+)", body)
    if m:
        distance = m.group(1)
        target = _target(m.group(3), names)
        if target:
            params = {"direction": DIRECTIONS[m.group(2).lower()], "target": target}
            if distance:
                params["distance"] = int(distance) if distance.isdigit() else NUMBER_WORDS[distance.lower()]
            out.clues.append(_clause("directionDistance", params, negate))
        else:
            out.unknown.append(text)
        return

    m = re.match(r"(?i)(?:nella|nel|in)\s+(?:la\s+)?(\w+)\s+(riga|colonna)", body) or re.match(r"(?i)(?:nella|nel|in)\s+(riga|colonna)\s+(\d+)", body)
    if m:
        a, b = m.group(1).lower(), m.group(2).lower()
        axis_word, index_word = (b, a) if b in ("riga", "colonna") else (a, b)
        index = ORDINALS.get(index_word) or (int(index_word) if index_word.isdigit() else None)
        if index is not None and index > 0:
            out.clues.append(_clause("inRowOrCol", {"axis": "row" if axis_word == "riga" else "col", "index": index}, negate))
        else:
            out.unknown.append(text)
        return

    if re.search(r"(?i)\bangolo\b", body):
        out.clues.append(_clause("inCorner", {}, negate))
        return
    if re.match(r"(?i)in diagonale", body):
        target = _target(body, names)
        out.clues.append(_clause("diagonal", {"target": target}, negate)) if target else out.unknown.append(text)
        return
    m = re.match(r"(?i)(?:di fronte|davanti)\s+a(?:ll'|l|lla|llo)?\s*(.+)", body)
    if m:
        target = _target(m.group(1), names)
        out.clues.append(_clause("facing", {"target": target}, negate)) if target else out.unknown.append(text)
        return
    m = re.match(r"(?i)(?:nella|nel|in)\s+(?:stessa stanza di|stanza con)\s+(.+)", body)
    if m:
        target = _target(m.group(1), names)
        out.clues.append(_clause("sameRoomAs", {"target": target}, negate)) if target and "name" in target else out.unknown.append(text)
        return
    m = re.match(r"(?i)(?:nella|nello|nel|in|nell'|alla|allo|al|a)\s+(?:stanza\s+|sala\s+)?(.+)", body)
    if m:
        wanted = re.sub(r"(?i)^(?:la|il|lo|l')\s*", "", m.group(1)).strip().lower()
        for room in rooms:
            if _near(wanted, room.lower()):
                out.clues.append(_clause("inRoom", {"room": room}, negate))
                return
    out.unknown.append(text)


_seat_cache: set[str] = set()


def _seat_types() -> set[str]:
    """I tipi di oggetto su cui ci si siede (sedia, sgabello…), letti da src/model/icons.js così non si disallineano."""
    if not _seat_cache:
        from murdoku_ml.validate import REPO_ROOT

        text = (REPO_ROOT / "src" / "model" / "icons.js").read_text(encoding="utf-8")
        _seat_cache.update(m.group(1) for m in re.finditer(r"^\s{2}(\w+): \{[^\n]*\bseat: true", text, re.M))
    return _seat_cache


def _only_one_property(gender: str | None, rest: str | None, names: list[str], rooms: list[str], out: Parsed) -> dict | None:
    """La caratteristica di «l'unica persona …» (parametri di `onlyOneWithProperty`), o None se non si capisce (o non è supportata:
    il motivo è già in `out.unsupported`)."""
    if gender:
        return {"property": "male" if gender.lower() == "uomo" else "female"}
    rest = re.sub(r"(?i)^che\s+(?:era|è|e'|stava|si\s+trovava)\s+", "", (rest or "").strip())
    if re.fullmatch(r"(?i)sedut[oa]", rest):
        return {"property": "seated"}
    m = re.match(rf"(?i)(?:{POSTURE}\s+)?{ON}(.+)", rest)
    if m:
        obj, bad = _object_in(m.group(1))
        if bad:
            out.unsupported.append(bad)
            return None
        if obj in _seat_types():
            return {"property": "sittingOn", "objectTypeId": obj}
        if obj:  # su un tappeto, in sella a un cavallo…: non è una seduta, è «su un oggetto di quel tipo»
            return {"property": "custom", "customClue": {"type": "onObjectType", "params": {"objectTypeId": obj}}}
        return None
    m = re.match(r"(?i)(?:accanto|vicino)\s+a(?:ll'|l|lla|llo|i|gli|lle)?\s*(.+)", rest)
    if m and not re.search(r"(?i)\bmuro\b", m.group(1)):
        target = _target(m.group(1), names)
        if target:
            return {"property": "adjacentTo", "target": target}
        if _object_in(m.group(1))[1]:
            out.unsupported.append(_object_in(m.group(1))[1])
        return None
    # qualunque altra condizione che la grammatica sa leggere («nella Cucina», «in un angolo», «a nord di Bors»): indizio annidato
    sub = Parsed()
    _parse_clause("Era " + rest, names, rooms, sub)
    out.unsupported += sub.unsupported
    if len(sub.clues) == 1 and not sub.unknown and not sub.unsupported:
        clue = {k: v for k, v in sub.clues[0].items() if k in ("type", "params", "negate")}
        return {"property": "custom", "customClue": clue}
    return None


def _number(word: str) -> int | None:
    word = word.lower()
    return int(word) if word.isdigit() else NUMBER_WORDS.get(word)


def _custom_clause(text: str, names: list[str], rooms: list[str], out: Parsed) -> bool:
    """Le frasi di `grammatica.json`, provate per prime sull'intera frase (anche col «non» davanti). True se una combacia."""
    for rule in custom()["frasi"]:
        pieces = re.split(r"\{(\w+)\}", rule["se"].strip().rstrip("."))
        pattern = "".join(
            PLACEHOLDERS[p] if i % 2 else re.sub(r"(?:\\ |\s)+", lambda _: r"\s+", re.escape(p)) for i, p in enumerate(pieces)
        )
        stripped = re.sub(r"(?i)^non\s+", "", text)
        for negate, candidate in ((False, text), (True, stripped)):
            if negate and candidate == text:
                continue
            m = re.fullmatch(pattern, candidate, re.IGNORECASE)
            if not m:
                continue
            outcome = _custom_params(rule, m.groupdict(), names, rooms)
            if outcome is None:
                continue
            params, unsupported = outcome
            if unsupported:
                out.unsupported.append(unsupported)
                return True
            out.clues.append(_clause(rule["indizio"], params, negate != bool(rule.get("nega"))))
            return True
    return False


def _custom_params(rule: dict, found: dict, names: list[str], rooms: list[str]):
    """(parametri, codice non supportato) per una frase personale, o None se un buco non si capisce (la frase non vale)."""
    params = dict(rule.get("parametri") or {})
    target = None
    if found.get("persona"):
        person = next((n for n in names if n.lower() == found["persona"].strip().lower()), None)
        if person is None:
            return None
        target = {"name": person}
    if found.get("oggetto"):
        obj, bad = _object_in(found["oggetto"])
        if bad:
            return None, bad
        if obj is None:
            category = next((CATEGORY_WORDS[w] for w in re.findall(r"[a-zà-ÿ']+", found["oggetto"].lower()) if w in CATEGORY_WORDS), None)
            if category is None:
                return None
            target = {"object": category}
        else:
            target = {"object": obj}
            if rule["indizio"] == "onObjectType":
                params["objectTypeId"] = obj
    if rule["indizio"] in TARGET_TYPES:
        if target is None:
            return None
        params["target"] = target
    if found.get("stanza"):
        wanted = re.sub(r"(?i)^(?:la|il|lo|l')\s*", "", found["stanza"]).strip().lower()
        room = next((r for r in rooms if _near(wanted, r.lower())), None)
        if room is None:
            return None
        params["room"] = room
    if found.get("direzione"):
        params["direction"] = DIRECTIONS[found["direzione"].lower()]
    if found.get("n"):
        number = _number(found["n"])
        if number is None:
            return None
        if rule["indizio"] == "inRowOrCol":
            params["index"] = number
            params.setdefault("axis", "row" if rule.get("asse", "riga") == "riga" else "col")
        else:
            params["distance"] = number
    return params, None


def _near(a: str, b: str) -> bool:
    from difflib import SequenceMatcher

    return SequenceMatcher(None, a, b).ratio() >= 0.8
