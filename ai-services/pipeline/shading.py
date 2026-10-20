"""
TataVision — Stage 3: depth-aware PENCIL shading
================================================

Turns a photo into a graphite-pencil shading study with clearly visible dark values.
Depth Anything V2 gives a relative depth map, and that depth is used in four ways:

  1. FORM LIGHTING   – surface normals are derived from the depth map and lit from a fixed direction
                       (default: top-left), so shading follows the 3-D shape instead of just photo brightness.
  2. CONTACT SHADOWS – "ambient occlusion": places that sit deeper than their surroundings
                       (creases, under chins, between objects) get an extra dark accent.
  3. ATMOSPHERE      – distant areas are lifted toward the paper, near areas keep full contrast.
  4. BENDING STROKES – hatch lines are shifted by the depth map, so strokes follow contours of the
                       form and jump at depth edges (reads as separate planes, like a real drawing).

The pencil look is built in layers, exactly like a drawing is built by hand:
  stage 1  smooth graphite wash (blended tone)
  stage 2  light hatching
  stage 3  cross-hatching
  stage 4  denser hatching in the shadows
  stage 5  darkest accents (near-solid graphite)       -> then depth-edge contour lines + paper grain

Public API is unchanged:  generate_shading(input_path, curve_path, output_path, temporary_directory, ...)
and all the old preview files are still written (01 … 06), plus 07/08 as extras.
"""
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn.functional as F
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
except Exception:                                   # torch missing → the luminance-based fallback depth is used
    torch, F, DEVICE = None, None, None

MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"

_depth_processor = None
_depth_model = None
_model_lock = Lock()


# ════════════════════════════════════════════════════════════════════════════
# small helpers
# ════════════════════════════════════════════════════════════════════════════
def _blur(a, sigma):
    return cv2.GaussianBlur(a.astype(np.float32), (0, 0), max(0.3, float(sigma)))


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-9), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _lerp(a, b, t):
    return a + (b - a) * t


def robust_normalize(array, low_percentile=2.0, high_percentile=98.0):
    array = np.asarray(array, dtype=np.float32)
    finite = np.isfinite(array)
    if not finite.any():
        return np.zeros_like(array, dtype=np.float32)

    finite_values = array[finite]
    low, high = np.percentile(finite_values, [low_percentile, high_percentile])
    if high <= low:
        return np.zeros_like(array, dtype=np.float32)

    cleaned = np.nan_to_num(array, nan=float((low + high) * 0.5),
                            posinf=float(high), neginf=float(low))
    return np.clip((cleaned - low) / (high - low), 0.0, 1.0).astype(np.float32)


def save_grayscale(output_path, image_array):
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image_array = np.asarray(image_array, dtype=np.float32)
    image_array = np.nan_to_num(image_array, nan=1.0, posinf=1.0, neginf=0.0)
    Image.fromarray(np.clip(image_array * 255.0 + 0.5, 0, 255).astype(np.uint8)).save(output_path)


# ════════════════════════════════════════════════════════════════════════════
# depth
# ════════════════════════════════════════════════════════════════════════════
def get_depth_model():
    """Load Depth Anything V2 once and reuse it."""
    global _depth_processor, _depth_model
    if _depth_processor is not None and _depth_model is not None:
        return _depth_processor, _depth_model
    with _model_lock:
        if _depth_processor is None or _depth_model is None:
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation
            print("Loading Depth Anything V2 on:", DEVICE)
            _depth_processor = AutoImageProcessor.from_pretrained(MODEL_ID, use_fast=False)
            _depth_model = AutoModelForDepthEstimation.from_pretrained(MODEL_ID).to(DEVICE).eval()
            print("Depth model loaded:", MODEL_ID)
    return _depth_processor, _depth_model


def predict_depth(reference_image):
    """Relative depth in 0..1 where 1 = NEAR (Depth Anything predicts inverse depth)."""
    processor, model = get_depth_model()
    inputs = processor(images=reference_image, return_tensors="pt")
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
    with torch.inference_mode():
        predicted = model(**inputs).predicted_depth
    predicted = F.interpolate(predicted.unsqueeze(1), size=(reference_image.height, reference_image.width),
                              mode="bicubic", align_corners=False)
    return robust_normalize(predicted.squeeze().float().cpu().numpy())


def fallback_depth(luminance):
    """Used only if the depth model cannot load (offline / no torch): bottom of the picture = nearer,
    plus a little of the blurred tone. Not real depth, but keeps the pipeline working."""
    h, w = luminance.shape
    ramp = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None] * np.ones((1, w), np.float32)
    tone = 1.0 - _blur(luminance, 0.02 * max(h, w))
    return robust_normalize(0.65 * ramp + 0.35 * tone)


# ════════════════════════════════════════════════════════════════════════════
# depth → geometry cues
# ════════════════════════════════════════════════════════════════════════════
def create_luminance_map(reference_image):
    rgb = np.asarray(reference_image, dtype=np.uint8)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0


def compute_form_lighting(height, azimuth_deg=135.0, elevation_deg=50.0, relief=1.2):
    """Lambert shading of the surface implied by the depth map. 1 = lit, 0 = in shadow.
    azimuth 135° = light from the top-left (the classic drawing setup)."""
    h, w = height.shape
    hs = _blur(height, 0.004 * max(h, w))
    gy, gx = np.gradient(hs)
    k = relief * w                                     # depth change per image width → tilt strength
    gx, gy = np.clip(gx * k, -6, 6), np.clip(gy * k, -6, 6)
    n = np.dstack([-gx, -gy, np.ones_like(gx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    az, el = np.radians(azimuth_deg), np.radians(elevation_deg)
    light = np.array([np.cos(el) * np.cos(az), -np.cos(el) * np.sin(az), np.sin(el)], np.float32)
    lambert = np.clip(n @ light, 0.0, 1.0)
    return robust_normalize(lambert, 1, 99)


def compute_occlusion(height):
    """Contact shadows: pixels that are farther away than their surroundings (creases, gaps)."""
    s = max(height.shape)
    ao = 0.6 * np.clip(_blur(height, 0.012 * s) - height, 0, None) \
       + 0.4 * np.clip(_blur(height, 0.050 * s) - height, 0, None)
    return robust_normalize(ao, 50, 99)


def compute_depth_edges(height):
    """Strong depth discontinuities (silhouettes) → used for thin contour lines."""
    hs = _blur(height, 0.002 * max(height.shape) + 0.8)
    gy, gx = np.gradient(hs)
    mag = np.hypot(gx, gy)
    ref = np.percentile(mag, 99) + 1e-9
    return _smoothstep(0.30, 0.75, mag / ref)


# ════════════════════════════════════════════════════════════════════════════
# tone map
# ════════════════════════════════════════════════════════════════════════════
def create_depth_aware_shading(luminance, depth_map, lighting, occlusion, depth_weight=0.30,
                               ao_strength=0.55, atmosphere=0.25, contrast=1.25):
    """Fuse photo tone + depth-lit form + contact shadows + atmosphere → final tone map (0 = black, 1 = paper)."""
    luminance = np.nan_to_num(np.asarray(luminance, dtype=np.float32), nan=1.0, posinf=1.0, neginf=0.0)
    depth_map = np.nan_to_num(np.asarray(depth_map, dtype=np.float32), nan=0.5, posinf=1.0, neginf=0.0)
    lighting = np.nan_to_num(np.asarray(lighting, dtype=np.float32), nan=1.0, posinf=1.0, neginf=0.0)
    occlusion = np.nan_to_num(np.asarray(occlusion, dtype=np.float32), nan=0.0, posinf=1.0, neginf=0.0)
    lum8 = np.clip(luminance * 255, 0, 255).astype(np.uint8)
    lum = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lum8).astype(np.float32) / 255.0

    depth_weight = float(np.clip(depth_weight, 0.0, 1.0))
    tone = (1.0 - depth_weight) * lum + depth_weight * lighting
    tone *= 1.0 - float(ao_strength) * occlusion

    far = (1.0 - depth_map) ** 1.5                     # 0 near … 1 far
    a = float(np.clip(atmosphere, 0, 1)) * far
    tone = tone * (1.0 - a) + a * 0.92                 # far areas fade toward the paper

    tone = np.nan_to_num(tone, nan=0.92, posinf=1.0, neginf=0.0)
    tone = cv2.bilateralFilter(tone.astype(np.float32), 9, 0.12, 6.0)
    finite_tone = tone[np.isfinite(tone)]
    if finite_tone.size == 0:
        tone = np.clip(lum, 0.0, 1.0)
    else:
        lo, hi = np.percentile(finite_tone, [1.0, 99.5])
        if hi > lo + 1e-6:
            tone = np.clip((tone - lo) / (hi - lo), 0, 1)
        else:
            # A flat/near-flat tone should remain visible instead of becoming an all-black image.
            tone = np.clip(tone, 0.0, 1.0)
    return np.nan_to_num(np.power(tone, float(contrast)), nan=0.92, posinf=1.0, neginf=0.0).astype(np.float32)


def quantize_shading(shading, tone_levels=6):
    tone_levels = max(2, int(tone_levels))
    return np.clip(np.round(shading * (tone_levels - 1)) / (tone_levels - 1), 0, 1).astype(np.float32)


# ════════════════════════════════════════════════════════════════════════════
# pencil layers
# ════════════════════════════════════════════════════════════════════════════
def _noise_field(shape, sigma, rng):
    n = _blur(rng.standard_normal(shape).astype(np.float32), sigma)
    return n / (n.std() + 1e-9)                         # zero mean, unit variance


def _graphite_tooth(shape, rng):
    """Paper grain: graphite only sticks to the raised fibres → fine speckle inside every stroke."""
    n = _noise_field(shape, 0.8, rng)
    return np.clip(0.80 + 0.14 * n, 0.45, 1.0).astype(np.float32)


def wash_layer(tone, tooth, opacity=0.55):
    """Stage 1: soft blended graphite (like smudging with a stump)."""
    t = _blur(tone, 1.5)
    dark = np.clip((0.95 - t) / 0.95, 0, 1) ** 1.15
    return 1.0 - opacity * dark * tooth


def hatch_layer(tone, xx, yy, depth_s, angle_deg, period, threshold, softness, opacity,
                tooth, wobble, stroke_noise, rng, depth_bend=1.0, accent=False):
    """One pass of parallel pencil strokes. Stroke WIDTH grows with darkness (thin in light areas,
    merging into solid graphite in the darkest), and strokes bend with the depth map."""
    th = np.radians(angle_deg)
    u = xx * np.cos(th) + yy * np.sin(th)
    u = u + wobble * 0.5 * period + depth_s * depth_bend * period     # hand wobble + depth-following bend
    q = u / period
    line_id = np.floor(q).astype(np.int32)
    frac = q - line_id
    table = rng.random(int(line_id.max() - line_id.min()) + 1).astype(np.float32)
    pressure = 0.72 + 0.28 * table[line_id - line_id.min()]           # every stroke pressed a bit differently

    darkness = np.clip((threshold - tone) / softness, 0.0, 1.0)
    half_width = darkness * 1.1 * 0.5 * period * (0.9 + 0.1 * pressure)
    dist = np.abs(frac - 0.5) * period
    ink = np.clip(half_width - dist + 0.5, 0.0, 1.0)                  # +0.5 px = anti-aliasing
    ink *= np.clip(darkness * 8.0, 0, 1)                              # nothing where the tone is lighter than the layer
    ink *= pressure * np.clip(0.85 + 0.15 * stroke_noise, 0.55, 1.15) * tooth
    shade = 1.0 - opacity * np.clip(ink, 0, 1)

    if accent:                                                        # darkest accents: almost solid graphite
        deep = _smoothstep(0.16, 0.03, tone)
        shade *= 1.0 - 0.55 * deep * tooth
    return shade


# ════════════════════════════════════════════════════════════════════════════
# main entry point
# ════════════════════════════════════════════════════════════════════════════
def generate_shading(input_path, curve_path, output_path, temporary_directory,
                     shading_scale=5,                 # kept for pipeline compatibility (unused)
                     depth_weight=0.30,               # share of depth-lit form in the tone (0 = photo only, 1 = depth only)
                     invert_depth=False,              # True if near/far look swapped for your photos
                     tone_levels=6,
                     number_of_stages=5,
                     add_pencil_hatching=True,
                     hatching_spacing=8,              # stroke spacing in px for a ~1024 px image (auto-scales with size)
                     light_azimuth=135.0,             # 135 = light from top-left
                     light_elevation=50.0,
                     relief=1.2,                      # how strongly depth bends the lighting
                     contrast=1.25,                   # >1 = darker darks
                     atmosphere=0.25,                 # 0..1 – fade of distant areas
                     ao_strength=0.55,                # contact-shadow strength
                     contour_strength=0.6,            # depth-edge outline strength (0 = off)
                     band_strength=0.35,              # 0 = smooth tone, 1 = hard value bands from tone_levels
                     seed=7):
    """
    Depth-aware pencil shading. Writes the main output to `output_path` and all step images to
    <output dir>/shading_steps/. curve_path / shading_scale are accepted only for compatibility.
    """
    print("\n[Stage 3] Depth-aware pencil shading started")
    _ = curve_path, shading_scale
    input_path, output_path = Path(input_path), Path(output_path)
    temporary_directory = Path(temporary_directory)
    if not input_path.is_file():
        raise FileNotFoundError(f"Input image not found: {input_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_directory.mkdir(parents=True, exist_ok=True)
    steps_dir = output_path.parent / "shading_steps"
    steps_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(input_path) as src:
        reference = src.convert("RGB").copy()
    w, h = reference.size
    print("Input resolution:", reference.size)
    rng = np.random.default_rng(seed)

    # ── depth ───────────────────────────────────────────────────────────
    luminance = np.nan_to_num(create_luminance_map(reference), nan=1.0, posinf=1.0, neginf=0.0)
    try:
        depth = predict_depth(reference)
        depth_source = "depth_anything_v2"
        print("Relative depth generated.")
    except Exception as e:
        print(f"[Stage 3] WARNING: depth model unavailable ({type(e).__name__}: {str(e)[:100]}) → using fallback depth.")
        depth = fallback_depth(luminance)
        depth_source = "fallback"
    if invert_depth:
        depth = 1.0 - depth
    depth = np.nan_to_num(_blur(depth, 0.0015 * max(h, w)), nan=0.5, posinf=1.0, neginf=0.0)  # near = 1

    # ── geometry cues + tone ────────────────────────────────────────────
    lighting = compute_form_lighting(depth, light_azimuth, light_elevation, relief)
    occlusion = compute_occlusion(depth)
    fused = create_depth_aware_shading(luminance, depth, lighting, occlusion, depth_weight,
                                       ao_strength, atmosphere, contrast)
    if np.nanmax(fused) <= 1e-4 and np.nanmax(luminance) > 1e-4:
        # Keep the stage useful when a depth/lighting backend returns a valid-sized
        # but degenerate all-zero map. The source luminance is still a valid drawing tone.
        fused = np.clip(luminance, 0.0, 1.0).astype(np.float32)
    quantized = quantize_shading(fused, tone_levels)
    band = float(np.clip(band_strength, 0, 1))
    tone = (1.0 - band) * fused + band * _blur(quantized, 1.2)    # tone that the pencil layers actually follow
    tone = np.nan_to_num(tone, nan=0.92, posinf=1.0, neginf=0.0).astype(np.float32)

    # ── pencil layers ───────────────────────────────────────────────────
    n_layers = max(2, int(number_of_stages))
    scale = max(h, w) / 1024.0
    base_period = max(3.0, float(hatching_spacing) * scale)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    tooth = _graphite_tooth((h, w), rng)
    wobble = _noise_field((h, w), base_period * 3.0, rng)
    stroke_noise = _noise_field((h, w), base_period * 5.0, rng)

    layers = [wash_layer(tone, tooth)]
    if add_pencil_hatching:
        angles = [45, -45, 75, 15, -20, 60]
        for k in range(n_layers - 1):
            t = k / max(1, n_layers - 2)
            layers.append(hatch_layer(
                tone, xx, yy, depth, angles[k % len(angles)],
                period=base_period * _lerp(1.0, 0.6, t), threshold=_lerp(0.88, 0.26, t),
                softness=_lerp(0.28, 0.14, t), opacity=_lerp(0.50, 0.88, t),
                tooth=tooth, wobble=wobble, stroke_noise=stroke_noise, rng=rng,
                accent=(k == n_layers - 2)))
    else:                                                # pad so the stage count stays the same
        layers += [np.ones_like(tone)] * (n_layers - 1)

    stages, running = [], np.ones_like(tone)
    for layer in layers:
        running = running * layer
        stages.append(running.copy())

    # ── finishing: depth-edge contours (silhouettes pop forward) ────────
    final = stages[-1].copy()
    if contour_strength > 0:
        edges = compute_depth_edges(depth) * np.clip(tooth + 0.1, 0, 1)
        final *= 1.0 - float(np.clip(contour_strength, 0, 1)) * 0.75 * edges
    final = np.clip(final, 0, 1)

    # ── save ────────────────────────────────────────────────────────────
    save_grayscale(steps_dir / "01_luminance.png", luminance)
    save_grayscale(steps_dir / "02_relative_depth.png", depth)
    save_grayscale(steps_dir / "03_fused_shading.png", fused)
    save_grayscale(steps_dir / "04_quantized_shading.png", quantized)
    for i, stg in enumerate(stages, start=1):
        save_grayscale(steps_dir / f"05_stage_{i}.png", stg)
    save_grayscale(steps_dir / "06_hatched_shading.png", final)
    save_grayscale(steps_dir / "07_form_lighting.png", lighting)
    save_grayscale(steps_dir / "08_contact_shadows.png", 1.0 - occlusion)
    save_grayscale(output_path, final)

    expected = (["01_luminance.png", "02_relative_depth.png", "03_fused_shading.png", "04_quantized_shading.png"]
                + [f"05_stage_{i}.png" for i in range(1, n_layers + 1)]
                + ["06_hatched_shading.png", "07_form_lighting.png", "08_contact_shadows.png"])
    missing = [f for f in expected if not (steps_dir / f).is_file()]
    if missing or not output_path.is_file():
        raise RuntimeError("Shading output incomplete: " + ", ".join(missing or [str(output_path)]))

    print("[Stage 3] Main shading saved:", output_path)
    print("[Stage 3] Shading previews saved:", steps_dir)
    return {"main_output": str(output_path), "preview_directory": str(steps_dir),
            "preview_files": expected, "depth_source": depth_source}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Depth-aware pencil shading")
    ap.add_argument("image"); ap.add_argument("-o", "--output", default="shading_out/shading.png")
    ap.add_argument("--invert-depth", action="store_true")
    a = ap.parse_args()
    print(generate_shading(a.image, None, a.output, Path(a.output).parent / "tmp", invert_depth=a.invert_depth))
