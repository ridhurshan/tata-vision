import os
from pathlib import Path

import cv2
import numpy as np
import torch

from segment_anything import sam_model_registry, SamAutomaticMaskGenerator


_sam_model = None
_mask_generator = None


def get_mask_generator(checkpoint_path, model_type="vit_h"):
    """Load SAM once and reuse it for later requests."""
    global _sam_model, _mask_generator

    if _mask_generator is not None:
        return _mask_generator
    if not os.path.isfile(checkpoint_path):
        raise FileNotFoundError(f"SAM checkpoint not found: {checkpoint_path}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading SAM model on: {device}")
    _sam_model = sam_model_registry[model_type](checkpoint=checkpoint_path)
    _sam_model.to(device=device)
    _mask_generator = SamAutomaticMaskGenerator(model=_sam_model)
    return _mask_generator


def filter_masks(masks, image_height, image_width):
    """Remove tiny regions and masks which cover almost the entire image."""
    image_area = image_height * image_width
    retained = []

    for mask_data in masks:
        area = int(mask_data["segmentation"].sum())
        area_ratio = area / image_area
        if 0.002 <= area_ratio <= 0.95:
            retained.append(mask_data)

    retained.sort(key=lambda mask: mask["area"], reverse=True)
    return retained


def _find_external_contours(line_image):
    """Extract closed outer contours from a white image with dark lines."""
    gray = cv2.cvtColor(line_image, cv2.COLOR_RGB2GRAY)
    binary = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)[1]
    binary = cv2.morphologyEx(
        binary, cv2.MORPH_CLOSE, np.ones((3, 3), dtype=np.uint8)
    )
    contours, _ = cv2.findContours(
        binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    return contours


def _draw_simplified_contours(contours, height, width, epsilon_ratio):
    """Create one progressively simplified extraction image."""
    canvas = np.full((height, width, 3), 255, dtype=np.uint8)
    minimum_area = max(50.0, height * width * 0.0002)
    line_width = max(3, int(round(min(height, width) / 350)))

    for contour in contours:
        if cv2.contourArea(contour) < minimum_area:
            continue
        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue
        shape = cv2.approxPolyDP(contour, epsilon_ratio * perimeter, True)
        cv2.drawContours(canvas, [shape], -1, (0, 0, 0), line_width, cv2.LINE_AA)

    return canvas


def _draw_specific_shapes(contours, height, width):
    """Render detected regions as explicit circles, boxes, or polygons."""
    canvas = np.full((height, width, 3), 255, dtype=np.uint8)
    minimum_area = max(80.0, height * width * 0.0003)
    line_width = max(3, int(round(min(height, width) / 350)))

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < minimum_area:
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue

        shape = cv2.approxPolyDP(contour, 0.04 * perimeter, True)
        vertex_count = len(shape)
        circularity = 4.0 * np.pi * area / (perimeter * perimeter)

        if vertex_count > 6 and circularity >= 0.72:
            (center_x, center_y), radius = cv2.minEnclosingCircle(contour)
            cv2.circle(
                canvas,
                (int(round(center_x)), int(round(center_y))),
                max(1, int(round(radius))),
                (0, 0, 0),
                line_width,
                cv2.LINE_AA,
            )
        elif vertex_count == 4:
            box = np.int32(np.round(cv2.boxPoints(cv2.minAreaRect(contour))))
            cv2.drawContours(
                canvas, [box], -1, (0, 0, 0), line_width, cv2.LINE_AA
            )
        else:
            cv2.drawContours(
                canvas, [shape], -1, (0, 0, 0), line_width, cv2.LINE_AA
            )

    return canvas


def _save_rgb(path, image):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bgr_image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    if not cv2.imwrite(str(path), bgr_image):
        raise IOError(f"Could not save: {path}")

    return str(path)


def generate_geometric(
    input_path,
    output_path,
    checkpoint_path,
    model_type="vit_h",
):
    """
    Extract geometry three times, feeding each result into the next pass.

    Four display-ready images are saved under geometric_steps. The final
    specific-shapes image is also saved to output_path for API compatibility.
    """
    print("\n[Stage 1] Geometric extraction started")

    image_bgr = cv2.imread(input_path)
    if image_bgr is None:
        raise ValueError(f"Could not read image: {input_path}")

    working_image = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    height, width = working_image.shape[:2]

    mask_generator = get_mask_generator(checkpoint_path, model_type)
    all_masks = mask_generator.generate(working_image)
    print("SAM masks generated:", len(all_masks))

    final_masks = filter_masks(all_masks, height, width)
    print("Retained masks:", len(final_masks))

    source_contours = []
    for mask_data in final_masks:
        mask = mask_data["segmentation"].astype(np.uint8) * 255
        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        source_contours.extend(
            contour for contour in contours if cv2.contourArea(contour) >= 50
        )

    image_area = float(height * width)
    clean_contours = []
    seen_boxes = []
    for contour in sorted(source_contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        x, y, box_width, box_height = cv2.boundingRect(contour)
        if area < max(120.0, image_area * 0.00035):
            continue
        if (x <= 2 or y <= 2 or x + box_width >= width - 2 or y + box_height >= height - 2) and area / image_area > 0.18:
            continue
        box_area = float(box_width * box_height)
        overlaps = any(
            min(x + box_width, old_x + old_width) - max(x, old_x) > 0
            and min(y + box_height, old_y + old_height) - max(y, old_y) > 0
            for old_x, old_y, old_width, old_height, old_area in seen_boxes
        )
        if overlaps:
            continue
        clean_contours.append(contour)
        seen_boxes.append((x, y, box_width, box_height, box_area))
        if len(clean_contours) >= 12:
            break
    source_contours = clean_contours
    print("Clean geometric contours:", len(source_contours))

    extraction_1 = _draw_simplified_contours(
        source_contours, height, width, epsilon_ratio=0.075
    )
    extraction_2 = _draw_simplified_contours(
        source_contours, height, width, epsilon_ratio=0.045
    )
    extraction_3 = _draw_simplified_contours(
        source_contours, height, width, epsilon_ratio=0.018
    )
    geometric_output = _draw_specific_shapes(
        source_contours, height, width
    )

    output_path = Path(output_path)
    steps_directory = output_path.parent / "geometric_steps"
    _save_rgb(steps_directory / "01_extraction.png", extraction_1)
    _save_rgb(steps_directory / "02_extraction.png", extraction_2)
    _save_rgb(steps_directory / "03_extraction.png", extraction_3)
    _save_rgb(steps_directory / "04_specific_shapes.png", geometric_output)
    _save_rgb(output_path, geometric_output)

    step_paths = [
        str(steps_directory / "01_extraction.png"),
        str(steps_directory / "02_extraction.png"),
        str(steps_directory / "03_extraction.png"),
        str(steps_directory / "04_specific_shapes.png"),
    ]

    for step_path in step_paths:
        saved_image = cv2.imread(step_path)
        if saved_image is None or saved_image.size == 0:
            raise RuntimeError(f"Invalid geometric step image: {step_path}")

        print("[Stage 1] Geometric step saved:", step_path)

    print("[Stage 1] Geometric output saved:", output_path)
    return {
        "working_image": working_image,
        "all_masks": all_masks,
        "final_masks": final_masks,
        "geometric_output": geometric_output,
        "extraction_stages": [extraction_1, extraction_2, extraction_3],
        "specific_shapes_output": geometric_output,
        "steps_directory": str(steps_directory),
        "step_paths": step_paths,
        "output_path": str(output_path),
    }
