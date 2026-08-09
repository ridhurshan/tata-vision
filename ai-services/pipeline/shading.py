import os
import cv2
import numpy as np

from sketchify import sketch


# ============================================================
# GENERATE SHADED PENCIL SKETCH
# ============================================================

def generate_shading(
    input_path,
    curve_path,
    output_path,
    temporary_directory,
    shading_scale=5,
    dodge_blur_ksize=25,
    dodge_weight=0.55,
    clahe_clip_limit=2.5,
    clahe_tile_grid=(8, 8),
    gamma=0.85,
    grain_strength=10,
    line_softness=1,
    line_blend="multiply"
):
    """
    dodge_blur_ksize : bigger = softer, more diffuse shading gradients
    dodge_weight      : 0..1, how much of the final tone comes from the
                         dodge pass vs. the sketchify pass
    clahe_clip_limit  : higher = punchier local contrast (darker darks,
                         brighter lights) - this is what makes it read
                         as "shaded" instead of "flat gray"
    gamma             : <1 brightens midtones, >1 darkens them
    grain_strength    : 0 = no grain, ~5-15 = subtle pencil tooth,
                         20+ = heavy sketchy texture
    line_softness     : gaussian blur radius applied to the curve layer
                         before blending, so lines don't look pasted on
    line_blend        : "multiply" (recommended, preserves shading under
                         lines) or "minimum" (old hard-cut behaviour)
    """

    print(
        "\n[Stage 3] Pencil shading started"
    )

    # ========================================================
    # READ ORIGINAL COLOURED IMAGE
    # ========================================================

    image_bgr = cv2.imread(
        input_path
    )

    if image_bgr is None:
        raise ValueError(
            f"Could not read original image: {input_path}"
        )

    # ========================================================
    # CREATE TEMPORARY DIRECTORY
    # ========================================================

    os.makedirs(
        temporary_directory,
        exist_ok=True
    )

    shading_input_path = os.path.join(
        temporary_directory,
        "shading_model_input.png"
    )

    shading_output_folder = os.path.join(
        temporary_directory,
        "shading_output"
    )

    shading_output_name = (
        "pencil_shading"
    )

    os.makedirs(
        shading_output_folder,
        exist_ok=True
    )

    # ========================================================
    # SAVE ORIGINAL COLOURED IMAGE FOR SKETCHIFY
    # ========================================================

    success = cv2.imwrite(
        shading_input_path,
        image_bgr
    )

    if not success:
        raise IOError(
            "Could not save shading input."
        )

    print(
        "Shading input prepared:",
        shading_input_path
    )

    # ========================================================
    # RUN SKETCHIFY (existing model-based shading pass)
    # ========================================================

    sketch.normalsketch(
        shading_input_path,
        shading_output_folder,
        shading_output_name,
        scale=shading_scale
    )

    print(
        "Sketchify pencil shading generated."
    )

    shading_generated_path = os.path.join(
        shading_output_folder,
        shading_output_name + ".png"
    )

    sketchify_shading = cv2.imread(
        shading_generated_path,
        cv2.IMREAD_GRAYSCALE
    )

    if sketchify_shading is None:
        raise ValueError(
            "Could not load generated pencil shading."
        )

    # ========================================================
    # LOAD STAGE 2 CURVES
    # ========================================================

    final_outline_curves = cv2.imread(
        curve_path,
        cv2.IMREAD_GRAYSCALE
    )

    if final_outline_curves is None:
        raise ValueError(
            f"Could not read curve image: {curve_path}"
        )

    target_h, target_w = final_outline_curves.shape

    # ========================================================
    # MATCH IMAGE SIZES (shading + a same-size grayscale of
    # the original, needed for the dodge pass below)
    # ========================================================

    if sketchify_shading.shape != (target_h, target_w):
        sketchify_shading = cv2.resize(
            sketchify_shading,
            (target_w, target_h),
            interpolation=cv2.INTER_AREA
        )

    original_gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    if original_gray.shape != (target_h, target_w):
        original_gray = cv2.resize(
            original_gray,
            (target_w, target_h),
            interpolation=cv2.INTER_AREA
        )

    # ========================================================
    # PASS 1: CLASSIC "DODGE" PENCIL SHADING
    # --------------------------------------------------------
    # This is the technique real pencil-sketch filters use.
    # It derives light/shadow directly from the photo's own
    # tonal structure, which is what gives it the soft,
    # gradual light-to-dark falloff of an actual drawing,
    # rather than a uniformly filtered gray.
    # ========================================================

    inverted_gray = 255 - original_gray

    k = dodge_blur_ksize if dodge_blur_ksize % 2 == 1 else dodge_blur_ksize + 1
    blurred_inverted = cv2.GaussianBlur(inverted_gray, (k, k), 0)

    dodge_shading = cv2.divide(
        original_gray,
        255 - blurred_inverted,
        scale=256.0
    )

    # ========================================================
    # BLEND SKETCHIFY OUTPUT + DODGE SHADING
    # --------------------------------------------------------
    # sketchify contributes its learned stroke/shading style,
    # dodge contributes accurate light/dark placement. Blending
    # both keeps the model's style while fixing flatness.
    # ========================================================

    dodge_weight = float(np.clip(dodge_weight, 0.0, 1.0))

    combined_shading = cv2.addWeighted(
        dodge_shading, dodge_weight,
        sketchify_shading, 1.0 - dodge_weight,
        0
    ).astype(np.uint8)

    # ========================================================
    # LOCAL CONTRAST (CLAHE) - makes shadows read as genuinely
    # dark and highlights as genuinely bright, instead of
    # everything sitting in the mid-gray zone.
    # ========================================================

    clahe = cv2.createCLAHE(
        clipLimit=clahe_clip_limit,
        tileGridSize=clahe_tile_grid
    )
    contrasted_shading = clahe.apply(combined_shading)

    # ========================================================
    # GAMMA CORRECTION - fine-tune overall darkness/brightness
    # curve so midtones don't wash out.
    # ========================================================

    normalized = contrasted_shading.astype(np.float32) / 255.0
    gamma_corrected = np.power(normalized, gamma)
    toned_shading = (gamma_corrected * 255.0).astype(np.uint8)

    # ========================================================
    # PENCIL GRAIN / TOOTH
    # --------------------------------------------------------
    # Real graphite on paper has fine random texture. A thin
    # multiplicative noise layer breaks up any flat regions and
    # reads as "hand-drawn" rather than "digitally filtered".
    # ========================================================

    if grain_strength > 0:
        rng = np.random.default_rng()
        noise = rng.normal(
            loc=0.0,
            scale=grain_strength,
            size=toned_shading.shape
        )
        grainy_shading = toned_shading.astype(np.float32) + noise
        grainy_shading = np.clip(grainy_shading, 0, 255).astype(np.uint8)
    else:
        grainy_shading = toned_shading

    # ========================================================
    # SOFTEN THE LINE LAYER SLIGHTLY
    # --------------------------------------------------------
    # A dead-sharp vector-like line over hand-shaded tone looks
    # pasted on. A very small blur lets ink taper like real
    # pencil pressure does.
    # ========================================================

    if line_softness > 0:
        lk = line_softness * 2 + 1
        soft_curves = cv2.GaussianBlur(
            final_outline_curves, (lk, lk), 0
        )
    else:
        soft_curves = final_outline_curves

    # ========================================================
    # COMBINE SHADING + CURVES
    # --------------------------------------------------------
    # "multiply" preserves the shading's tonal variation under
    # and around the lines (recommended). "minimum" reproduces
    # the original hard-cut behaviour if you need it.
    # ========================================================

    if line_blend == "minimum":
        final_shaded_pencil_sketch = np.minimum(
            grainy_shading, soft_curves
        )
    else:
        shading_f = grainy_shading.astype(np.float32) / 255.0
        curves_f = soft_curves.astype(np.float32) / 255.0
        final_shaded_pencil_sketch = (
            shading_f * curves_f * 255.0
        ).astype(np.uint8)

    # ========================================================
    # SAVE FINAL SHADING OUTPUT
    # ========================================================

    success = cv2.imwrite(
        output_path,
        final_shaded_pencil_sketch
    )

    if not success:
        raise IOError(
            f"Could not save shading output: {output_path}"
        )

    print(
        "[Stage 3] Shading output saved:",
        output_path
    )

    return final_shaded_pencil_sketch