"""Tests for alignment maths, sorting, morphing and end-to-end MP4 export.

Run from the project folder:  python -m pytest -q
Face-dependent tests are skipped if no sample face image is provided via the
FACE_IMAGE environment variable.
"""
import os
import sys
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import io_utils  # noqa: E402
from vision import (AlignedFace, AlignmentSpec, align, crossfade, morph_frame,  # noqa: E402
                    plan_morph, similarity_from_eyes)
from video import Slide, render_video  # noqa: E402


def test_similarity_maps_eyes_exactly():
    sl, sr = np.array([100., 200.]), np.array([180., 230.])
    dl, dr = np.array([400., 300.]), np.array([520., 300.])
    m = similarity_from_eyes(sl, sr, dl, dr)
    for src, dst in ((sl, dl), (sr, dr)):
        assert np.allclose(m[:, :2] @ src + m[:, 2], dst)


def test_align_places_eyes_on_target():
    img = np.random.randint(0, 255, (800, 600, 3), np.uint8)
    spec = AlignmentSpec(640, 360)
    pts = np.zeros((478, 2), np.float32)
    pts[468], pts[473] = (200, 300), (260, 320)
    out = align(img, (pts[468], pts[473]), spec, pts)
    tl, tr = spec.targets()
    assert np.allclose(out.points[468], tl, atol=1e-3)
    assert np.allclose(out.points[473], tr, atol=1e-3)


def test_sort_by_date_then_name():
    d = datetime
    infos = [io_utils.SortKeyInfo("a", "img10.jpg", None),
             io_utils.SortKeyInfo("b", "x.jpg", d(2015, 1, 1)),
             io_utils.SortKeyInfo("c", "img2.jpg", None),
             io_utils.SortKeyInfo("d", "y.jpg", d(2010, 5, 5))]
    assert io_utils.sort_ids(infos, "date") == ["d", "b", "c", "a"]
    assert io_utils.sort_ids(infos, "filename") == ["c", "a", "b", "d"]


def test_filename_date_fallback():
    assert io_utils.read_capture_date(b"not an image", "IMG_20120304_101500.jpg") == (
        datetime(2012, 3, 4), "filename")
    assert io_utils.read_capture_date(b"x", "IMG_2043.jpg")[0] is None


def _synthetic_faces():
    spec = AlignmentSpec(320, 320)
    rng = np.random.default_rng(0)
    pts = (rng.random((478, 2)) * 200 + 60).astype(np.float32)
    a = AlignedFace(np.full((320, 320, 3), 40, np.uint8), pts, 1.0)
    b = AlignedFace(np.full((320, 320, 3), 200, np.uint8), pts + 5, 1.0)
    return a, b


def test_morph_endpoints_and_midpoint():
    a, b = _synthetic_faces()
    plan = plan_morph(a, b)
    assert plan is not None
    mid = morph_frame(plan, a.image, b.image, 0.5)
    assert mid.shape == a.image.shape
    assert abs(int(mid.mean()) - 120) <= 2  # flat colours blend to the midpoint
    assert np.array_equal(morph_frame(plan, a.image, b.image, 0.0), a.image)
    assert np.array_equal(crossfade(a.image, b.image, 1.0), b.image)


def test_missing_landmarks_disable_morph():
    a, b = _synthetic_faces()
    b.points = None
    assert plan_morph(a, b) is None


@pytest.mark.skipif(not os.environ.get("FACE_IMAGE"), reason="set FACE_IMAGE=/path/to/face.jpg")
def test_end_to_end_with_real_face(tmp_path):
    from vision import FaceLandmarker

    data = Path(os.environ["FACE_IMAGE"]).read_bytes()
    det = FaceLandmarker().detect(io_utils.load_image(data))
    assert det.points is not None
    slides = [Slide("a", data, det.points), Slide("b", data, det.points, caption="2024")]
    out = tmp_path / "out.mp4"
    n = render_video(slides, str(out), AlignmentSpec(320, 180), 0.2, 0.2, fps=10)
    assert n == 2 * 2 + 2 and out.stat().st_size > 1000
