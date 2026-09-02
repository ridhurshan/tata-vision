from pipeline.colouring import generate_colouring
from pipeline.geometric import generate_geometric
from pipeline.curves import generate_curves
from pipeline.shading import generate_shading

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError

import os
import re


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
# SAM MODEL SETTINGS
# ============================================================

SAM_CHECKPOINT = (
    "/home/ridhurshan/Documents/UNIVERSITY/Final year project/"
    "2_segment-anything_SAM/segment-anything-main/"
    "sam_vit_h_4b8939.pth"
)

SAM_MODEL_TYPE = "vit_h"


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
    SAM_CHECKPOINT
):

    raise FileNotFoundError(
        f"SAM checkpoint not found: {SAM_CHECKPOINT}"
    )


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


        # ====================================================
        # OUTPUT PATHS
        # ====================================================

        geometric_path = os.path.join(
            project_output_directory,
            "geometric.png"
        )

        curves_path = os.path.join(
            project_output_directory,
            "curves.png"
        )

        shading_path = os.path.join(
            project_output_directory,
            "shading.png"
        )

        colouring_path = os.path.join(
            project_output_directory,
            "colouring.png"
        )


        # ====================================================
        # STAGE 1 - GEOMETRIC EXTRACTION
        # ====================================================

        generate_geometric(
            input_path=input_path,
            output_path=geometric_path,
            checkpoint_path=SAM_CHECKPOINT,
            model_type=SAM_MODEL_TYPE
        )


        if not os.path.isfile(
            geometric_path
        ):

            raise RuntimeError(
                "Geometric output was not created."
            )


        print(
            "[Stage 1] Geometric extraction completed."
        )


        # ====================================================
        # STAGE 2 - CURVE MODEL
        # ====================================================

        generate_curves(
            input_path=input_path,
            output_path=curves_path,
            temporary_directory=temporary_directory,
            model_path=CURVE_MODEL_PATH
        )


        if not os.path.isfile(
            curves_path
        ):

            raise RuntimeError(
                "Curve output was not created."
            )


        print(
            "[Stage 2] Curve processing completed."
        )


        # ====================================================
        # STAGE 3 - DEPTH-AWARE SHADING
        # ====================================================

        shading_result = generate_shading(
            input_path=input_path,
            curve_path=curves_path,
            output_path=shading_path,
            temporary_directory=temporary_directory,
            shading_scale=5,
            depth_weight=0.30,
            invert_depth=False,
            tone_levels=6,
            number_of_stages=5,
            add_pencil_hatching=True,
            hatching_spacing=8
        )


        if not os.path.isfile(
            shading_path
        ):

            raise RuntimeError(
                "Shading output was not created."
            )


        print(
            "[Stage 3] Shading processing completed."
        )


        # ====================================================
        # STAGE 4 - COLOURING
        # ====================================================

        generate_colouring(
            input_path=input_path,
            output_path=colouring_path,
            number_of_colours=8,
            min_region_area=80,
            curve_path=curves_path,
            shading_path=shading_path,
            painting_model_path=PAINTING_MODEL_PATH
        )


        if not os.path.isfile(
            colouring_path
        ):

            raise RuntimeError(
                "Colouring output was not created."
            )


        print(
            "[Stage 4] Colouring completed."
        )


        # ====================================================
        # SHADING PREVIEW URLS
        # ====================================================

        shading_previews = [

            {
                "id": "luminance",
                "title": "Luminance Baseline",
                "description":
                    "Grayscale light and dark information "
                    "from the reference image.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/01_luminance.png"
            },

            {
                "id": "relative_depth",
                "title": "Relative Depth",
                "description":
                    "Relative depth estimated using "
                    "Depth Anything V2 Small.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/02_relative_depth.png"
            },

            {
                "id": "fused_shading",
                "title": "Fused Shading",
                "description":
                    "Luminance and relative depth combined "
                    "into a depth-aware shading map.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/03_fused_shading.png"
            },

            {
                "id": "quantized_shading",
                "title": "6-Level Shading",
                "description":
                    "Shading simplified into six tonal levels.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/04_quantized_shading.png"
            },

            {
                "id": "stage_1",
                "title": "Shading Stage 1",
                "description":
                    "The darkest shading regions.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/05_stage_1.png"
            },

            {
                "id": "stage_2",
                "title": "Shading Stage 2",
                "description":
                    "Dark and middle-dark tones.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/05_stage_2.png"
            },

            {
                "id": "stage_3",
                "title": "Shading Stage 3",
                "description":
                    "Intermediate tones are introduced.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/05_stage_3.png"
            },

            {
                "id": "stage_4",
                "title": "Shading Stage 4",
                "description":
                    "Lighter shading regions are added.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/05_stage_4.png"
            },

            {
                "id": "stage_5",
                "title": "Shading Stage 5",
                "description":
                    "The complete tonal structure.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/05_stage_5.png"
            },

            {
                "id": "final_hatching",
                "title": "Final Pencil Hatching",
                "description":
                    "The completed shading with pencil hatching.",
                "image":
                    f"/outputs/{project_id}/"
                    "shading_steps/06_hatched_shading.png"
            }

        ]


        # ====================================================
        # API OUTPUTS
        # ====================================================

        outputs = {

            "geometric_image":
                f"/outputs/{project_id}/geometric.png",

            "curve_image":
                f"/outputs/{project_id}/curves.png",

            "shading_image":
                f"/outputs/{project_id}/shading.png",

            "colouring_image":
                f"/outputs/{project_id}/colouring.png",

            "shading_previews":
                shading_previews,

            "colouring_previews": [
                {
                    "title": title,
                    "image": (
                        f"/outputs/{project_id}/colouring.png"
                        if filename is None
                        else
                        f"/outputs/{project_id}/"
                        f"colouring_steps/{filename}"
                    )
                }
                for title, filename in [
                    (
                        "Number & Colour Guide",
                        None
                    ),
                    (
                        "Colour Stage 1",
                        "05_colour_stage_1.png"
                    ),
                    (
                        "Colour Stage 2",
                        "05_colour_stage_2.png"
                    ),
                    (
                        "Colour Stage 3",
                        "05_colour_stage_3.png"
                    ),
                    (
                        "Colour Stage 4",
                        "05_colour_stage_4.png"
                    ),
                    (
                        "Colour Stage 5",
                        "05_colour_stage_5.png"
                    ),
                    (
                        "Realistic Paprika Painting",
                        "06_realistic_paprika_painting.png"
                    )
                ]
            ]

        }


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
        port=5001,
        debug=False,
        use_reloader=False,
        threaded=True
    )
