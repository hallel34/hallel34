# Age Progression Video Maker

Local Streamlit app that turns photos from different ages into a smooth,
eye-aligned morphing timelapse MP4 (built for Bar/Bat Mitzvah slideshows).

## Structure

```
age_progression/
├── app.py             # Streamlit UI (upload, reorder, manual fix, settings, render)
├── vision.py          # MediaPipe landmarks, eye alignment, Delaunay morph, cross-dissolve
├── video.py           # Slide prep, lazy frame timeline, H.264 MP4 export (ffmpeg / OpenCV fallback)
├── io_utils.py        # Image decoding (EXIF orientation, HEIC), EXIF/filename dates, sorting
├── requirements.txt
├── models/            # face_landmarker.task is auto-downloaded here on first run
└── tests/test_pipeline.py
```

## Run

```bash
cd age_progression
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

First launch downloads the ~4 MB MediaPipe face model (needs internet once).
On a bare Linux server MediaPipe may need `sudo apt install libegl1 libgles2`.

## How it works

1. **Alignment** – iris centres from 478 MediaPipe landmarks drive a similarity
   transform (rotate + uniform scale + shift) so both eyes land on identical
   pixels in every frame. Face size / eye height are sliders.
2. **Sorting** – EXIF capture date → date in filename (`IMG_20120304…`) →
   natural filename order. Reorder with ⬆/⬇, untick to exclude.
3. **Transitions** – *Landmark morph*: both photos are warped to the
   interpolated landmark layout via a Delaunay mesh, then dissolved (eased).
   Falls back to cross-dissolve automatically when landmarks are missing.
4. **Export** – frames stream into ffmpeg (bundled via `imageio-ffmpeg`) as
   H.264/yuv420p MP4; 720p/1080p, 24/30/60 fps, per-photo and transition durations.
5. **Failures** – photos with no face are flagged, can be fixed by placing the
   eyes manually, and are otherwise skipped with a warning. Multiple faces →
   the largest is used (override with manual eyes). Upscaled (>2.5×) photos are flagged.

## Tests

```bash
python -m pytest -q                       # maths, sorting, morph
FACE_IMAGE=/path/face.jpg python -m pytest -q   # + real detection & MP4 export
```
