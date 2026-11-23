import pytest

from murdoku_ml.record import check_record, inventory, load_record, new_record, save_record
from murdoku_ml.unsupported import UNSUPPORTED, describe


def test_record_vuoto_e_incerto_e_si_salva(tmp_path):
    record = new_record(7)
    assert check_record(record) == []
    save_record(record, tmp_path / "007.record.json")
    assert load_record(tmp_path / "007.record.json")["source"]["number"] == 7


def test_record_ok_vuole_il_caso_e_nessun_elemento_non_supportato():
    record = new_record(1)
    record["extraction"]["status"] = "ok"
    assert any("puzzle" in p for p in check_record(record))
    record["puzzle"] = {"grid": {}}
    record["unsupported"] = ["hidden_roles"]
    assert any("non supportati" in p for p in check_record(record))


def test_codice_sconosciuto_e_rifiutato(tmp_path):
    record = new_record(2)
    record["unsupported"] = ["boh"]
    with pytest.raises(ValueError):
        save_record(record, tmp_path / "x.json")


def test_inventario_per_codice():
    a, b, c = new_record(75), new_record(4), new_record(9)
    a["unsupported"] = ["hidden_roles", "animals"]
    b["unsupported"] = ["not_next_to_wall"]
    assert inventory([a, b, c]) == {"animals": [75], "hidden_roles": [75], "not_next_to_wall": [4]}


def test_ogni_codice_ha_una_descrizione():
    assert all(describe(code) != "codice sconosciuto" for code in UNSUPPORTED)
    assert describe("boh") == "codice sconosciuto"
