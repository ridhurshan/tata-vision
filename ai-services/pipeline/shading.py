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
    shading_scale=5
):

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
    # RUN SKETCHIFY
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


    # ========================================================
    # LOAD GENERATED PENCIL SHADING
    # ========================================================

    shading_generated_path = os.path.join(
        shading_output_folder,
        shading_output_name + ".png"
    )


    pencil_shading = cv2.imread(
        shading_generated_path,
        cv2.IMREAD_GRAYSCALE
    )


    if pencil_shading is None:

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


    # ========================================================
    # MATCH IMAGE SIZES
    # ========================================================

    if (
        pencil_shading.shape
        !=
        final_outline_curves.shape
    ):

        pencil_shading = cv2.resize(
            pencil_shading,
            (
                final_outline_curves.shape[1],
                final_outline_curves.shape[0]
            ),
            interpolation=cv2.INTER_AREA
        )


    # ========================================================
    # COMBINE SHADING + CURVES
    # ========================================================
    #
    # Both are grayscale:
    #
    # pencil_shading
    #      -> light and shadow
    #
    # final_outline_curves
    #      -> strong black curves
    #
    # np.minimum keeps the darker pixel.
    # ========================================================

    final_shaded_pencil_sketch = (
        np.minimum(
            pencil_shading,
            final_outline_curves
        )
    )


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