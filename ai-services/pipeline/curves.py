import os
import cv2
import numpy as np

from utils.BatchSketchApp import ImageToSketchProcessor


# ============================================================
# PREPROCESS IMAGE FOR CURVE MODEL
# ============================================================

def preprocess_for_outline_model(image_rgb):

    # --------------------------------------------------------
    # 1. Gamma correction
    # --------------------------------------------------------

    gamma = 1.05

    inverse_gamma = 1.0 / gamma

    table = np.array([
        ((i / 255.0) ** inverse_gamma) * 255
        for i in range(256)
    ])

    table = np.clip(
        table,
        0,
        255
    ).astype(np.uint8)

    gamma_corrected = cv2.LUT(
        image_rgb,
        table
    )


    # --------------------------------------------------------
    # 2. Improve local contrast using CLAHE
    # --------------------------------------------------------

    lab = cv2.cvtColor(
        gamma_corrected,
        cv2.COLOR_RGB2LAB
    )

    l_channel, a_channel, b_channel = cv2.split(
        lab
    )

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    enhanced_l = clahe.apply(
        l_channel
    )

    enhanced_lab = cv2.merge(
        (
            enhanced_l,
            a_channel,
            b_channel
        )
    )

    contrast_enhanced = cv2.cvtColor(
        enhanced_lab,
        cv2.COLOR_LAB2RGB
    )


    # --------------------------------------------------------
    # 3. Bilateral smoothing
    # --------------------------------------------------------

    smoothed = cv2.bilateralFilter(
        contrast_enhanced,
        7,
        50,
        50
    )


    # --------------------------------------------------------
    # 4. Light sharpening
    # --------------------------------------------------------

    blurred = cv2.GaussianBlur(
        smoothed,
        (0, 0),
        sigmaX=1.0
    )

    sharpened = cv2.addWeighted(
        smoothed,
        1.35,
        blurred,
        -0.35,
        0
    )


    return np.clip(
        sharpened,
        0,
        255
    ).astype(np.uint8)


# ============================================================
# CLEAN CURVE MODEL OUTPUT
# ============================================================

def postprocess_outline_lines(
    sketch,
    kernel_size=2,
    dilation_iterations=1,
    minimum_component_area=10
):

    # --------------------------------------------------------
    # Convert to grayscale
    # --------------------------------------------------------

    if sketch.ndim == 3:

        sketch_gray = cv2.cvtColor(
            sketch,
            cv2.COLOR_BGR2GRAY
        )

    else:

        sketch_gray = sketch.copy()


    # --------------------------------------------------------
    # Convert dark lines into foreground
    # --------------------------------------------------------

    _, inverted_lines = cv2.threshold(
        sketch_gray,
        0,
        255,
        cv2.THRESH_BINARY_INV
        + cv2.THRESH_OTSU
    )


    # --------------------------------------------------------
    # Remove tiny noise components
    # --------------------------------------------------------

    (
        component_count,
        labels,
        stats,
        _
    ) = cv2.connectedComponentsWithStats(
        inverted_lines,
        connectivity=8
    )


    cleaned_lines = np.zeros_like(
        inverted_lines
    )


    for component_id in range(
        1,
        component_count
    ):

        area = stats[
            component_id,
            cv2.CC_STAT_AREA
        ]

        if area >= minimum_component_area:

            cleaned_lines[
                labels == component_id
            ] = 255


    # --------------------------------------------------------
    # Strengthen curves slightly
    # --------------------------------------------------------

    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (
            kernel_size,
            kernel_size
        )
    )


    strengthened_lines = cv2.dilate(
        cleaned_lines,
        kernel,
        iterations=dilation_iterations
    )


    # --------------------------------------------------------
    # Black lines on white background
    # --------------------------------------------------------

    final_outline = (
        255 - strengthened_lines
    )


    return final_outline


# ============================================================
# GENERATE CURVES
# ============================================================

def generate_curves(
    input_path,
    output_path,
    temporary_directory
):

    print(
        "\n[Stage 2] Curve extraction started"
    )


    # ========================================================
    # READ ORIGINAL IMAGE
    # ========================================================

    image_bgr = cv2.imread(
        input_path
    )

    if image_bgr is None:

        raise ValueError(
            f"Could not read image: {input_path}"
        )


    working_image = cv2.cvtColor(
        image_bgr,
        cv2.COLOR_BGR2RGB
    )


    # ========================================================
    # PREPROCESS
    # ========================================================

    preprocessed_outline_input = (
        preprocess_for_outline_model(
            working_image
        )
    )


    # ========================================================
    # CREATE TEMP DIRECTORY
    # ========================================================

    os.makedirs(
        temporary_directory,
        exist_ok=True
    )


    model_input_path = os.path.join(
        temporary_directory,
        "outline_model_input.png"
    )


    # RGB -> BGR for OpenCV saving
    preprocessed_bgr = cv2.cvtColor(
        preprocessed_outline_input,
        cv2.COLOR_RGB2BGR
    )


    success = cv2.imwrite(
        model_input_path,
        preprocessed_bgr
    )


    if not success:

        raise IOError(
            "Could not save curve model input."
        )


    print(
        "Curve model input prepared:",
        model_input_path
    )


    # ========================================================
    # RUN EXISTING IMAGE TO SKETCH MODEL
    # ========================================================

    outline_model_output = (
        ImageToSketchProcessor.convert_to_sketch(
            model_input_path
        )
    )


    if outline_model_output is None:

        raise ValueError(
            "Curve model returned no output."
        )


    print(
        "Raw curve extraction completed."
    )


    # ========================================================
    # CLEAN CURVES
    # ========================================================

    final_outline_curves = (
        postprocess_outline_lines(
            outline_model_output,
            kernel_size=2,
            dilation_iterations=1,
            minimum_component_area=10
        )
    )


    # ========================================================
    # SAVE FINAL CURVE IMAGE
    # ========================================================

    success = cv2.imwrite(
        output_path,
        final_outline_curves
    )


    if not success:

        raise IOError(
            f"Could not save curve output: {output_path}"
        )


    print(
        "[Stage 2] Curve output saved:",
        output_path
    )


    return final_outline_curves