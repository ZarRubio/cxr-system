import io
from pathlib import Path

import numpy as np
import streamlit as st
from PIL import Image, ImageDraw, ImageFilter, ImageOps

_DEMO_DIR = Path(__file__).resolve().parent.parent / "demo_images"

_DEMO_CASES = [
    {
        "key": "normal",
        "label": "Normal",
        "filename": "demo_normal.png",
        "help": "Placa sintetica sin hallazgos evidentes.",
    },
    {
        "key": "cardiomegaly",
        "label": "Cardiomegalia",
        "filename": "demo_cardiomegaly.png",
        "help": "Silueta cardiaca aumentada para flujo de demostracion.",
    },
    {
        "key": "effusion",
        "label": "Derrame pleural",
        "filename": "demo_effusion.png",
        "help": "Opacidad basal compatible con ejemplo de derrame.",
    },
    {
        "key": "infiltration",
        "label": "Infiltrado",
        "filename": "demo_infiltration.png",
        "help": "Opacidad pulmonar parcheada para explicar el flujo.",
    },
]


def _ellipse_mask(
    yy: np.ndarray,
    xx: np.ndarray,
    center_y: float,
    center_x: float,
    radius_y: float,
    radius_x: float,
) -> np.ndarray:
    return ((yy - center_y) / radius_y) ** 2 + ((xx - center_x) / radius_x) ** 2 < 1


def _soft_blob(
    yy: np.ndarray,
    xx: np.ndarray,
    center_y: float,
    center_x: float,
    radius_y: float,
    radius_x: float,
) -> np.ndarray:
    dist = ((yy - center_y) / radius_y) ** 2 + ((xx - center_x) / radius_x) ** 2
    return np.clip(1.0 - dist, 0, 1)


def _draw_curve(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: int, width: int) -> None:
    if len(points) > 1:
        draw.line(points, fill=fill, width=width, joint="curve")


def _add_bony_detail(img: Image.Image, size: int) -> Image.Image:
    draw = ImageDraw.Draw(img)
    cx = size // 2

    # Spine and mediastinal line.
    draw.rounded_rectangle(
        [cx - int(size * 0.018), int(size * 0.11), cx + int(size * 0.018), int(size * 0.88)],
        radius=int(size * 0.01),
        fill=92,
    )
    for y in range(int(size * 0.16), int(size * 0.84), int(size * 0.055)):
        draw.line([cx - int(size * 0.03), y, cx + int(size * 0.03), y], fill=125, width=1)

    # Clavicles.
    for sign in (-1, 1):
        points = [
            (cx + sign * int(size * 0.03), int(size * 0.18)),
            (cx + sign * int(size * 0.16), int(size * 0.15)),
            (cx + sign * int(size * 0.34), int(size * 0.19)),
        ]
        _draw_curve(draw, points, fill=150, width=max(2, int(size * 0.012)))

    # Rib arcs.
    for sign in (-1, 1):
        for i, y0 in enumerate(np.linspace(0.25, 0.74, 7)):
            y = int(size * y0)
            x_start = cx + sign * int(size * 0.04)
            x_end = cx + sign * int(size * (0.31 + i * 0.005))
            points = []
            steps = 32
            for step in range(steps):
                t = step / (steps - 1)
                x = int(x_start + (x_end - x_start) * t)
                bow = np.sin(t * np.pi) * int(size * (0.035 + i * 0.002))
                yy = int(y + bow + step * 0.7)
                points.append((x, yy))
            _draw_curve(draw, points, fill=134, width=max(1, int(size * 0.006)))

    return img.filter(ImageFilter.GaussianBlur(radius=0.45))


def _generate_synthetic_cxr(case: str, size: int = 512) -> Image.Image:
    """Generate a synthetic CXR-like PNG for demo flow only, not diagnosis."""
    seeds = {"normal": 42, "cardiomegaly": 7, "effusion": 13, "infiltration": 21}
    rng = np.random.default_rng(seed=seeds.get(case, 0))

    yy, xx = np.mgrid[:size, :size]
    cy, cx = size * 0.52, size * 0.50

    vertical = np.linspace(16, 34, size, dtype=np.float32)[:, None]
    canvas = np.repeat(vertical, size, axis=1)

    # Collimated AP-style vignette.
    vignette = _soft_blob(yy, xx, size * 0.53, size * 0.50, size * 0.62, size * 0.45)
    canvas += 22 * vignette

    lung_masks = []
    lung_texture = np.zeros_like(canvas)
    for sign in (-1, 1):
        lung = _ellipse_mask(
            yy,
            xx,
            cy - size * 0.06,
            cx + sign * size * 0.19,
            size * 0.34,
            size * 0.145,
        )
        apex = _ellipse_mask(
            yy,
            xx,
            cy - size * 0.30,
            cx + sign * size * 0.16,
            size * 0.16,
            size * 0.11,
        )
        lung = lung | apex
        lung_masks.append(lung)

        airway_gradient = 58 + 30 * (1 - np.abs(xx - (cx + sign * size * 0.20)) / (size * 0.24))
        lung_texture[lung] = airway_gradient[lung]

        # Hilar density.
        hilum = _soft_blob(yy, xx, cy - size * 0.03, cx + sign * size * 0.095, size * 0.12, size * 0.075)
        lung_texture += hilum * 28

    lungs = lung_masks[0] | lung_masks[1]
    canvas[lungs] = np.maximum(canvas[lungs], lung_texture[lungs])

    # Mediastinum and heart.
    heart_width = 0.25 if case == "cardiomegaly" else 0.165
    heart = _soft_blob(yy, xx, cy + size * 0.12, cx - size * 0.025, size * 0.23, size * heart_width)
    mediastinum = _soft_blob(yy, xx, cy - size * 0.12, cx, size * 0.34, size * 0.085)
    canvas += heart * 65 + mediastinum * 42

    # Diaphragms.
    for sign in (-1, 1):
        base = _soft_blob(yy, xx, size * 0.82, cx + sign * size * 0.20, size * 0.09, size * 0.22)
        canvas += base * 34

    if case == "effusion":
        effusion_side = lung_masks[0]
        meniscus = effusion_side & (yy > size * 0.64)
        opacity = _soft_blob(yy, xx, size * 0.78, cx - size * 0.19, size * 0.16, size * 0.18)
        canvas[meniscus] += 68
        canvas += opacity * 46

    if case == "infiltration":
        for center_y, center_x, ry, rx, strength in [
            (size * 0.46, cx + size * 0.18, size * 0.085, size * 0.07, 58),
            (size * 0.55, cx + size * 0.23, size * 0.07, size * 0.06, 46),
            (size * 0.42, cx - size * 0.17, size * 0.055, size * 0.05, 34),
        ]:
            blob = _soft_blob(yy, xx, center_y, center_x, ry, rx)
            mottled = blob * (0.75 + 0.25 * rng.random(canvas.shape))
            canvas += mottled * strength

    # Slight scapular shadows and detector noise.
    for sign in (-1, 1):
        scapula = _soft_blob(yy, xx, size * 0.34, cx + sign * size * 0.34, size * 0.20, size * 0.10)
        canvas += scapula * 22

    canvas += rng.normal(0, 5.2, canvas.shape)
    canvas = np.clip(canvas, 0, 255).astype(np.uint8)

    img = Image.fromarray(canvas, mode="L")
    img = _add_bony_detail(img, size)
    img = ImageOps.autocontrast(img, cutoff=0.8)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.55))

    # Mild border/collimator frame.
    framed = Image.new("L", (size, size), 8)
    framed.paste(img, (0, 0))
    draw = ImageDraw.Draw(framed)
    draw.rectangle([10, 10, size - 10, size - 10], outline=36, width=2)
    return framed


@st.cache_data(show_spinner=False)
def _load_demo_bytes(case_info: dict) -> bytes:
    path = _DEMO_DIR / case_info["filename"]
    if path.exists() and path.stat().st_size > 1:
        return path.read_bytes()

    img = _generate_synthetic_cxr(case_info["key"])
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_demo_loader() -> tuple[bytes | None, str | None]:
    st.markdown(
        '<div class="demo-loader-label">O elige una imagen de demostracion:</div>',
        unsafe_allow_html=True,
    )

    cols = st.columns(len(_DEMO_CASES))
    for col, case in zip(cols, _DEMO_CASES):
        img_bytes = _load_demo_bytes(case)
        with col:
            st.image(img_bytes, width="stretch")
            if st.button(
                case["label"],
                key=f"demo_{case['key']}",
                width="stretch",
                help=case["help"],
            ):
                st.session_state["demo_selection"] = (img_bytes, case["filename"])

    sel = st.session_state.get("demo_selection")
    if sel:
        img_bytes, fname = sel
        label = next(
            (c["label"] for c in _DEMO_CASES if c["filename"] == fname),
            fname,
        )
        st.caption(
            f"Demo activa: **{label}** (`{fname}`) - imagen sintetica representativa. "
            "No diagnostica."
        )
        return img_bytes, fname

    return None, None
