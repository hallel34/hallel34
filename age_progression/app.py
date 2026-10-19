"""Streamlit UI: upload -> review/reorder -> fix faces -> settings -> render.

Run with:  streamlit run app.py
"""
from __future__ import annotations

import hashlib
import os
import tempfile
from datetime import datetime

import cv2
import numpy as np
import streamlit as st

import io_utils
from io_utils import SortKeyInfo
from video import Slide, prepare_slide, render_video, total_frames
from vision import AlignmentSpec, FaceLandmarker

st.set_page_config(page_title="Age Progression Video", page_icon="🎞️", layout="wide")

ASPECTS = {"Square 1:1": (1, 1), "Landscape 16:9": (16, 9), "Portrait 9:16": (9, 16)}
HEIGHTS = {"720p": 720, "1080p": 1080}
THUMB = 120


@st.cache_resource(show_spinner="Loading face model (first run downloads ~4 MB)…")
def get_landmarker() -> FaceLandmarker:
    return FaceLandmarker()


# --------------------------------------------------------------------------- #
# State helpers
# --------------------------------------------------------------------------- #
def state_items() -> dict:
    return st.session_state.setdefault("items", {})


def state_order() -> list:
    return st.session_state.setdefault("order", [])


def make_item(name: str, data: bytes) -> dict:
    """Decode once: thumbnail, capture date, face landmarks."""
    img = io_utils.load_image(data)
    det = get_landmarker().detect(img)
    date, date_src = io_utils.read_capture_date(data, name)
    thumb = cv2.cvtColor(cv2.resize(img, (THUMB, round(THUMB * img.shape[0] / img.shape[1]))),
                         cv2.COLOR_BGR2RGB)
    return dict(name=name, data=data, date=date, date_src=date_src, thumb=thumb,
                size=img.shape[:2], landmarks=det.points, n_faces=det.n_faces,
                manual=None, include=True)


def usable(it: dict) -> bool:
    return it["landmarks"] is not None or it["manual"] is not None


def sort_order(mode: str) -> None:
    infos = [SortKeyInfo(i, it["name"], it["date"]) for i, it in state_items().items()]
    st.session_state["order"] = io_utils.sort_ids(infos, mode)


def move(item_id: str, delta: int) -> None:
    order = state_order()
    i = order.index(item_id)
    j = i + delta
    if 0 <= j < len(order):
        order[i], order[j] = order[j], order[i]


def sync_uploads(files) -> None:
    """Make session items mirror the uploader; only new files get processed."""
    items = state_items()
    current = {}
    for f in files:
        data = f.getvalue()
        current[hashlib.sha1(data).hexdigest()[:12]] = (f.name, data)
    for gone in set(items) - set(current):
        del items[gone]
    new = [k for k in current if k not in items]
    if new:
        bar = st.progress(0.0, "Detecting faces…")
        for n, k in enumerate(new, 1):
            name, data = current[k]
            try:
                items[k] = make_item(name, data)
            except Exception as exc:  # unreadable / corrupt file
                st.warning(f"⚠️ Could not read **{name}** ({exc}); skipped.")
            bar.progress(n / len(new), f"Detecting faces… {n}/{len(new)}")
        bar.empty()
    order = [i for i in state_order() if i in items]
    fresh = [i for i in items if i not in order]
    st.session_state["order"] = order
    if fresh:  # newly added photos: merge and re-sort chronologically
        st.session_state["order"] = order + fresh
        sort_order(st.session_state.get("sort_mode", "date"))


# --------------------------------------------------------------------------- #
# UI sections
# --------------------------------------------------------------------------- #
def section_order() -> None:
    items, order = state_items(), state_order()
    st.subheader("2 · Review & reorder")
    c1, c2, c3 = st.columns([2, 1, 1])
    mode = c1.radio("Auto-sort by", ["date", "filename"], horizontal=True, key="sort_mode",
                    format_func=lambda m: "Capture date (EXIF → date in filename → name)"
                    if m == "date" else "Filename")
    c2.button("Apply sort", on_click=sort_order, args=(mode,), use_container_width=True)
    c3.caption("Use ⬆/⬇ to fine-tune the order. Untick to leave a photo out.")

    for pos, item_id in enumerate(order):
        it = items[item_id]
        cols = st.columns([1, 4, 2, 1, 1, 1])
        cols[0].image(it["thumb"])
        date = it["date"].strftime("%Y-%m-%d") if it["date"] else "no date"
        cols[1].markdown(f"**{pos + 1}. {it['name']}**  \n{date} _({it['date_src']})_")
        if it["manual"] is not None:
            cols[2].success("Manual eyes")
        elif it["landmarks"] is not None:
            extra = f" ({it['n_faces']} faces, using largest)" if it["n_faces"] > 1 else ""
            cols[2].success(f"Face found{extra}")
        else:
            cols[2].error("No face – fix or it is skipped")
        it["include"] = cols[3].checkbox("Use", value=it["include"], key=f"inc_{item_id}")
        cols[4].button("⬆", key=f"up_{item_id}", on_click=move, args=(item_id, -1))
        cols[5].button("⬇", key=f"dn_{item_id}", on_click=move, args=(item_id, 1))


def section_manual() -> None:
    items, order = state_items(), state_order()
    st.subheader("3 · Fix faces (optional)")
    missing = [i for i in order if not usable(items[i])]
    if missing:
        st.warning(f"{len(missing)} photo(s) have no detectable face. Place the eyes by hand "
                   "below, or leave them – they will be skipped automatically.")
    with st.expander("Place eyes manually", expanded=bool(missing)):
        default = missing[0] if missing else order[0]
        pick = st.selectbox("Photo", order, index=order.index(default),
                            format_func=lambda i: items[i]["name"])
        it = items[pick]
        h, w = it["size"]
        if it["manual"] is not None:
            (lx, ly), (rx, ry) = it["manual"]
            d = [lx / w, ly / h, rx / w, ry / h]
        elif it["landmarks"] is not None:
            from vision import eye_centers
            l, r = eye_centers(it["landmarks"])
            d = [l[0] / w, l[1] / h, r[0] / w, r[1] / h]
        else:
            d = [0.35, 0.40, 0.65, 0.40]
        c = st.columns(4)
        lx = c[0].slider("Left eye X %", 0.0, 100.0, d[0] * 100, 0.5, key=f"lx_{pick}")
        ly = c[1].slider("Left eye Y %", 0.0, 100.0, d[1] * 100, 0.5, key=f"ly_{pick}")
        rx = c[2].slider("Right eye X %", 0.0, 100.0, d[2] * 100, 0.5, key=f"rx_{pick}")
        ry = c[3].slider("Right eye Y %", 0.0, 100.0, d[3] * 100, 0.5, key=f"ry_{pick}")
        img = io_utils.load_image(it["data"], 900)
        ih, iw = img.shape[:2]
        for x, y in ((lx, ly), (rx, ry)):
            cv2.circle(img, (int(x / 100 * iw), int(y / 100 * ih)), max(4, iw // 100),
                       (0, 255, 0), 2, cv2.LINE_AA)
        st.image(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), width=480)
        b1, b2, _ = st.columns([1, 1, 3])
        if b1.button("Save eye positions", key=f"save_{pick}"):
            it["manual"] = ((lx / 100 * w, ly / 100 * h), (rx / 100 * w, ry / 100 * h))
            st.rerun()
        if it["manual"] is not None and b2.button("Clear override", key=f"clr_{pick}"):
            it["manual"] = None
            st.rerun()


def build_slides(captions: bool) -> tuple[list[Slide], list[str]]:
    items = state_items()
    slides, skipped = [], []
    for i in state_order():
        it = items[i]
        if not it["include"]:
            continue
        if not usable(it):
            skipped.append(it["name"])
            continue
        cap = str(it["date"].year) if captions and it["date"] else None
        slides.append(Slide(it["name"], it["data"], it["landmarks"], it["manual"], cap))
    return slides, skipped


@st.cache_data(show_spinner=False, max_entries=512)
def cached_preview(item_id, spec: AlignmentSpec, lm_key, manual, caption, _slide: Slide):
    face = prepare_slide(_slide, spec)
    return cv2.cvtColor(face.image, cv2.COLOR_BGR2RGB), face.scale


def main() -> None:
    st.title("🎞️ Age Progression Video Maker")
    st.caption("Upload photos from different ages → eyes are locked to the same spot → "
               "smooth morph timelapse MP4.")

    st.subheader("1 · Upload photos")
    files = st.file_uploader("Photos (JPG, PNG, WEBP, HEIC)", accept_multiple_files=True,
                             type=["jpg", "jpeg", "png", "webp", "bmp", "heic", "heif"])
    sync_uploads(files or [])
    if not state_order():
        st.info("Upload at least two photos with a visible face to begin.")
        return

    section_order()
    section_manual()

    st.subheader("4 · Settings")
    c = st.columns(4)
    hold_s = c[0].slider("Seconds per photo", 0.3, 5.0, 1.0, 0.1)
    trans_s = c[1].slider("Transition length (s)", 0.0, 3.0, 0.8, 0.1)
    fps = c[2].select_slider("Frame rate", [24, 30, 60], value=30)
    style = c[3].radio("Transition", ["morph", "crossfade"], horizontal=True,
                       format_func=lambda s: "Landmark morph" if s == "morph" else "Cross-dissolve")
    c = st.columns(4)
    aspect = c[0].selectbox("Aspect ratio", list(ASPECTS), index=1)
    res = c[1].selectbox("Resolution", list(HEIGHTS), index=1)
    eye_dist = c[2].slider("Face size (eye distance)", 0.10, 0.40, 0.22, 0.01,
                           help="Fraction of frame height between the eyes.")
    eye_y = c[3].slider("Eye height", 0.25, 0.60, 0.40, 0.01,
                        help="Vertical eye position, as a fraction from the top.")
    captions = st.checkbox("Show the year (from capture date) as a caption", value=False)

    ar_w, ar_h = ASPECTS[aspect]
    out_h = HEIGHTS[res]
    out_w = round(out_h * ar_w / ar_h) // 2 * 2
    spec = AlignmentSpec(out_w, out_h, eye_dist, eye_y)

    slides, skipped = build_slides(captions)
    if skipped:
        st.warning("Skipping (no face, no manual eyes): " + ", ".join(skipped))
    if len(slides) < 2:
        st.info("Need at least two usable photos to build a video.")
        return

    st.markdown("**Alignment preview** – the eyes should sit on the same spot in every tile.")
    prev_spec = spec.scaled(240 / spec.out_h)
    ids = [i for i in state_order() if items_ok(i)]
    cols = st.columns(min(len(slides), 6))
    for n, (sl, item_id) in enumerate(zip(slides, ids)):
        rgb, scale = cached_preview(item_id, prev_spec, sl.landmarks is not None, sl.manual_eyes,
                                    sl.caption, sl)
        full_scale = scale * spec.out_h / prev_spec.out_h
        cap = sl.name + ("  ⚠️ upscaled, may be soft" if full_scale > 2.5 else "")
        cols[n % len(cols)].image(rgb, caption=cap, use_container_width=True)

    est = total_frames(len(slides), max(1, round(hold_s * fps)), round(trans_s * fps)) / fps
    st.write(f"**{len(slides)} photos → about {est:.1f} s of video** ({out_w}×{out_h}, {fps} fps)")

    if st.button("🎬 Create video", type="primary"):
        bar = st.progress(0.0, "Starting…")
        path = os.path.join(tempfile.mkdtemp(), "age_progression.mp4")
        try:
            render_video(slides, path, spec, hold_s, trans_s, fps, style,
                         progress=lambda p, msg: bar.progress(min(p, 1.0), msg))
        except Exception as exc:
            bar.empty()
            st.error(f"Rendering failed: {exc}")
            return
        bar.progress(1.0, "Done")
        with open(path, "rb") as fh:
            st.session_state["video"] = fh.read()
            st.session_state["video_ts"] = datetime.now().strftime("%Y%m%d_%H%M%S")

    if "video" in st.session_state:
        st.video(st.session_state["video"], format="video/mp4")
        st.download_button("⬇️ Download MP4", st.session_state["video"],
                           file_name=f"age_progression_{st.session_state['video_ts']}.mp4",
                           mime="video/mp4")


def items_ok(item_id: str) -> bool:
    it = state_items()[item_id]
    return it["include"] and usable(it)


main()
