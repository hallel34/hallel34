"""Image loading, EXIF date extraction and chronological sorting.

Everything here is UI-agnostic so it can be unit-tested and reused.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Sequence

import cv2
import numpy as np
from PIL import Image, ImageOps

try:  # optional HEIC/HEIF support (iPhone photos)
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover - optional dependency
    pass

# Every image is decoded at (at most) this size. Landmarks are detected on the
# *same* downscaled image, so stored coordinates stay consistent everywhere.
MAX_SIDE = 2000

_EXIF_IFD = 0x8769
_TAG_DATETIME_ORIGINAL = 0x9003
_TAG_DATETIME_DIGITIZED = 0x9004
_TAG_DATETIME = 0x0132
_FILENAME_DATE = re.compile(
    r"(?<!\d)((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)"
)


def load_image(data: bytes, max_side: int = MAX_SIDE) -> np.ndarray:
    """Decode bytes -> BGR uint8 array, honouring EXIF orientation."""
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        arr = np.asarray(im)
    h, w = arr.shape[:2]
    scale = max_side / max(h, w)
    if scale < 1:
        arr = cv2.resize(arr, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _parse_exif_date(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, bytes):
        value = value.decode(errors="ignore")
    value = str(value).strip().replace("\x00", "")
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y:%m:%d"):
        try:
            return datetime.strptime(value[:19] if "%H" in fmt else value[:10], fmt)
        except ValueError:
            continue
    return None


def read_capture_date(data: bytes, filename: str = "") -> tuple[Optional[datetime], str]:
    """Best-effort capture date. Returns ``(date, source)``.

    ``source`` is one of ``"exif"``, ``"filename"`` or ``"none"``.
    Priority: EXIF DateTimeOriginal > DateTimeDigitized > DateTime > date in filename.
    """
    try:
        with Image.open(io.BytesIO(data)) as im:
            exif = im.getexif()
            sub = exif.get_ifd(_EXIF_IFD) if exif else {}
            for source, tag in (
                (sub, _TAG_DATETIME_ORIGINAL),
                (sub, _TAG_DATETIME_DIGITIZED),
                (exif, _TAG_DATETIME),
            ):
                parsed = _parse_exif_date(source.get(tag)) if source else None
                if parsed:
                    return parsed, "exif"
    except Exception:
        pass
    m = _FILENAME_DATE.search(filename)
    if m:
        try:
            return datetime(int(m[1]), int(m[2]), int(m[3])), "filename"
        except ValueError:
            pass
    return None, "none"


def natural_key(name: str) -> list:
    """Sort key so that ``img2.jpg`` < ``img10.jpg``."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


@dataclass(frozen=True)
class SortKeyInfo:
    item_id: str
    name: str
    date: Optional[datetime]


def sort_ids(items: Sequence[SortKeyInfo], mode: str = "date") -> list[str]:
    """Return item ids in chronological order.

    ``mode="date"``: dated photos first (oldest -> newest), undated photos
    afterwards in natural filename order. ``mode="filename"``: natural filename order.
    """
    if mode == "filename":
        ordered = sorted(items, key=lambda i: natural_key(i.name))
    else:
        ordered = sorted(
            items,
            key=lambda i: (i.date is None, i.date or datetime.max, natural_key(i.name)),
        )
    return [i.item_id for i in ordered]
