"""Immagini di controllo per guardare cosa ha letto il lettore (si salvano in lavoro/debug/, non nel repository)."""

from __future__ import annotations

import cv2
import numpy as np

from . import schematic

_PALETTE = [(200, 120, 120), (120, 200, 120), (120, 120, 200), (200, 200, 100), (200, 100, 200), (100, 200, 200), (160, 160, 160), (90, 140, 220)]


def draw_schematic(page: np.ndarray, sch: schematic.Schematic, box) -> np.ndarray:
    """Il ritaglio della griglia con quello che il lettore ha capito: colore per stanza, X = bloccata, cerchio = occupabile."""
    x0, y0, x1, y1 = box
    crop = page[y0:y1, x0:x1].copy()
    P = sch.vertices
    rooms = sch.rooms()
    overlay = crop.copy()
    for r in range(sch.rows):
        for c in range(sch.cols):
            quad = np.array([P[r][c], P[r][c + 1], P[r + 1][c + 1], P[r + 1][c]], np.int32)
            if not sch.inside[r, c]:
                cv2.polylines(overlay, [quad], True, (0, 0, 255), 2)
                continue
            cv2.fillConvexPoly(overlay, quad, _PALETTE[rooms[r, c] % len(_PALETTE)])
            if sch.blocked[r, c]:
                cv2.line(overlay, tuple(quad[0]), tuple(quad[2]), (0, 0, 0), 4)
                cv2.line(overlay, tuple(quad[1]), tuple(quad[3]), (0, 0, 0), 4)
    out = cv2.addWeighted(overlay, 0.45, crop, 0.55, 0)
    for mark in sch.marks:
        pts = [np.mean([P[r][c], P[r][c + 1], P[r + 1][c + 1], P[r + 1][c]], axis=0) for r, c in mark]
        centre = tuple(int(v) for v in np.mean(pts, axis=0))
        cv2.circle(out, centre, 28, (0, 0, 0), 6)
        if len(mark) > 1:
            cv2.putText(out, str(len(mark)), centre, cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 5)
    for r in range(sch.rows):
        for c in range(sch.cols):
            q = np.array([P[r][c], P[r][c + 1], P[r + 1][c + 1], P[r + 1][c]], np.int32)
            if sch.wall_right[r, c]:
                cv2.line(out, tuple(q[1]), tuple(q[2]), (0, 0, 255), 8)
            if sch.wall_down[r, c]:
                cv2.line(out, tuple(q[3]), tuple(q[2]), (0, 0, 255), 8)
    return out


