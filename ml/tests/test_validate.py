import json
from pathlib import Path

import pytest

from murdoku_ml.validate import ValidatorError, validate_case, validate_file

FIXTURE = Path(__file__).parent / "fixtures" / "mini-unico.murdoku.json"


def puzzle():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_caso_unico_e_valido():
    report = validate_file(FIXTURE)
    assert report["ok"] and report["unique"] and report["stage"] == "done"
    assert report["culprit"] in {"Anna", "Bruno", "Carla"}
    assert {p["name"] for p in report["solution"]} == {"Anna", "Bruno", "Carla", "Vera"}
    assert report["human"]["level"]


def test_soluzione_stampata_uguale_e_diversa():
    report = validate_file(FIXTURE)
    printed = [dict(p) for p in report["solution"]]
    assert validate_case(puzzle(), printed)["matchesPrinted"] is True
    wrong = [dict(p) for p in printed]
    wrong[0]["row"], wrong[1]["row"] = wrong[1]["row"], wrong[0]["row"]
    bad = validate_case(puzzle(), wrong)
    assert bad["matchesPrinted"] is False and not bad["ok"] and bad["mismatches"]


def test_senza_indizi_non_e_unica():
    p = puzzle()
    p["clues"] = []
    report = validate_case(p)
    assert not report["ok"] and report["problems"]


def test_file_rotto_si_ferma_alla_forma():
    report = validate_case({"grid": None})
    assert report["stage"] == "shape" and not report["ok"]


def test_senza_node_si_dice(monkeypatch):
    monkeypatch.setattr("shutil.which", lambda name: None)
    with pytest.raises(ValidatorError):
        validate_case(puzzle())
