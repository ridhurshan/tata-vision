from pipeline.colouring import generate_colouring
from pipeline.geometric import generate_geometric
from pipeline.curves import generate_curves
from pipeline.shading import generate_shading
from flask import Flask, request, jsonify
from flask_cors import CORS

import os
import cv2


# ============================================================
# FLASK APP
# ============================================================

app = Flask(__name__)

CORS(app)


# ============================================================
# SAM SETTINGS
# ============================================================

SAM_CHECKPOINT = (
    "/home/ridhurshan/Documents/UNIVERSITY/Final year project/"
    "2_segment-anything_SAM/segment-anything-main/"
    "sam_vit_h_4b8939.pth"
)

SAM_MODEL_TYPE = "vit_h"


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


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():

    return jsonify({
        "status": "AI service running"
    })


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

        data = request.get_json()

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
        # VALIDATION
        # ====================================================

        if not project_id:

            return jsonify({
                "message":
                    "project_id is required."
            }), 400


        if not input_path:

            return jsonify({
                "message":
                    "input_path is required."
            }), 400


        input_path = os.path.abspath(
            input_path
        )


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
        # CHECK IMAGE EXISTS
        # ====================================================

        if not os.path.exists(
            input_path
        ):

            return jsonify({

                "message":
                    "Input image does not exist.",

                "input_path":
                    input_path

            }), 404


        # ====================================================
        # READ IMAGE
        # ====================================================

        image = cv2.imread(
            input_path
        )


        if image is None:

            return jsonify({
                "message":
                    "OpenCV could not read the image."
            }), 400


        # ====================================================
        # CREATE OUTPUT DIRECTORY
        # ====================================================

        project_output_dir = os.path.join(
            OUTPUT_ROOT,
            str(project_id)
        )


        os.makedirs(
            project_output_dir,
            exist_ok=True
        )


        # ====================================================
        # OUTPUT PATHS
        # ====================================================

        geometric_path = os.path.join(
            project_output_dir,
            "geometric.png"
        )

        curves_path = os.path.join(
            project_output_dir,
            "curves.png"
        )

        shading_path = os.path.join(
            project_output_dir,
            "shading.png"
        )

        colouring_path = os.path.join(
            project_output_dir,
            "colouring.png"
        )


        # ====================================================
        # STAGE 1 - REAL GEOMETRIC EXTRACTION
        # ====================================================

        geometric_result = generate_geometric(
            input_path=input_path,
            output_path=geometric_path,
            checkpoint_path=SAM_CHECKPOINT,
            model_type=SAM_MODEL_TYPE
        )

        print(
            "Real geometric extraction completed."
        )


        # ====================================================
        # STAGE 2 - REAL CURVE EXTRACTION
        # ====================================================

        curve_temp_directory = os.path.join(
            project_output_dir,
            "temp"
        )

        curve_result = generate_curves(
            input_path=input_path,
            output_path=curves_path,
            temporary_directory=curve_temp_directory
        )

        print(
            "Real curve extraction completed."
        )


        # ====================================================
        # STAGE 3 - REAL PENCIL SHADING
        # ====================================================

        shading_temp_directory = os.path.join(
            project_output_dir,
            "temp"
        )


        shading_result = generate_shading(
            input_path=input_path,
            curve_path=curves_path,
            output_path=shading_path,
            temporary_directory=shading_temp_directory,
            shading_scale=5
        )


        print(
            "Real pencil shading completed."
        )

        # ====================================================
        # STAGE 4 - REAL NUMBER + COLOUR GUIDE
        # ====================================================

        colouring_result = generate_colouring(
            input_path=input_path,
            output_path=colouring_path,
            number_of_colours=8,
            min_region_area=80
        )


        print(
            "Real number and colour guide completed."
        )

        # ====================================================
        # PUBLIC URL PATHS
        # ====================================================

        outputs = {

            "geometric_image":
                f"/outputs/{project_id}/geometric.png",

            "curve_image":
                f"/outputs/{project_id}/curves.png",

            "shading_image":
                f"/outputs/{project_id}/shading.png",

            "colouring_image":
                f"/outputs/{project_id}/colouring.png"

        }


        # ====================================================
        # RESPONSE
        # ====================================================

        return jsonify({

            "message":
                "Image processing completed.",

            "project_id":
                project_id,

            "outputs":
                outputs

        }), 200


    except Exception as error:

        print(
            "AI processing error:",
            error
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

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=True
    )