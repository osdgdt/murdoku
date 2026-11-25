"""Lettura delle foto: orientamento EXIF (lo applica già OpenCV) e riduzione."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def load(path: str | Path, max_side: int | None = None) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(path)
    if max_side:
        scale = max_side / max(image.shape[:2])
        if scale < 1:
            image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return image


def rotate(image: np.ndarray, quarter_turns: int) -> np.ndarray:
    """Ruota in senso orario di `quarter_turns` quarti di giro."""
    return np.ascontiguousarray(np.rot90(image, -(quarter_turns % 4)))
