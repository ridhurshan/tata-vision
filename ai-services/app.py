from pipeline.colouring import generate_colouring
from pipeline.curves import generate_curves
from pipeline.shading import generate_shading
from colorizer import colorize_if_needed

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from threading import Lock

import json
import os
import re
import subprocess
import sys


# ============================================================
# FLASK APP
# ============================================================

app = Flask(
    __name__
)

app.config.update(
    DEBUG=False,
    TESTING=False
)

CORS(app)

# SAM ViT-H is large enough that parallel jobs can exhaust an 8 GB instance.
# Keep one worker thread available for health checks and reject overlapping
# processing requests instead of loading multiple copies of the model.
PROCESS_LOCK = Lock()
PROCESS_LOCK_ENV_KEY = "tata_vision.process_lock_acquired"


@app.before_request
def limit_parallel_processing():
    if request.path != "/process":
        return None

    if not PROCESS_LOCK.acquire(blocking=False):
        response = jsonify({
            "message": "The AI service is already processing another image. Please retry shortly."
        })
        response.status_code = 429
        response.headers["Retry-After"] = "30"
        return response

    request.environ[PROCESS_LOCK_ENV_KEY] = True
    return None


@app.teardown_request
def release_processing_lock(_error):
    if request.environ.pop(PROCESS_LOCK_ENV_KEY, False):
        PROCESS_LOCK.release()


# ============================================================
# PROJECT PATHS
# ============================================================

AI_SERVICE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

PROJECT_ROOT = os.path.dirname(
    AI_SERVICE_DIR
)

BACKEND_DIR = os.path.join(
    PROJECT_ROOT,
    "backend"
)

OUTPUT_ROOT = os.path.join(
    BACKEND_DIR,
    "uploads",
    "outputs"
)

MODELS_DIR = os.path.join(
    AI_SERVICE_DIR,
    "models"
)


# ============================================================
# Geometric/SAM settings are retained only for backwards-compatible imports.
# The active pipeline no longer creates geometric-shape steps and never loads SAM.
# ============================================================

SAM_CHECKPOINT = None
SAM_MODEL_TYPE = None

GEOMETRY_SCRIPT_PATH = os.path.join(
    AI_SERVICE_DIR,
    "pipeline",
    "tata_vision_geometry.py"
)

# ============================================================
# CURVE ONNX MODEL SETTINGS
# ============================================================

CURVE_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "Hayao_64.onnx"
)

PAINTING_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "Paprika_54.onnx"
)


# ============================================================
# VALIDATE MODEL FILES
# ============================================================

if not os.path.isfile(
    CURVE_MODEL_PATH
):

    raise FileNotFoundError(
        f"ONNX model not found: {CURVE_MODEL_PATH}"
    )

if not os.path.isfile(
    PAINTING_MODEL_PATH
):

    raise FileNotFoundError(
        f"Painting ONNX model not found: {PAINTING_MODEL_PATH}"
    )


os.makedirs(
    OUTPUT_ROOT,
    exist_ok=True
)


def write_processing_progress(
    project_output_directory,
    stage,
    stage_label,
    percent,
    status="processing",
    completed_stages=None,
    applicable_stages=None,
    message=None,
    error=None,
):
    """Write the current pipeline state where the frontend can poll it safely."""
    progress_path = os.path.join(
        project_output_directory,
        "progress.json"
    )
    temporary_path = f"{progress_path}.tmp"
    payload = {
        "status": status,
        "stage": stage,
        "stage_label": stage_label,
        "percent": max(0, min(100, int(percent))),
        "completed_stages": completed_stages or [],
        "applicable_stages": applicable_stages or [
            "preprocessing",
            "geometry",
        ],
    }
    if message:
        payload["message"] = message
    if error:
        payload["error"] = str(error)

    with open(temporary_path, "w", encoding="utf-8") as progress_file:
        json.dump(payload, progress_file)
    os.replace(temporary_path, progress_path)


def execute_geometry_script(input_path, output_path):
    """Execute tata_vision_geometry.py without the removed SAM stage."""
    command = [
        sys.executable,
        GEOMETRY_SCRIPT_PATH,
        input_path,
        "--output-file",
        output_path,
    ]

    print("[Stage 1] Executing:", " ".join(command))
    completed = subprocess.run(
        command,
        cwd=AI_SERVICE_DIR,
        capture_output=True,
        text=True,
        timeout=30 * 60,
        check=False,
    )

    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, end="")
    if completed.returncode != 0:
        raise RuntimeError(
            "tata_vision_geometry.py failed "
            f"with exit code {completed.returncode}."
        )

    if not os.path.isfile(output_path):
        raise RuntimeError("tata_vision_geometry.py did not save the analysis output.")

    detections_path = os.path.join(
        os.path.dirname(output_path),
        "tata_vision_geometry",
        "detections.json"
    )
    if not os.path.isfile(detections_path):
        raise RuntimeError(
            "tata_vision_geometry.py did not save detection metadata."
        )

    with open(detections_path, "r", encoding="utf-8") as detections_file:
        detection_metadata = json.load(detections_file)

    return {
        "geometric_output": output_path,
        "steps_directory": None,
        "step_paths": [],
        "all_step_paths": [],
        "output_path": output_path,
        "detections": detection_metadata.get("detections", []),
        "analysis_image": detection_metadata.get("analysis_image"),
    }


def execute_fallback_geometry(input_path, output_path):
    """Run geometric.py for images that have no detector-recognised subjects."""
    # Import lazily so the existing detected-object flow does not load the
    # fallback geometry engine or its optional segmentation dependencies.
    from pipeline import geometric as fallback_geometry

    print(
        "[Fallback] No detected subjects; running geometric.py only."
    )

    image = fallback_geometry.load_image(
        input_path,
        fallback_geometry.CFG.max_image_side
    )
    result = fallback_geometry.analyse(image)

    steps_directory = os.path.join(
        os.path.dirname(output_path),
        "geometric_steps"
    )
    os.makedirs(steps_directory, exist_ok=True)

    step_filenames = [
        "01_extraction.png",
        "02_background_removed.png",
        "03_parts_isolated.png",
        "04_final_parts.png",
    ]
    step_paths = []

    for filename, image_step in zip(step_filenames, result.stages):
        step_path = os.path.join(steps_directory, filename)
        Image.fromarray(image_step).save(step_path)
        step_paths.append(step_path)

    Image.fromarray(result.final).save(output_path)

    print(
        "[Fallback] geometric.py completed; no subject pipelines will run."
    )

    return {
        "geometric_output": output_path,
        "steps_directory": steps_directory,
        "step_paths": step_paths,
        "all_step_paths": step_paths,
        "output_path": output_path,
    }


def _safe_subject_name(detection):
    label = re.sub(
        r"[^A-Za-z0-9_-]+",
        "_",
        str(detection.get("label", "object")).lower()
    ).strip("_") or "object"
    return f"{int(detection.get('id', 0)):02d}_{label}"


def _subject_relative_path(path, geometry_directory):
    return os.path.relpath(
        path,
        geometry_directory
    ).replace(os.sep, "/")


def _subject_steps(geometry_directory, folder, filenames, titles):
    steps = []
    for filename, title in zip(filenames, titles):
        path = os.path.join(folder, filename)
        if os.path.isfile(path):
            steps.append({
                "title": title,
                "image": _subject_relative_path(path, geometry_directory),
            })
    return steps


def process_detection_pipelines(
    project_output_directory,
    detection_metadata,
    progress_callback=None,
):
    """Run curves, shading, and colouring on every isolated detection crop."""
    geometry_directory = os.path.join(
        project_output_directory,
        "tata_vision_geometry"
    )
    subjects_directory = os.path.join(
        geometry_directory,
        "subjects"
    )
    os.makedirs(subjects_directory, exist_ok=True)

    curve_filenames = [
        "curve_step1_main.png",
        "curve_step2_major.png",
        "curve_step3_features.png",
        "curve_step4_details.png",
        "curve_step5_final.png",
    ]
    curve_titles = [
        "Main structure",
        "Major curves",
        "Important features",
        "Details",
        "Complete curves",
    ]
    shading_filenames = [
        "01_luminance.png",
        "02_relative_depth.png",
        "03_fused_shading.png",
        "05_stage_2.png",
        "05_stage_3.png",
        "05_stage_4.png",
        "05_stage_5.png",
        "06_hatched_shading.png",
    ]
    shading_titles = [
        "Luminance baseline",
        "Relative depth",
        "Fused shading",
        "Shading stage 2",
        "Shading stage 3",
        "Shading stage 4",
        "Shading stage 5",
        "Final pencil hatching",
    ]
    colouring_filenames = [
        "01_original.png",
        "02_black_white_contour.png",
        "03_coloured_outline.png",
        "05_colour_stage_1.png",
        "05_colour_stage_2.png",
        "05_colour_stage_3.png",
        "05_colour_stage_4.png",
        "05_colour_stage_5.png",
        "06_realistic_paprika_painting.png",
        "04_final_coloured_sketch.png",
    ]
    colouring_titles = [
        "Original",
        "Black and white contour",
        "Coloured outline",
        "Colour stage 1",
        "Colour stage 2",
        "Colour stage 3",
        "Colour stage 4",
        "Colour stage 5",
        "Realistic painted result",
        "Final coloured sketch",
    ]

    detections = detection_metadata.get("detections", [])
    total_detections = len(detections)

    for detection_index, detection in enumerate(detections):
        subject_name = _safe_subject_name(detection)
        subject_directory = os.path.join(subjects_directory, subject_name)
        curve_directory = os.path.join(subject_directory, "curve_steps")
        subject_temporary_directory = os.path.join(subject_directory, "temp")
        shading_directory = os.path.join(subject_directory, "shading_steps")
        colouring_directory = os.path.join(subject_directory, "colouring_steps")
        os.makedirs(subject_directory, exist_ok=True)

        crop_path = os.path.join(
            geometry_directory,
            detection.get("image", "")
        )
        if not os.path.isfile(crop_path):
            detection["subject_outputs"] = {
                "error": "The isolated detection crop was not found.",
            }
            continue

        geometric_path = crop_path
        for pipeline in detection.get("pipelines", []):
            if pipeline.get("steps"):
                candidate = os.path.join(
                    geometry_directory,
                    pipeline["steps"][-1].get("image", "")
                )
                if os.path.isfile(candidate):
                    geometric_path = candidate
                    if pipeline.get("type") == "body":
                        break

        curves_path = os.path.join(subject_directory, "curves.png")
        shading_path = os.path.join(subject_directory, "shading.png")
        colouring_path = os.path.join(subject_directory, "colouring.png")

        try:
            generate_curves(
                input_path=crop_path,
                geometric_path=geometric_path,
                output_path=curves_path,
                curve_steps_directory=curve_directory,
                temporary_directory=subject_temporary_directory,
                model_path=CURVE_MODEL_PATH
            )
            if progress_callback:
                progress_callback(
                    "curves",
                    f"Curves · {detection.get('label', 'subject')} {detection.get('id', detection_index + 1)}",
                    detection_index,
                    total_detections,
                    1,
                )
            generate_shading(
                input_path=crop_path,
                curve_path=curves_path,
                output_path=shading_path,
                temporary_directory=subject_temporary_directory,
                shading_scale=5,
                depth_weight=0.30,
                invert_depth=False,
                tone_levels=6,
                number_of_stages=5,
                add_pencil_hatching=True,
                hatching_spacing=8
            )
            if progress_callback:
                progress_callback(
                    "shading",
                    f"Shading · {detection.get('label', 'subject')} {detection.get('id', detection_index + 1)}",
                    detection_index,
                    total_detections,
                    2,
                )
            colouring_result = generate_colouring(
                input_path=crop_path,
                output_path=colouring_path,
                number_of_colours=8,
                min_region_area=80,
                curve_path=curves_path,
                shading_path=shading_path,
                painting_model_path=PAINTING_MODEL_PATH
            )
            if progress_callback:
                progress_callback(
                    "colouring",
                    f"Colouring · {detection.get('label', 'subject')} {detection.get('id', detection_index + 1)}",
                    detection_index,
                    total_detections,
                    3,
                )

            detection["subject_outputs"] = {
                "curves": {
                    "image": _subject_relative_path(curves_path, geometry_directory),
                    "steps": _subject_steps(
                        geometry_directory,
                        curve_directory,
                        curve_filenames,
                        curve_titles
                    ),
                },
                "shading": {
                    "image": _subject_relative_path(shading_path, geometry_directory),
                    "steps": _subject_steps(
                        geometry_directory,
                        shading_directory,
                        shading_filenames,
                        shading_titles
                    ),
                },
                "colouring": {
                    "image": _subject_relative_path(colouring_path, geometry_directory),
                    "steps": _subject_steps(
                        geometry_directory,
                        colouring_directory,
                        colouring_filenames,
                        colouring_titles
                    ),
                },
            }
            print(f"Saved curves, shading, and colouring for {subject_name}")
        except Exception as subject_error:
            print(
                f"Subject pipeline skipped for {subject_name}: "
                f"{type(subject_error).__name__}: {subject_error}"
            )
            detection["subject_outputs"] = {
                "error": str(subject_error),
            }

    detections_path = os.path.join(geometry_directory, "detections.json")
    with open(detections_path, "w", encoding="utf-8") as detections_file:
        json.dump(detection_metadata, detections_file, indent=2)

    return detection_metadata


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():

    return jsonify({

        "status":
            "AI service running",

        "sam_model":
            SAM_MODEL_TYPE,

        "curve_model":
            os.path.basename(
                CURVE_MODEL_PATH
            ),

        "painting_model":
            os.path.basename(
                PAINTING_MODEL_PATH
            ),

        "shading_model":
            "Depth Anything V2 Small"

    }), 200


# ============================================================
# PROCESS IMAGE
# ============================================================

@app.route(
    "/process",
    methods=["POST"]
)
def process_image():

    try:

        # ====================================================
        # READ REQUEST
        # ====================================================

        data = request.get_json(
            silent=True
        )

        if not data:

            return jsonify({
                "message":
                    "Request body is missing."
            }), 400


        project_id = data.get(
            "project_id"
        )

        input_path = data.get(
            "input_path"
        )


        # ====================================================
        # VALIDATE PROJECT ID
        # ====================================================

        if project_id is None:

            return jsonify({
                "message":
                    "project_id is required."
            }), 400


        project_id = str(
            project_id
        ).strip()


        if not project_id:

            return jsonify({
                "message":
                    "project_id cannot be empty."
            }), 400


        if not re.fullmatch(
            r"[A-Za-z0-9_-]+",
            project_id
        ):

            return jsonify({
                "message":
                    "project_id contains invalid characters."
            }), 400


        # ====================================================
        # VALIDATE INPUT PATH
        # ====================================================

        if not input_path:

            return jsonify({
                "message":
                    "input_path is required."
            }), 400


        input_path = os.path.abspath(
            input_path
        )


        if not os.path.isfile(
            input_path
        ):

            return jsonify({

                "message":
                    "Input image does not exist.",

                "input_path":
                    input_path

            }), 404


        # ====================================================
        # VERIFY INPUT IMAGE
        # ====================================================

        try:

            with Image.open(
                input_path
            ) as uploaded_image:

                uploaded_image.verify()


        except UnidentifiedImageError:

            return jsonify({
                "message":
                    "The uploaded file is not a valid image."
            }), 400


        except OSError as image_error:

            return jsonify({

                "message":
                    "The uploaded image could not be read.",

                "error":
                    str(image_error)

            }), 400


        print(
            "\n===================================="
        )

        print(
            "Processing project:",
            project_id
        )

        print(
            "Input image:",
            input_path
        )

        print(
            "====================================\n"
        )


        # ====================================================
        # CREATE OUTPUT DIRECTORIES
        # ====================================================

        project_output_directory = os.path.join(
            OUTPUT_ROOT,
            project_id
        )

        temporary_directory = os.path.join(
            project_output_directory,
            "temp"
        )


        os.makedirs(
            project_output_directory,
            exist_ok=True
        )

        os.makedirs(
            temporary_directory,
            exist_ok=True
        )

        write_processing_progress(
            project_output_directory,
            "preprocessing",
            "Preparing image",
            5,
            message="Preparing the uploaded image for the drawing pipeline.",
        )

        colorized_input_path = os.path.join(
            project_output_directory,
            "colorized_input.png"
        )
        colorization_result = colorize_if_needed(
            input_path,
            colorized_input_path
        )
        pipeline_input_path = colorization_result["output_path"]

        if colorization_result["applied"]:
            print(
                "[Preprocessing] Grayscale/neutral upload detected; "
                "colorized input saved to:",
                pipeline_input_path
            )
        else:
            print(
                "[Preprocessing] Colour upload detected; "
                "using the original input unchanged."
            )

        write_processing_progress(
            project_output_directory,
            "preprocessing",
            "Preparing image",
            15,
            completed_stages=["preprocessing"],
            message="Image preparation completed.",
        )


        # ====================================================
        # OUTPUT PATHS
        # ====================================================

        geometric_path = os.path.join(
            project_output_directory,
            "geometric.png"
        )

        # ====================================================
        # STAGE 1 - DETECTION + TATA VISION GEOMETRY
        # ====================================================

        write_processing_progress(
            project_output_directory,
            "geometry",
            "Image analysis",
            16,
            completed_stages=["preprocessing"],
            message="Analysing the image and building the geometry guide.",
        )

        geometric_result = execute_geometry_script(
            input_path=pipeline_input_path,
            output_path=geometric_path
        )

        detected_objects = geometric_result.get("detections", [])
        has_detected_objects = bool(detected_objects)

        # geometric.py is an explicit fallback for an image that the Tata
        # Vision detector could not identify. It must never run alongside the
        # recognised-object route.
        if not has_detected_objects:
            geometric_result.update(
                execute_fallback_geometry(
                    input_path=pipeline_input_path,
                    output_path=geometric_path
                )
            )


        if not os.path.isfile(
            geometric_path
        ):

            raise RuntimeError(
                "Geometric output was not created."
            )

        write_processing_progress(
            project_output_directory,
            "geometry",
            "Image analysis",
            25,
            completed_stages=["preprocessing", "geometry"],
            applicable_stages=(
                ["preprocessing", "geometry", "curves", "shading", "colouring"]
                if has_detected_objects
                else ["preprocessing", "geometry"]
            ),
            message=(
                f"Image analysis completed; {len(detected_objects)} subject(s) detected."
                if has_detected_objects
                else "Image analysis completed; using the full-image geometry pipeline."
            ),
        )

        print(
            "[Stage 1] Image analysis completed."
        )

        shading_result = None
        if has_detected_objects:
            # Tata Vision has already created one geometry route per detected
            # subject. Curves, shading, and colouring are run on each isolated
            # subject crop so clicking an object in the UI opens only its own
            # pipeline.
            detection_metadata = process_detection_pipelines(
                project_output_directory,
                {
                    "analysis_image": geometric_result.get("analysis_image"),
                    "detections": detected_objects,
                },
                progress_callback=lambda stage, stage_label, detection_index, total_detections, stage_number: write_processing_progress(
                    project_output_directory,
                    stage,
                    stage_label,
                    25 + round(
                        70 * (
                            detection_index * 3 + stage_number
                        ) / max(1, total_detections * 3)
                    ),
                    completed_stages=(
                        ["preprocessing", "geometry"]
                        + (["curves"] if stage_number >= 1 and detection_index == total_detections - 1 else [])
                        + (["shading"] if stage_number >= 2 and detection_index == total_detections - 1 else [])
                        + (["colouring"] if stage_number >= 3 and detection_index == total_detections - 1 else [])
                    ),
                    applicable_stages=[
                        "preprocessing",
                        "geometry",
                        "curves",
                        "shading",
                        "colouring",
                    ],
                    message=f"Running the {stage_label.lower()} pipeline stage.",
                )
            )

            print(
                "[Subject stages] Per-detection pipelines completed for",
                len(detection_metadata.get("detections", [])),
                "detection(s)."
            )
        else:
            # The fallback branch intentionally stops after geometric.py.
            detection_metadata = {
                "analysis_image": geometric_result.get("analysis_image"),
                "detections": [],
            }

            write_processing_progress(
                project_output_directory,
                "completed",
                "Completed",
                100,
                status="completed",
                completed_stages=["preprocessing", "geometry"],
                applicable_stages=["preprocessing", "geometry"],
                message="The full-image geometry pipeline completed.",
            )


        # ====================================================
        # SHADING PREVIEW URLS
        # ====================================================

        # Recognised images have per-subject shading previews in the
        # detections manifest. Unrecognised images stop at geometric.py, so
        # there is no full-image shading gallery in either branch.
        shading_previews = []


        # ====================================================
        # API OUTPUTS
        # ====================================================

        outputs = {

            "colorization": {
                "applied": colorization_result["applied"],
                "image": (
                    f"/outputs/{project_id}/colorized_input.png"
                    if colorization_result["applied"]
                    else None
                ),
            },

            "geometric_image":
                f"/outputs/{project_id}/geometric.png",

            "curve_image": None,

            "shading_image":
                None,

            "colouring_image":
                None,

            "processing_mode":
                "detected_subjects" if has_detected_objects else "fallback_geometric",

            "detections":
                f"/outputs/{project_id}/tata_vision_geometry/detections.json",

            "analysis_image":
                f"/outputs/{project_id}/tata_vision_geometry/analysis.png",

            "shading_previews":
                shading_previews,

            "colouring_previews": []

        }

        if has_detected_objects:
            write_processing_progress(
                project_output_directory,
                "completed",
                "Completed",
                100,
                status="completed",
                completed_stages=[
                    "preprocessing",
                    "geometry",
                    "curves",
                    "shading",
                    "colouring",
                ],
                applicable_stages=[
                    "preprocessing",
                    "geometry",
                    "curves",
                    "shading",
                    "colouring",
                ],
                message="All drawing pipeline stages completed.",
            )


        # ====================================================
        # SUCCESS RESPONSE
        # ====================================================

        return jsonify({

            "message":
                "Image processing completed.",

            "project_id":
                project_id,

            "outputs":
                outputs,

            "shading":
                shading_result

        }), 200


    except Exception as error:

        app.logger.exception(
            "AI processing failed."
        )

        project_output_directory = locals().get("project_output_directory")
        if project_output_directory:
            try:
                write_processing_progress(
                    project_output_directory,
                    "failed",
                    "Processing failed",
                    0,
                    status="failed",
                    message="The drawing pipeline could not be completed.",
                    error=error,
                )
            except Exception:
                app.logger.exception("Could not write processing progress.")


        return jsonify({

            "message":
                "AI processing failed.",

            "error":
                str(error)

        }), 500


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print(
        "Starting AI service without Flask reloader."
    )

    app.run(
        host="0.0.0.0",
        port=5003,
        debug=False,
        use_reloader=False,
        threaded=True
    )
