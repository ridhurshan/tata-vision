import os
import cv2
import numpy as np
import torch

from segment_anything import (
    sam_model_registry,
    SamAutomaticMaskGenerator
)


# ============================================================
# SAM MODEL CACHE
# ============================================================
#
# We do NOT want to reload SAM every time the user uploads
# an image. Loading once and reusing the model is much faster.
# ============================================================

_sam_model = None
_mask_generator = None


def get_mask_generator(
    checkpoint_path,
    model_type="vit_h"
):
    global _sam_model
    global _mask_generator

    if _mask_generator is not None:
        return _mask_generator

    if not os.path.isfile(checkpoint_path):
        raise FileNotFoundError(
            f"SAM checkpoint not found: {checkpoint_path}"
        )

    device = (
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )

    print(
        f"Loading SAM model on: {device}"
    )

    _sam_model = sam_model_registry[
        model_type
    ](
        checkpoint=checkpoint_path
    )

    _sam_model.to(
        device=device
    )

    _mask_generator = (
        SamAutomaticMaskGenerator(
            model=_sam_model
        )
    )

    return _mask_generator


# ============================================================
# FILTER MASKS
# ============================================================

def filter_masks(
    masks,
    image_height,
    image_width
):
    image_area = (
        image_height *
        image_width
    )

    retained = []

    for mask_data in masks:

        segmentation = (
            mask_data["segmentation"]
        )

        area = int(
            segmentation.sum()
        )

        area_ratio = (
            area /
            image_area
        )

        # Ignore extremely tiny masks
        if area_ratio < 0.002:
            continue

        # Ignore masks covering almost whole image
        if area_ratio > 0.95:
            continue

        retained.append(
            mask_data
        )

    # Larger regions first
    retained.sort(
        key=lambda m: m["area"],
        reverse=True
    )

    return retained


# ============================================================
# EXTRACT GEOMETRIC REPRESENTATION
# ============================================================

def generate_geometric(
    input_path,
    output_path,
    checkpoint_path,
    model_type="vit_h"
):

    print(
        "\n[Stage 1] Geometric extraction started"
    )

    # --------------------------------------------------------
    # READ IMAGE
    # --------------------------------------------------------

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

    height, width = (
        working_image.shape[:2]
    )


    # --------------------------------------------------------
    # SAM SEGMENTATION
    # --------------------------------------------------------

    mask_generator = (
        get_mask_generator(
            checkpoint_path,
            model_type
        )
    )

    all_masks = (
        mask_generator.generate(
            working_image
        )
    )

    print(
        "SAM masks generated:",
        len(all_masks)
    )


    # --------------------------------------------------------
    # FILTER MASKS
    # --------------------------------------------------------

    final_masks = filter_masks(
        all_masks,
        height,
        width
    )

    print(
        "Retained masks:",
        len(final_masks)
    )


    # --------------------------------------------------------
    # WHITE OUTPUT CANVAS
    # --------------------------------------------------------

    geometric_output = np.ones(
        (
            height,
            width,
            3
        ),
        dtype=np.uint8
    ) * 255


    # --------------------------------------------------------
    # CONVERT MASKS TO SIMPLIFIED GEOMETRIC BOUNDARIES
    # --------------------------------------------------------

    for mask_data in final_masks:

        mask = (
            mask_data[
                "segmentation"
            ].astype(
                np.uint8
            ) * 255
        )

        contours, _ = (
            cv2.findContours(
                mask,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )
        )

        for contour in contours:

            area = cv2.contourArea(
                contour
            )

            if area < 50:
                continue

            perimeter = cv2.arcLength(
                contour,
                True
            )

            if perimeter <= 0:
                continue


            # ================================================
            # POLYGON APPROXIMATION
            # ================================================

            epsilon = (
                0.02 *
                perimeter
            )

            approximate = (
                cv2.approxPolyDP(
                    contour,
                    epsilon,
                    True
                )
            )


            # ================================================
            # DRAW BASIC GEOMETRIC SHAPE
            # ================================================

            cv2.drawContours(
                geometric_output,
                [approximate],
                -1,
                (0, 0, 0),
                2,
                cv2.LINE_AA
            )


    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    os.makedirs(
        os.path.dirname(
            output_path
        ),
        exist_ok=True
    )

    geometric_bgr = cv2.cvtColor(
        geometric_output,
        cv2.COLOR_RGB2BGR
    )

    success = cv2.imwrite(
        output_path,
        geometric_bgr
    )

    if not success:
        raise IOError(
            f"Could not save: {output_path}"
        )


    print(
        "[Stage 1] Geometric output saved:",
        output_path
    )


    # We return useful intermediate values because
    # Stage 2 will need them later.

    return {
        "working_image":
            working_image,

        "all_masks":
            all_masks,

        "final_masks":
            final_masks,

        "geometric_output":
            geometric_output,

        "output_path":
            output_path
    }