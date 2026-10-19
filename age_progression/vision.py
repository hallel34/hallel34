"""Computer-vision core: face landmarks, eye-anchored alignment and transitions.

Pipeline for one photo
----------------------
1. ``FaceLandmarker.detect``  -> 478 MediaPipe landmarks (pixel coordinates).
2. ``eye_centers``            -> left/right pupil positions.
3. ``align``                  -> similarity transform (rotate + uniform scale +
                                 translate, no shear) that puts the eyes at the
                                 *same* output coordinates for every photo.
4. ``plan_morph`` / ``morph_frame`` -> Delaunay landmark morph between two
                                 aligned photos, or ``crossfade`` as a fallback.
"""
from __future__ import annotations

import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
MODEL_PATH = Path(__file__).parent / "models" / "face_landmarker.task"

# MediaPipe face-mesh indices (468 mesh points + 10 iris points = 478).
_IRIS_A, _IRIS_B = 468, 473
_EYE_CORNERS_A = (33, 133)
_EYE_CORNERS_B = (362, 263)

_FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
              400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
              54, 103, 67, 109]
_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39,
         40, 185, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13,
         82, 81, 80, 191]
_EYES = [263, 249, 390, 373, 374, 380, 381, 382, 362, 466, 388, 387, 386, 385, 384, 398,
         33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173]
_BROWS = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107, 276, 283, 282, 295, 285, 300, 293, 334,
          296, 336]
_NOSE_CHEEKS = [1, 2, 4, 5, 6, 19, 94, 98, 168, 195, 197, 327, 129, 358, 50, 280, 101, 330,
                205, 425, 116, 345]
_IRISES = list(range(468, 478))
MORPH_INDICES = np.array(
    sorted(set(_FACE_OVAL + _LIPS + _EYES + _BROWS + _NOSE_CHEEKS + _IRISES)), dtype=int
)


# --------------------------------------------------------------------------- #
# Face detection
# --------------------------------------------------------------------------- #
def ensure_model(path: Path = MODEL_PATH) -> Path:
    """Download the MediaPipe face-landmarker model on first use (~4 MB)."""
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        urllib.request.urlretrieve(MODEL_URL, tmp)
        tmp.replace(path)
    return path


@dataclass
class Detection:
    """Result of face detection on one image."""

    points: Optional[np.ndarray]  # (478, 2) float32 pixel coords, or None
    n_faces: int = 0


class FaceLandmarker:
    """Thin wrapper around MediaPipe's Tasks ``FaceLandmarker``.

    If several faces are found, the largest one is used (the Bar/Bat Mitzvah
    kid is assumed to be the most prominent face; use manual eyes otherwise).
    """

    def __init__(self, max_faces: int = 6, min_confidence: float = 0.4):
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision

        self._mp = mp
        options = mp_vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(ensure_model())),
            running_mode=mp_vision.RunningMode.IMAGE,
            num_faces=max_faces,
            min_face_detection_confidence=min_confidence,
            min_face_presence_confidence=min_confidence,
        )
        self._landmarker = mp_vision.FaceLandmarker.create_from_options(options)

    def detect(self, image_bgr: np.ndarray) -> Detection:
        h, w = image_bgr.shape[:2]
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        mp_image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect(mp_image)
        faces = [
            np.array([[p.x * w, p.y * h] for p in lm], dtype=np.float32)
            for lm in result.face_landmarks
        ]
        if not faces:
            return Detection(None, 0)
        areas = [np.ptp(f[:, 0]) * np.ptp(f[:, 1]) for f in faces]
        return Detection(faces[int(np.argmax(areas))], len(faces))


# --------------------------------------------------------------------------- #
# Alignment
# --------------------------------------------------------------------------- #
def eye_centers(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return (left, right) eye centres in *image* space (left = smaller x)."""
    if len(points) > _IRIS_B:
        a, b = points[_IRIS_A], points[_IRIS_B]
    else:
        a = points[list(_EYE_CORNERS_A)].mean(axis=0)
        b = points[list(_EYE_CORNERS_B)].mean(axis=0)
    return (a, b) if a[0] <= b[0] else (b, a)


@dataclass(frozen=True)
class AlignmentSpec:
    """Where the eyes must land in every output frame.

    ``eye_dist_frac`` and ``eye_y_frac`` are fractions of the output *height*,
    so the face keeps the same size whatever aspect ratio is chosen. The eye
    midpoint is horizontally centred.
    """

    out_w: int = 1080
    out_h: int = 1080
    eye_dist_frac: float = 0.22
    eye_y_frac: float = 0.40

    def targets(self) -> tuple[np.ndarray, np.ndarray]:
        d = self.eye_dist_frac * self.out_h
        y = self.eye_y_frac * self.out_h
        cx = self.out_w / 2
        return np.array([cx - d / 2, y]), np.array([cx + d / 2, y])

    def scaled(self, factor: float) -> "AlignmentSpec":
        """Same layout at a different resolution (for fast previews)."""
        return AlignmentSpec(
            max(2, round(self.out_w * factor)), max(2, round(self.out_h * factor)),
            self.eye_dist_frac, self.eye_y_frac,
        )


def similarity_from_eyes(
    src_l: np.ndarray, src_r: np.ndarray, dst_l: np.ndarray, dst_r: np.ndarray
) -> np.ndarray:
    """2x3 matrix (rotation + uniform scale + translation) mapping the source
    eye pair exactly onto the destination eye pair."""
    s = complex(*(src_r - src_l))
    d = complex(*(dst_r - dst_l))
    if abs(s) < 1e-6:
        raise ValueError("Eyes coincide; cannot compute alignment")
    z = d / s
    a, b = z.real, z.imag
    rot = np.array([[a, -b], [b, a]])
    t = dst_l - rot @ src_l
    return np.hstack([rot, t[:, None]]).astype(np.float64)


@dataclass
class AlignedFace:
    image: np.ndarray  # BGR uint8, (out_h, out_w, 3)
    points: Optional[np.ndarray]  # (478, 2) in aligned space, None for manual eyes
    scale: float  # source->output zoom (>2.5 means a blurry upscale)


def align(
    image: np.ndarray,
    eyes: tuple[np.ndarray, np.ndarray],
    spec: AlignmentSpec,
    landmarks: Optional[np.ndarray] = None,
) -> AlignedFace:
    """Warp ``image`` so that ``eyes`` land on ``spec.targets()``."""
    dst_l, dst_r = spec.targets()
    m = similarity_from_eyes(np.asarray(eyes[0], float), np.asarray(eyes[1], float), dst_l, dst_r)
    warped = cv2.warpAffine(
        image, m, (spec.out_w, spec.out_h),
        flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT_101,
    )
    pts = None
    if landmarks is not None:
        pts = (landmarks @ m[:, :2].T + m[:, 2]).astype(np.float32)
    return AlignedFace(warped, pts, float(np.hypot(m[0, 0], m[1, 0])))


# --------------------------------------------------------------------------- #
# Transitions
# --------------------------------------------------------------------------- #
def smoothstep(t: float) -> float:
    """Ease-in/ease-out so motion starts and ends gently."""
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def crossfade(a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    e = smoothstep(t)
    return cv2.addWeighted(a, 1 - e, b, e, 0)


@dataclass
class MorphPlan:
    """Pre-computed, per-transition data (triangulation is reused every frame)."""

    pa: np.ndarray  # (N,2) control points in photo A
    pb: np.ndarray  # (N,2) control points in photo B
    tri: np.ndarray  # (T,3) vertex indices
    xs: np.ndarray  # pixel grids for building remap tables
    ys: np.ndarray


def _control_points(face: AlignedFace, w: int, h: int) -> np.ndarray:
    pts = face.points[MORPH_INDICES].copy()
    pts[:, 0] = np.clip(pts[:, 0], 0, w - 1)
    pts[:, 1] = np.clip(pts[:, 1], 0, h - 1)
    border = np.array(
        [[0, 0], [w / 2, 0], [w - 1, 0], [0, h / 2], [w - 1, h / 2],
         [0, h - 1], [w / 2, h - 1], [w - 1, h - 1]],
        dtype=np.float32,
    )
    return np.vstack([pts, border]).astype(np.float32)


def plan_morph(a: AlignedFace, b: AlignedFace) -> Optional[MorphPlan]:
    """Build a morph plan, or ``None`` if either photo lacks full landmarks."""
    if a.points is None or b.points is None:
        return None
    from scipy.spatial import Delaunay

    h, w = a.image.shape[:2]
    pa, pb = _control_points(a, w, h), _control_points(b, w, h)
    try:
        tri = Delaunay((pa + pb) / 2).simplices
    except Exception:  # degenerate geometry (e.g. QhullError)
        return None
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    return MorphPlan(pa, pb, tri, xs, ys)


def _inverse_affines(dst_tris: np.ndarray, src_tris: np.ndarray) -> np.ndarray:
    """Per-triangle affine (3x2) mapping destination pixels -> source pixels."""
    ones = np.ones((len(dst_tris), 3, 1), dtype=np.float64)
    x = np.concatenate([dst_tris.astype(np.float64), ones], axis=2)  # (T,3,3)
    try:
        return np.linalg.solve(x, src_tris.astype(np.float64))
    except np.linalg.LinAlgError:  # collapsed triangle somewhere
        return np.linalg.pinv(x) @ src_tris.astype(np.float64)


def morph_frame(plan: MorphPlan, a: np.ndarray, b: np.ndarray, t: float) -> np.ndarray:
    """Landmark-based morph at progress ``t`` in [0, 1].

    Both photos are warped towards the interpolated landmark layout (so eyes,
    nose and mouth line up), then cross-dissolved.
    """
    e = smoothstep(t)
    h, w = a.shape[:2]
    pm = (1 - e) * plan.pa + e * plan.pb

    labels = np.zeros((h, w), dtype=np.int32)
    mi = np.round(pm).astype(np.int32)
    for k, simplex in enumerate(plan.tri):
        cv2.fillConvexPoly(labels, mi[simplex], int(k))

    warped = []
    for img, src in ((a, plan.pa), (b, plan.pb)):
        c = _inverse_affines(pm[plan.tri], src[plan.tri])  # (T,3,2)
        cx, cy = c[:, :, 0], c[:, :, 1]
        map_x = (cx[:, 0][labels] * plan.xs + cx[:, 1][labels] * plan.ys + cx[:, 2][labels])
        map_y = (cy[:, 0][labels] * plan.xs + cy[:, 1][labels] * plan.ys + cy[:, 2][labels])
        warped.append(
            cv2.remap(img, map_x.astype(np.float32), map_y.astype(np.float32),
                      cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
        )
    return cv2.addWeighted(warped[0], 1 - e, warped[1], e, 0)
