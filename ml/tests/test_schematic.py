"""La lettura della griglia schematica, su una griglia sintetica disegnata al volo (non una foto del libro)."""

import cv2
import numpy as np

from reader import schematic


def draw_board(rows=5, cols=6, cell=160, blocked=(), missing=(), walls=()):
    """Una griglia come quella del libro: celle chiare, caselle grigie, linee sottili, muri spessi, angoli mancanti.

    walls: ("v", r, c) = muro a destra della casella (r,c); ("h", r, c) = muro sotto.
    """
    size = (rows * cell + 300, cols * cell + 300)
    img = np.full((*size, 3), 196, np.uint8)  # pergamena
    ox = oy = 150
    for r in range(rows):
        for c in range(cols):
            if (r, c) in missing:
                continue
            x, y = ox + c * cell, oy + r * cell
            cv2.rectangle(img, (x, y), (x + cell, y + cell), (222, 222, 222), -1)
            if (r, c) in blocked:
                cv2.rectangle(img, (x, y), (x + cell, y + cell), (165, 165, 165), -1)
    for r in range(rows):
        for c in range(cols):
            if (r, c) in missing:
                continue
            x, y = ox + c * cell, oy + r * cell
            cv2.rectangle(img, (x, y), (x + cell, y + cell), (150, 150, 150), 3)
    for kind, r, c in walls:
        x, y = ox + c * cell, oy + r * cell
        if kind == "v":
            cv2.line(img, (x + cell, y), (x + cell, y + cell), (95, 95, 95), 16)
        else:
            cv2.line(img, (x, y + cell), (x + cell, y + cell), (95, 95, 95), 16)
    # bordo esterno spesso
    for r in range(rows):
        for c in range(cols):
            if (r, c) in missing:
                continue
            x, y = ox + c * cell, oy + r * cell
            for dr, dc, p0, p1 in ((-1, 0, (x, y), (x + cell, y)), (1, 0, (x, y + cell), (x + cell, y + cell)), (0, -1, (x, y), (x, y + cell)), (0, 1, (x + cell, y), (x + cell, y + cell))):
                nr, nc = r + dr, c + dc
                if not (0 <= nr < rows and 0 <= nc < cols) or (nr, nc) in missing:
                    cv2.line(img, p0, p1, (95, 95, 95), 16)
    return img


def test_forma_caselle_bloccate_e_stanze():
    # 5x6, una casella grigia, due angoli mancanti, un blocco 3x3 in alto a sinistra chiuso da muri
    walls = [("v", r, 2) for r in range(3)] + [("h", 2, c) for c in range(3)]
    img = draw_board(blocked={(1, 1)}, missing={(4, 4), (4, 5)}, walls=walls)
    sch = schematic.read(img, (0, 0, img.shape[1], img.shape[0]))
    assert sch is not None
    assert (sch.rows, sch.cols) == (5, 6)
    assert int(sch.inside.sum()) == 28
    assert not sch.inside[4, 4] and not sch.inside[4, 5]
    assert sch.blocked[1, 1] and int(sch.blocked.sum()) == 1
    rooms = sch.rooms()
    assert int(rooms.max()) + 1 == 2
    assert rooms[0, 0] == rooms[2, 2] != rooms[0, 3]  # il blocco chiuso è una stanza
    assert rooms[0, 3] == rooms[4, 0] == rooms[3, 5]  # il resto è un'unica stanza


def test_stanze_da_muri_a_mano():
    inside = np.ones((2, 3), bool)
    wall_right = np.zeros((2, 3), bool)
    wall_down = np.zeros((2, 3), bool)
    wall_right[:, 0] = True  # una parete fra colonna 0 e 1
    sch = schematic.Schematic(2, 3, inside, np.zeros((2, 3), bool), wall_right, wall_down)
    rooms = sch.rooms()
    assert rooms[0, 0] == rooms[1, 0] != rooms[0, 1] == rooms[1, 2]
