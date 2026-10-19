"""Slide preparation and MP4 export.

Frames are generated lazily and streamed straight into the encoder, so memory
use stays flat no matter how many photos are in the timeline.
"""
from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass
from typing import Callable, Iterator, Optional, Sequence

import cv2
import numpy as np

from io_utils import load_image
from vision import AlignedFace, AlignmentSpec, align, crossfade, eye_centers, morph_frame, plan_morph


@dataclass
class Slide:
    """One photo in the timeline (raw bytes + whatever we know about the face)."""

    name: str
    data: bytes
    landmarks: Optional[np.ndarray] = None  # in load_image() coordinates
    manual_eyes: Optional[tuple] = None  # ((lx, ly), (rx, ry)); overrides landmarks
    caption: Optional[str] = None

    def eyes(self) -> Optional[tuple[np.ndarray, np.ndarray]]:
        if self.manual_eyes is not None:
            left, right = map(lambda p: np.asarray(p, dtype=float), self.manual_eyes)
            return (left, right) if left[0] <= right[0] else (right, left)
        if self.landmarks is not None:
            return eye_centers(self.landmarks)
        return None


def prepare_slide(slide: Slide, spec: AlignmentSpec) -> AlignedFace:
    """Decode, align (and optionally caption) one slide."""
    eyes = slide.eyes()
    if eyes is None:
        raise ValueError(f"{slide.name}: no face / eye positions available")
    image = load_image(slide.data)
    # Manual eyes win over detected landmarks, so landmarks only seed the morph
    # when they are the source of the alignment.
    landmarks = slide.landmarks if slide.manual_eyes is None else None
    face = align(image, eyes, spec, landmarks)
    if slide.caption:
        draw_caption(face.image, slide.caption)
    return face


def draw_caption(img: np.ndarray, text: str) -> None:
    """Bottom-centre caption with a dark outline, drawn in place."""
    h, w = img.shape[:2]
    scale = h / 540
    thick = max(2, round(2 * scale))
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_DUPLEX, scale, thick)
    org = ((w - tw) // 2, h - round(0.05 * h))
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_DUPLEX, scale, (0, 0, 0), thick + 3, cv2.LINE_AA)
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_DUPLEX, scale, (255, 255, 255), thick, cv2.LINE_AA)


def total_frames(n_slides: int, hold: int, trans: int) -> int:
    return n_slides * hold + max(n_slides - 1, 0) * trans


def iter_frames(
    slides: Sequence[Slide],
    spec: AlignmentSpec,
    hold_frames: int,
    trans_frames: int,
    style: str = "morph",
) -> Iterator[np.ndarray]:
    """Yield every BGR frame of the timeline.

    ``style`` is ``"morph"`` (landmark morph, falling back to cross-dissolve
    when landmarks are unavailable for either photo) or ``"crossfade"``.
    """
    current = prepare_slide(slides[0], spec)
    for i in range(len(slides)):
        yield current.image
        for _ in range(hold_frames - 1):
            yield current.image
        if i + 1 == len(slides):
            break
        nxt = prepare_slide(slides[i + 1], spec)
        plan = plan_morph(current, nxt) if style == "morph" and trans_frames else None
        for k in range(1, trans_frames + 1):
            t = k / (trans_frames + 1)
            if plan is not None:
                yield morph_frame(plan, current.image, nxt.image, t)
            else:
                yield crossfade(current.image, nxt.image, t)
        current = nxt


class VideoWriter:
    """H.264/yuv420p MP4 writer: ffmpeg (via imageio-ffmpeg) with OpenCV fallback."""

    def __init__(self, path: str, size: tuple[int, int], fps: int, crf: int = 17):
        self.path, self.size, self.fps = path, size, fps
        self._proc = None
        self._cv = None
        self._log = tempfile.TemporaryFile()
        try:
            import imageio_ffmpeg

            cmd = [
                imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
                "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{size[0]}x{size[1]}",
                "-r", str(fps), "-i", "-", "-an",
                "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", path,
            ]
            self._proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=self._log)
        except Exception:
            self._cv = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
            if not self._cv.isOpened():
                raise RuntimeError("Could not open a video encoder (ffmpeg or OpenCV mp4v)")

    def write(self, frame: np.ndarray) -> None:
        if self._proc is not None:
            try:
                self._proc.stdin.write(np.ascontiguousarray(frame).tobytes())
            except BrokenPipeError:
                raise RuntimeError(f"ffmpeg stopped unexpectedly: {self._stderr()}") from None
        else:
            self._cv.write(frame)

    def _stderr(self) -> str:
        self._log.seek(0)
        return self._log.read().decode(errors="ignore")[-800:]

    def close(self) -> None:
        if self._proc is not None:
            self._proc.stdin.close()
            if self._proc.wait() != 0:
                raise RuntimeError(f"ffmpeg failed: {self._stderr()}")
        elif self._cv is not None:
            self._cv.release()
        self._log.close()


def render_video(
    slides: Sequence[Slide],
    out_path: str,
    spec: AlignmentSpec,
    hold_s: float,
    transition_s: float,
    fps: int = 30,
    style: str = "morph",
    progress: Optional[Callable[[float, str], None]] = None,
) -> int:
    """Render the full timeline to ``out_path``; returns the frame count."""
    if not slides:
        raise ValueError("No slides to render")
    # H.264/yuv420p needs even dimensions.
    spec = AlignmentSpec(spec.out_w // 2 * 2, spec.out_h // 2 * 2, spec.eye_dist_frac, spec.eye_y_frac)
    hold = max(1, round(hold_s * fps))
    trans = max(0, round(transition_s * fps))
    total = total_frames(len(slides), hold, trans)

    writer = VideoWriter(out_path, (spec.out_w, spec.out_h), fps)
    done = 0
    try:
        for frame in iter_frames(slides, spec, hold, trans, style):
            writer.write(frame)
            done += 1
            if progress and (done % 5 == 0 or done == total):
                progress(done / total, f"Rendering frame {done}/{total}")
    finally:
        writer.close()
    return done
