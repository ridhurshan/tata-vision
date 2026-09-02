from pathlib import Path
from threading import Lock

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from PIL import Image
from transformers import (
    AutoImageProcessor,
    AutoModelForDepthEstimation
)


# ============================================================
# DEPTH ANYTHING V2 SETTINGS
# ============================================================

MODEL_ID = (
    "depth-anything/"
    "Depth-Anything-V2-Small-hf"
)

DEVICE = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "cpu"
)


# ============================================================
# MODEL CACHE
# ============================================================

_depth_processor = None
_depth_model = None
_model_lock = Lock()


def get_depth_model():
    """
    Load Depth Anything V2 only once and reuse it.
    """

    global _depth_processor
    global _depth_model

    if (
        _depth_processor is not None
        and _depth_model is not None
    ):

        return (
            _depth_processor,
            _depth_model
        )

    with _model_lock:

        if (
            _depth_processor is None
            or _depth_model is None
        ):

            print(
                "Loading Depth Anything V2 on:",
                DEVICE
            )

            _depth_processor = (
                AutoImageProcessor.from_pretrained(
                    MODEL_ID,
                    use_fast=False
                )
            )

            _depth_model = (
                AutoModelForDepthEstimation
                .from_pretrained(
                    MODEL_ID
                )
                .to(DEVICE)
                .eval()
            )

            print(
                "Depth model loaded:",
                MODEL_ID
            )

    return (
        _depth_processor,
        _depth_model
    )


# ============================================================
# ROBUST NORMALIZATION
# ============================================================

def robust_normalize(
    array,
    low_percentile=2.0,
    high_percentile=98.0
):

    array = np.asarray(
        array,
        dtype=np.float32
    )

    low, high = np.percentile(
        array,
        [
            low_percentile,
            high_percentile
        ]
    )

    if high <= low:

        return np.zeros_like(
            array,
            dtype=np.float32
        )

    normalized = (
        array - low
    ) / (
        high - low
    )

    return np.clip(
        normalized,
        0.0,
        1.0
    )


# ============================================================
# PREDICT RELATIVE DEPTH
# ============================================================

def predict_depth(
    reference_image
):

    processor, model = get_depth_model()

    inputs = processor(
        images=reference_image,
        return_tensors="pt"
    )

    inputs = {
        key: value.to(DEVICE)
        for key, value in inputs.items()
    }

    with torch.inference_mode():

        predicted_depth = (
            model(
                **inputs
            ).predicted_depth
        )

    target_height = reference_image.height
    target_width = reference_image.width

    predicted_depth = F.interpolate(
        predicted_depth.unsqueeze(1),
        size=(
            target_height,
            target_width
        ),
        mode="bicubic",
        align_corners=False
    )

    predicted_depth = (
        predicted_depth
        .squeeze()
        .float()
        .cpu()
        .numpy()
    )

    return robust_normalize(
        predicted_depth
    )


# ============================================================
# CREATE LUMINANCE MAP
# ============================================================

def create_luminance_map(
    reference_image
):

    rgb_image = np.asarray(
        reference_image,
        dtype=np.uint8
    )

    luminance = cv2.cvtColor(
        rgb_image,
        cv2.COLOR_RGB2GRAY
    )

    return (
        luminance.astype(
            np.float32
        ) / 255.0
    )


# ============================================================
# CREATE DEPTH-AWARE SHADING
# ============================================================

def create_depth_aware_shading(
    luminance,
    depth_map,
    depth_weight=0.30,
    invert_depth=False,
    bilateral_diameter=9,
    bilateral_sigma_colour=40,
    bilateral_sigma_space=40
):

    depth_weight = float(
        np.clip(
            depth_weight,
            0.0,
            1.0
        )
    )

    if invert_depth:

        geometry_tone = (
            1.0 - depth_map
        )

    else:

        geometry_tone = depth_map

    fused_shading = (

        (1.0 - depth_weight)
        * luminance

        +

        depth_weight
        * geometry_tone

    )

    fused_uint8 = np.clip(
        fused_shading * 255.0,
        0,
        255
    ).astype(np.uint8)

    smoothed_uint8 = cv2.bilateralFilter(
        fused_uint8,
        bilateral_diameter,
        bilateral_sigma_colour,
        bilateral_sigma_space
    )

    return (
        smoothed_uint8.astype(
            np.float32
        ) / 255.0
    )


# ============================================================
# QUANTIZE SHADING
# ============================================================

def quantize_shading(
    shading,
    tone_levels=6
):

    tone_levels = max(
        2,
        int(tone_levels)
    )

    quantized = np.round(

        shading
        * (tone_levels - 1)

    ) / (
        tone_levels - 1
    )

    return np.clip(
        quantized,
        0.0,
        1.0
    )


# ============================================================
# CREATE PROGRESSIVE STAGES
# ============================================================

def create_progressive_stages(
    quantized_map,
    number_of_stages=5
):

    number_of_stages = max(
        1,
        int(number_of_stages)
    )

    thresholds = np.linspace(
        0.20,
        1.0,
        number_of_stages
    )

    stages = []

    for threshold in thresholds:

        stage = np.ones_like(
            quantized_map,
            dtype=np.float32
        )

        tone_mask = (
            quantized_map <= threshold
        )

        stage[
            tone_mask
        ] = quantized_map[
            tone_mask
        ]

        stages.append(
            stage
        )

    return (
        stages,
        thresholds
    )


# ============================================================
# ADD PENCIL HATCHING
# ============================================================

def add_hatching(
    shading,
    spacing=8,
    dark_threshold=0.58,
    very_dark_threshold=0.32
):

    spacing = max(
        2,
        int(spacing)
    )

    base = np.clip(
        shading * 255.0,
        0,
        255
    ).astype(np.uint8)

    hatched = base.copy()

    height, width = (
        hatched.shape
    )

    dark_mask = (
        shading < dark_threshold
    )

    very_dark_mask = (
        shading < very_dark_threshold
    )

    diagonal_lines = np.zeros(
        (
            height,
            width
        ),
        dtype=np.uint8
    )

    for offset in range(
        -height,
        width,
        spacing
    ):

        start_point = (
            max(offset, 0),
            max(-offset, 0)
        )

        end_point = (
            min(
                width - 1,
                height + offset - 1
            ),
            min(
                height - 1,
                width - offset - 1
            )
        )

        cv2.line(
            diagonal_lines,
            start_point,
            end_point,
            255,
            1
        )

    cross_lines = np.zeros(
        (
            height,
            width
        ),
        dtype=np.uint8
    )

    for total in range(
        0,
        width + height,
        spacing
    ):

        start_point = (
            max(
                0,
                total - height + 1
            ),
            min(
                height - 1,
                total
            )
        )

        end_point = (
            min(
                width - 1,
                total
            ),
            max(
                0,
                total - width + 1
            )
        )

        cv2.line(
            cross_lines,
            start_point,
            end_point,
            255,
            1
        )

    diagonal_mask = (
        (diagonal_lines > 0)
        & dark_mask
    )

    hatched[
        diagonal_mask
    ] = np.minimum(
        hatched[
            diagonal_mask
        ],
        85
    )

    cross_mask = (
        (cross_lines > 0)
        & very_dark_mask
    )

    hatched[
        cross_mask
    ] = np.minimum(
        hatched[
            cross_mask
        ],
        45
    )

    return (
        hatched.astype(
            np.float32
        ) / 255.0
    )


# ============================================================
# SAVE GRAYSCALE IMAGE
# ============================================================

def save_grayscale(
    output_path,
    image_array
):

    output_path = Path(
        output_path
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    output_array = np.clip(
        image_array * 255.0,
        0,
        255
    ).astype(np.uint8)

    Image.fromarray(
        output_array
    ).save(
        output_path
    )


# ============================================================
# GENERATE DEPTH-AWARE SHADING
# ============================================================

def generate_shading(
    input_path,
    curve_path,
    output_path,
    temporary_directory,
    shading_scale=5,
    depth_weight=0.30,
    invert_depth=False,
    tone_levels=6,
    number_of_stages=5,
    add_pencil_hatching=True,
    hatching_spacing=8
):
    """
    Generate depth-aware shading using Depth Anything V2.

    curve_path and shading_scale are retained so this function
    remains compatible with the existing TataVision pipeline.
    """

    print(
        "\n[Stage 3] Depth-aware shading started"
    )

    input_path = Path(
        input_path
    )

    output_path = Path(
        output_path
    )

    temporary_directory = Path(
        temporary_directory
    )

    # Retained for compatibility.
    _ = curve_path
    _ = shading_scale

    if not input_path.is_file():

        raise FileNotFoundError(
            f"Input image not found: {input_path}"
        )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary_directory.mkdir(
        parents=True,
        exist_ok=True
    )

    # Permanent outputs displayed by the frontend.
    shading_steps_directory = (
        output_path.parent
        / "shading_steps"
    )

    shading_steps_directory.mkdir(
        parents=True,
        exist_ok=True
    )

    with Image.open(
        input_path
    ) as source_image:

        reference_image = (
            source_image
            .convert("RGB")
            .copy()
        )

    print(
        "Input resolution:",
        reference_image.size
    )

    # ========================================================
    # DEPTH MODEL
    # ========================================================

    depth_map = predict_depth(
        reference_image
    )

    print(
        "Relative depth generated."
    )

    # ========================================================
    # LUMINANCE
    # ========================================================

    luminance = create_luminance_map(
        reference_image
    )

    # ========================================================
    # DEPTH + LUMINANCE FUSION
    # ========================================================

    fused_shading = (
        create_depth_aware_shading(
            luminance=luminance,
            depth_map=depth_map,
            depth_weight=depth_weight,
            invert_depth=invert_depth
        )
    )

    # ========================================================
    # QUANTIZED SHADING
    # ========================================================

    quantized_shading = (
        quantize_shading(
            fused_shading,
            tone_levels=tone_levels
        )
    )

    # ========================================================
    # PROGRESSIVE STAGES
    # ========================================================

    stages, thresholds = (
        create_progressive_stages(
            quantized_shading,
            number_of_stages=number_of_stages
        )
    )

    # ========================================================
    # FINAL HATCHED SHADING
    # ========================================================

    if add_pencil_hatching:

        final_shading = add_hatching(
            quantized_shading,
            spacing=hatching_spacing
        )

    else:

        final_shading = (
            quantized_shading
        )

    # ========================================================
    # SAVE ALL SHADING PREVIEW IMAGES
    # ========================================================

    save_grayscale(
        shading_steps_directory
        / "01_luminance.png",
        luminance
    )

    save_grayscale(
        shading_steps_directory
        / "02_relative_depth.png",
        depth_map
    )

    save_grayscale(
        shading_steps_directory
        / "03_fused_shading.png",
        fused_shading
    )

    save_grayscale(
        shading_steps_directory
        / "04_quantized_shading.png",
        quantized_shading
    )

    for index, stage in enumerate(
        stages,
        start=1
    ):

        save_grayscale(
            shading_steps_directory
            / f"05_stage_{index}.png",
            stage
        )

    save_grayscale(
        shading_steps_directory
        / "06_hatched_shading.png",
        final_shading
    )

    # Main shading output retained for the existing website.
    save_grayscale(
        output_path,
        final_shading
    )

    if not output_path.is_file():

        raise RuntimeError(
            "Main shading output was not created."
        )

    expected_files = [
        "01_luminance.png",
        "02_relative_depth.png",
        "03_fused_shading.png",
        "04_quantized_shading.png",
        "05_stage_1.png",
        "05_stage_2.png",
        "05_stage_3.png",
        "05_stage_4.png",
        "05_stage_5.png",
        "06_hatched_shading.png"
    ]

    missing_files = [
        filename
        for filename in expected_files
        if not (
            shading_steps_directory
            / filename
        ).is_file()
    ]

    if missing_files:

        raise RuntimeError(
            "Some shading preview files were not created: "
            + ", ".join(missing_files)
        )

    print(
        "[Stage 3] Main shading saved:",
        output_path
    )

    print(
        "[Stage 3] Shading previews saved:",
        shading_steps_directory
    )

    print(
        "[Stage 3] Thresholds:",
        [
            round(
                float(value),
                2
            )
            for value in thresholds
        ]
    )

    return {
        "main_output":
            str(output_path),

        "preview_directory":
            str(shading_steps_directory),

        "preview_files":
            expected_files
    }