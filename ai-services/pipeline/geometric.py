"""SAM-backed geometric extraction used by the Tata Vision pipeline.

This module is the service form of the geetric notebook. The notebook is an
interactive, single-image script; the public function below keeps its
algorithm intact while accepting the pipeline's input/output paths.
"""

import os

# The notebook deliberately runs SAM ViT-H on CPU.
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

from pathlib import Path

import cv2
import numpy as np

from segment_anything import SamAutomaticMaskGenerator, sam_model_registry


_mask_generators = {}


def _get_mask_generator(checkpoint_path, model_type):
    """Load the notebook-configured SAM generator once per checkpoint/type."""
    cache_key = (str(Path(checkpoint_path).resolve()), model_type)
    if cache_key in _mask_generators:
        return _mask_generators[cache_key]

    checkpoint = Path(checkpoint_path)
    if not checkpoint.is_file():
        raise FileNotFoundError(f"SAM checkpoint not found: {checkpoint}")

    print("\nLoading SAM...")
    sam = sam_model_registry[model_type](checkpoint=str(checkpoint))
    sam.to(device="cpu")

    mask_generator = SamAutomaticMaskGenerator(
        model=sam,
        points_per_side=32,
        pred_iou_thresh=0.88,
        stability_score_thresh=0.92,
        crop_n_layers=0,
        min_mask_region_area=100,
    )
    _mask_generators[cache_key] = mask_generator
    print("SAM ready.")
    return mask_generator


def _contour_mask(cnt, height, width):
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.drawContours(mask, [cnt], -1, 255, -1)
    return mask


def _evaluate_candidate(region_mask, candidate_mask):
    region = region_mask > 0
    candidate = candidate_mask > 0

    intersection = np.logical_and(region, candidate).sum()
    union = np.logical_or(region, candidate).sum()
    region_area = region.sum()
    candidate_area = candidate.sum()

    iou = intersection / union if union > 0 else 0
    coverage = intersection / region_area if region_area > 0 else 0
    outside = (
        (candidate_area - intersection) / candidate_area
        if candidate_area > 0
        else 1
    )
    score = 0.50 * iou + 0.35 * coverage - 0.35 * outside

    return iou, coverage, outside, score


def _primitive_candidates(cnt, height, width):
    """Build the notebook's circle/oval/box/triangle primitive candidates."""
    region_mask = _contour_mask(cnt, height, width)
    candidates = []

    # Circle
    (cx, cy), radius = cv2.minEnclosingCircle(cnt)
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.circle(
        mask,
        (int(round(cx)), int(round(cy))),
        max(1, int(round(radius))),
        255,
        -1,
    )
    candidates.append(("circle", *_evaluate_candidate(region_mask, mask)))

    # Oval
    if len(cnt) >= 5:
        try:
            ellipse = cv2.fitEllipse(cnt)
            mask = np.zeros((height, width), dtype=np.uint8)
            cv2.ellipse(mask, ellipse, 255, -1)
            candidates.append(("oval", *_evaluate_candidate(region_mask, mask)))
        except cv2.error:
            pass

    # Rectangle / square
    rect = cv2.minAreaRect(cnt)
    box = np.int32(np.round(cv2.boxPoints(rect)))
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.fillPoly(mask, [box], 255)

    rw, rh = rect[1]
    if rw > 0 and rh > 0:
        aspect = max(rw, rh) / min(rw, rh)
        shape_type = "square" if aspect <= 1.20 else "rectangle"
    else:
        shape_type = "rectangle"

    candidates.append(
        (shape_type, *_evaluate_candidate(region_mask, mask))
    )

    # Triangle
    try:
        _, tri = cv2.minEnclosingTriangle(cnt.astype(np.float32))
        if tri is not None:
            tri = np.int32(np.round(tri.reshape(3, 2)))
            mask = np.zeros((height, width), dtype=np.uint8)
            cv2.fillPoly(mask, [tri], 255)
            candidates.append(
                ("triangle", *_evaluate_candidate(region_mask, mask))
            )
    except cv2.error:
        pass

    candidates.sort(key=lambda item: item[4], reverse=True)
    return candidates


def _smart_best(region, candidates):
    if not candidates:
        return None

    best = candidates[0]
    by_type = {item[0]: item for item in candidates}

    # Triangle / oval protection from the notebook.
    if best[0] == "triangle":
        oval = by_type.get("oval")
        if oval is not None:
            score_gap = best[4] - oval[4]
            if (
                region["vertices"] > 3
                and score_gap <= 0.03
                and oval[1] >= 0.70
                and oval[2] >= 0.85
                and oval[3] <= 0.25
            ):
                best = oval

    return best


def _useful_children(parent_index, contours, hierarchy, image_area):
    result = []
    child = hierarchy[parent_index][2]

    while child != -1:
        cnt = contours[child]
        area = cv2.contourArea(cnt)
        ratio = area / image_area

        if ratio >= 0.00035:
            x, y, width, height = cv2.boundingRect(cnt)
            if width >= 5 and height >= 5:
                result.append((child, cnt))

        child = hierarchy[child][0]

    return result


def _build_regions(contours, hierarchy, image_area):
    regions = []

    for contour_index, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area <= 0:
            continue

        area_ratio = area / image_area
        if not 0.004 <= area_ratio <= 0.20:
            continue

        x, y, box_width, box_height = cv2.boundingRect(cnt)
        if box_width < 8 or box_height < 8:
            continue

        perimeter = cv2.arcLength(cnt, True)
        if perimeter <= 0:
            continue

        approx = cv2.approxPolyDP(cnt, 0.04 * perimeter, True)
        children = _useful_children(
            contour_index,
            contours,
            hierarchy,
            image_area,
        )

        regions.append(
            {
                "contour_index": contour_index,
                "contour": cnt,
                "area": area,
                "area_ratio": area_ratio,
                "vertices": len(approx),
                "bbox": (x, y, box_width, box_height),
                "children": children,
                "child_count": len(children),
            }
        )

    return regions


def _classify_region(region, height, width):
    candidates = _primitive_candidates(region["contour"], height, width)
    best = _smart_best(region, candidates)

    if region["child_count"] >= 2:
        return "COMPOUND", best

    if best is None:
        return "COMPLEX", None

    shape, iou, coverage, outside, score = best
    if iou >= 0.72 and coverage >= 0.85 and outside <= 0.25:
        return "SIMPLE", best

    return "COMPLEX", best


def _local_fit(cnt, height, width):
    if cnt is None or len(cnt) < 3:
        return None

    area = cv2.contourArea(cnt)
    if area <= 0:
        return None

    perimeter = cv2.arcLength(cnt, True)
    if perimeter <= 0:
        return None

    approx = cv2.approxPolyDP(cnt, 0.04 * perimeter, True)
    candidates = _primitive_candidates(cnt, height, width)
    if not candidates:
        return None

    best = _smart_best({"vertices": len(approx)}, candidates)
    if best is None:
        return None

    shape, iou, coverage, outside, score = best
    if iou >= 0.58 and coverage >= 0.72 and outside <= 0.38:
        return best

    return None


def _collect_shapes(regions, image_area, height, width):
    detected_shapes = []

    for region_id, region in enumerate(regions):
        label, best = _classify_region(region, height, width)

        if label == "SIMPLE":
            if best is None:
                continue

            detected_shapes.append(
                {
                    "contour": region["contour"],
                    "type": best[0],
                    "area": region["area"],
                    "area_ratio": region["area_ratio"],
                    "source": "simple",
                    "region": region_id,
                }
            )

        elif label == "COMPOUND":
            if best is not None:
                detected_shapes.append(
                    {
                        "contour": region["contour"],
                        "type": best[0],
                        "area": region["area"],
                        "area_ratio": region["area_ratio"],
                        "source": "compound-outer",
                        "region": region_id,
                    }
                )

            for child_index, child_cnt in region["children"]:
                child_best = _local_fit(child_cnt, height, width)
                if child_best is None:
                    continue

                child_area = cv2.contourArea(child_cnt)
                detected_shapes.append(
                    {
                        "contour": child_cnt,
                        "type": child_best[0],
                        "area": child_area,
                        "area_ratio": child_area / image_area,
                        "source": "compound-child",
                        "region": region_id,
                    }
                )

        # COMPLEX regions are skipped completely, as in the notebook.

    return detected_shapes


def _shape_center(item):
    cnt = item["contour"]
    moments = cv2.moments(cnt)

    if moments["m00"] != 0:
        cx = moments["m10"] / moments["m00"]
        cy = moments["m01"] / moments["m00"]
    else:
        x, y, width, height = cv2.boundingRect(cnt)
        cx = x + width / 2
        cy = y + height / 2

    return float(cx), float(cy)


def _reduce_duplicates(detected_shapes):
    detected_shapes.sort(key=lambda item: item["area"], reverse=True)
    unique_shapes = []

    for candidate in detected_shapes:
        cx, cy = _shape_center(candidate)
        duplicate = False

        for existing in unique_shapes:
            if candidate["type"] != existing["type"]:
                continue

            ex, ey = _shape_center(existing)
            distance = np.hypot(cx - ex, cy - ey)
            candidate_scale = np.sqrt(max(candidate["area"], 1))
            existing_scale = np.sqrt(max(existing["area"], 1))
            scale = max(candidate_scale, existing_scale)
            area_ratio = (
                min(candidate["area"], existing["area"])
                / max(candidate["area"], existing["area"])
            )

            if distance <= 0.08 * scale and area_ratio >= 0.85:
                duplicate = True
                break

        if not duplicate:
            unique_shapes.append(candidate)

    return unique_shapes


def _draw_shape(canvas, item, thickness=2):
    cnt = item["contour"]
    shape_type = item["type"]

    if shape_type == "circle":
        (cx, cy), radius = cv2.minEnclosingCircle(cnt)
        cv2.circle(
            canvas,
            (int(round(cx)), int(round(cy))),
            max(1, int(round(radius))),
            (0, 0, 0),
            thickness,
            cv2.LINE_AA,
        )

    elif shape_type == "oval":
        if len(cnt) >= 5:
            try:
                ellipse = cv2.fitEllipse(cnt)
                cv2.ellipse(canvas, ellipse, (0, 0, 0), thickness, cv2.LINE_AA)
            except cv2.error:
                pass

    elif shape_type in ("rectangle", "square"):
        rect = cv2.minAreaRect(cnt)
        box = np.int32(np.round(cv2.boxPoints(rect)))
        cv2.polylines(canvas, [box], True, (0, 0, 0), thickness, cv2.LINE_AA)

    elif shape_type == "triangle":
        try:
            _, tri = cv2.minEnclosingTriangle(cnt.astype(np.float32))
            if tri is not None:
                tri = np.int32(np.round(tri.reshape(3, 2)))
                cv2.polylines(
                    canvas,
                    [tri],
                    True,
                    (0, 0, 0),
                    thickness,
                    cv2.LINE_AA,
                )
        except cv2.error:
            pass


def _progressive_counts(shape_count):
    if shape_count == 1:
        return 1, 1, 1, 1
    if shape_count == 2:
        return 1, 1, 1, 2
    if shape_count == 3:
        return 1, 1, 2, 3
    if shape_count == 4:
        return 1, 2, 3, 4

    step1_n = max(1, int(np.ceil(shape_count * 0.20)))
    step2_n = max(step1_n, int(np.ceil(shape_count * 0.40)))
    step3_n = max(step2_n, int(np.ceil(shape_count * 0.60)))
    step4_n = max(step3_n, int(np.ceil(shape_count * 0.80)))
    return step1_n, step2_n, step3_n, step4_n


def _create_step_image(shapes, height, width):
    canvas = np.ones((height, width, 3), dtype=np.uint8) * 255
    for item in shapes:
        _draw_shape(canvas, item, thickness=2)
    return canvas


def _write_image(path, image):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(path), image):
        raise RuntimeError(f"Could not save geometric image: {path}")
    return str(path)


def generate_geometric(
    input_path,
    output_path,
    checkpoint_path,
    model_type="vit_h",
):
    """Generate the notebook's progressive geometric guide for one image."""
    print("\n[Stage 1] Geometric extraction started")

    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.is_file():
        raise FileNotFoundError(f"Input image not found: {input_path}")
    if not Path(checkpoint_path).is_file():
        raise FileNotFoundError(f"SAM checkpoint not found: {checkpoint_path}")

    original_bgr = cv2.imread(str(input_path))
    if original_bgr is None:
        raise RuntimeError("Could not read input image.")

    original_rgb = cv2.cvtColor(original_bgr, cv2.COLOR_BGR2RGB)
    height, width = original_bgr.shape[:2]
    image_area = float(height * width)

    print("Image:", width, "x", height)

    mask_generator = _get_mask_generator(checkpoint_path, model_type)
    print("\nRunning SAM...")
    sam_masks = mask_generator.generate(original_rgb)
    print("Raw masks:", len(sam_masks))

    filtered_masks = []
    for info in sam_masks:
        seg = info["segmentation"]
        area = np.count_nonzero(seg)
        ratio = area / image_area
        pred_iou = float(info.get("predicted_iou", 0))
        stability = float(info.get("stability_score", 0))

        if not 0.001 <= ratio <= 0.40:
            continue
        if pred_iou < 0.88:
            continue
        if stability < 0.92:
            continue
        filtered_masks.append(info)

    print("Filtered masks:", len(filtered_masks))
    if not filtered_masks:
        raise RuntimeError("No SAM masks passed filtering.")

    # Internal SAM structural map.
    structure = np.ones((height, width, 3), dtype=np.uint8) * 255
    for info in filtered_masks:
        seg = info["segmentation"].astype(np.uint8) * 255
        contours, _ = cv2.findContours(
            seg,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )
        cv2.drawContours(structure, contours, -1, (0, 0, 0), 1, cv2.LINE_AA)

    gray = cv2.cvtColor(structure, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)

    contours, hierarchy = cv2.findContours(
        binary,
        cv2.RETR_TREE,
        cv2.CHAIN_APPROX_NONE,
    )
    if hierarchy is None:
        raise RuntimeError("No contours found.")

    hierarchy = hierarchy[0]
    print("Structural contours:", len(contours))

    regions = _build_regions(contours, hierarchy, image_area)
    print("Candidate regions:", len(regions))

    detected_shapes = _collect_shapes(regions, image_area, height, width)
    print("Useful geometric shapes:", len(detected_shapes))
    if not detected_shapes:
        raise RuntimeError("No useful geometric shapes detected.")

    detected_shapes = _reduce_duplicates(detected_shapes)
    print("After duplicate reduction:", len(detected_shapes))

    ordered_shapes = sorted(
        detected_shapes,
        key=lambda item: item["area"],
        reverse=True,
    )
    shape_count = len(ordered_shapes)
    print("\nTotal ordered shapes:", shape_count)

    step1_n, step2_n, step3_n, step4_n = _progressive_counts(shape_count)
    print("\nProgressive drawing:")
    print("Step 1 shapes:", step1_n)
    print("Step 2 shapes:", step2_n)
    print("Step 3 shapes:", step3_n)
    print("Step 4 shapes:", step4_n)
    print("Final shapes:", shape_count)

    step_images = [
        _create_step_image(ordered_shapes[:step1_n], height, width),
        _create_step_image(ordered_shapes[:step2_n], height, width),
        _create_step_image(ordered_shapes[:step3_n], height, width),
        _create_step_image(ordered_shapes[:step4_n], height, width),
        _create_step_image(ordered_shapes, height, width),
    ]

    steps_directory = output_path.parent / "geometric_steps"
    output_stem = output_path.stem
    step_names = [
        "01_extraction.png",
        "02_extraction.png",
        "03_extraction.png",
        "04_specific_shapes.png",
        "05_final.png",
    ]
    all_step_paths = [
        _write_image(steps_directory / name, image)
        for name, image in zip(step_names, step_images)
    ]
    _write_image(output_path, step_images[-1])

    for step_path in all_step_paths:
        saved_image = cv2.imread(step_path)
        if saved_image is None or saved_image.size == 0:
            raise RuntimeError(f"Invalid geometric step image: {step_path}")
        print("[Stage 1] Geometric step saved:", step_path)

    print("[Stage 1] Geometric output saved:", output_path)

    for index, item in enumerate(ordered_shapes, start=1):
        print(
            f"{index:02d}"
            f" | {item['type']:10s}"
            f" | area={item['area_ratio']:.4f}"
            f" | {item['source']}"
        )

    return {
        "working_image": original_rgb,
        "all_masks": sam_masks,
        "final_masks": filtered_masks,
        "geometric_output": step_images[-1],
        "extraction_stages": step_images[:4],
        "specific_shapes_output": step_images[-1],
        "detected_shapes": ordered_shapes,
        "steps_directory": str(steps_directory),
        # The existing service expects four progressive paths. The fifth
        # notebook stage is the final image at output_path.
        "step_paths": all_step_paths[:4],
        "all_step_paths": all_step_paths,
        "output_path": str(output_path),
    }
