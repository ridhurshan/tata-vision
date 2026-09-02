from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from PIL import Image


class ONNXImageProcessor:

    def __init__(self, model_path):

        self.model_path = Path(model_path)

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model not found: {self.model_path}"
            )

        providers = []

        available_providers = (
            ort.get_available_providers()
        )

        if "CUDAExecutionProvider" in available_providers:
            providers.append("CUDAExecutionProvider")

        providers.append("CPUExecutionProvider")

        self.session = ort.InferenceSession(
            str(self.model_path),
            providers=providers
        )

        self.input_information = (
            self.session.get_inputs()[0]
        )

        self.input_name = (
            self.input_information.name
        )

        self.input_shape = (
            self.input_information.shape
        )

        print("Model loaded:", self.model_path.name)
        print("Providers:", self.session.get_providers())
        print("Input shape:", self.input_shape)

    @staticmethod
    def fixed_dimension(value, default=512):

        if isinstance(value, int) and value > 0:
            return value

        return default

    def prepare_input(self, image):

        shape = self.input_shape

        # Detect [1, 3, H, W]
        self.uses_nchw = (
            len(shape) == 4
            and shape[1] == 3
        )

        if self.uses_nchw:

            height = self.fixed_dimension(
                shape[2]
            )

            width = self.fixed_dimension(
                shape[3]
            )

        else:

            height = self.fixed_dimension(
                shape[1]
            )

            width = self.fixed_dimension(
                shape[2]
            )

        self.original_size = image.size

        resized_image = image.resize(
            (width, height),
            Image.Resampling.LANCZOS
        )

        input_array = np.asarray(
            resized_image,
            dtype=np.float32
        )

        # AnimeGAN-style normalization
        input_array = (
            input_array / 127.5
        ) - 1.0

        if self.uses_nchw:

            input_array = np.transpose(
                input_array,
                (2, 0, 1)
            )

        input_tensor = np.expand_dims(
            input_array,
            axis=0
        ).astype(np.float32)

        return input_tensor

    def convert_output(self, output):

        output = np.squeeze(output)

        # Convert CHW to HWC
        if (
            output.ndim == 3
            and output.shape[0] in (1, 3)
        ):

            output = np.transpose(
                output,
                (1, 2, 0)
            )

        # Handle [-1, 1] output
        if output.min() < -0.1:

            output = (
                output + 1.0
            ) * 127.5

        # Handle [0, 1] output
        elif output.max() <= 1.5:

            output = output * 255.0

        output = np.clip(
            output,
            0,
            255
        ).astype(np.uint8)

        if output.ndim == 2:
            output_image = Image.fromarray(
                output,
                mode="L"
            )

        else:
            output_image = Image.fromarray(
                output,
                mode="RGB"
            )

        output_image = output_image.resize(
            self.original_size,
            Image.Resampling.LANCZOS
        )

        return output_image

    def process(self, input_path, output_path):

        input_image = Image.open(
            input_path
        ).convert("RGB")

        input_tensor = self.prepare_input(
            input_image
        )

        model_output = self.session.run(
            None,
            {
                self.input_name: input_tensor
            }
        )[0]

        final_image = self.convert_output(
            model_output
        )

        Path(output_path).parent.mkdir(
            parents=True,
            exist_ok=True
        )

        final_image.save(
            output_path
        )

        return final_image

# ============================================================
# MODEL CACHE
# ============================================================

_loaded_processors = {}


def extract_black_white_curves(
    model_image,
    minimum_component_area=12
):
    """Convert the coloured model result to black curves on white."""

    model_rgb = np.asarray(
        model_image.convert("RGB"),
        dtype=np.uint8
    )
    model_gray = cv2.cvtColor(
        model_rgb,
        cv2.COLOR_RGB2GRAY
    )
    smoothed = cv2.bilateralFilter(
        model_gray,
        7,
        45,
        45
    )

    # Canny extracts boundaries without retaining the model's
    # coloured fills, highlights, or shadows.
    curve_mask = cv2.Canny(
        smoothed,
        45,
        125
    )

    component_count, labels, stats, _ = (
        cv2.connectedComponentsWithStats(
            (curve_mask > 0).astype(np.uint8),
            connectivity=8
        )
    )
    cleaned_mask = np.zeros_like(
        curve_mask,
        dtype=np.uint8
    )

    for component_id in range(
        1,
        component_count
    ):
        if (
            stats[
                component_id,
                cv2.CC_STAT_AREA
            ]
            >=
            minimum_component_area
        ):
            cleaned_mask[
                labels == component_id
            ] = 255

    # Slight dilation keeps curves visible after browser scaling.
    cleaned_mask = cv2.dilate(
        cleaned_mask,
        np.ones((2, 2), dtype=np.uint8),
        iterations=1
    )

    black_white = np.full_like(
        model_gray,
        255
    )
    black_white[
        cleaned_mask > 0
    ] = 0

    return Image.fromarray(
        black_white,
        mode="L"
    )


def get_onnx_processor(model_path):

    absolute_model_path = str(
        Path(model_path).resolve()
    )

    if absolute_model_path not in _loaded_processors:

        print(
            "Loading ONNX model:",
            absolute_model_path
        )

        _loaded_processors[absolute_model_path] = (
            ONNXImageProcessor(
                absolute_model_path
            )
        )

    return _loaded_processors[
        absolute_model_path
    ]


# ============================================================
# GENERATE CURVES
# ============================================================

def generate_curves(
    input_path,
    output_path,
    temporary_directory,
    model_path
):

    print(
        "\n[Stage 2] ONNX processing started"
    )

    input_path = Path(
        input_path
    )

    output_path = Path(
        output_path
    )

    model_path = Path(
        model_path
    )

    temporary_directory = Path(
        temporary_directory
    )


    # ========================================================
    # VALIDATE PATHS
    # ========================================================

    if not input_path.is_file():

        raise FileNotFoundError(
            f"Input image not found: {input_path}"
        )


    if not model_path.is_file():

        raise FileNotFoundError(
            f"ONNX model not found: {model_path}"
        )


    # ========================================================
    # CREATE DIRECTORIES
    # ========================================================

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary_directory.mkdir(
        parents=True,
        exist_ok=True
    )


    # ========================================================
    # LOAD CACHED MODEL
    # ========================================================

    processor = get_onnx_processor(
        model_path
    )


    # ========================================================
    # RUN MODEL
    # ========================================================

    raw_model_path = (
        temporary_directory
        / "curve_model_raw.png"
    )

    raw_model_image = processor.process(
        input_path=input_path,
        output_path=raw_model_path
    )

    final_image = extract_black_white_curves(
        raw_model_image
    )
    final_image.save(
        output_path
    )


    # ========================================================
    # VERIFY OUTPUT
    # ========================================================

    if not output_path.is_file():

        raise RuntimeError(
            "ONNX model did not create the output image."
        )


    print(
        "[Stage 2] Output saved:",
        output_path
    )


    return final_image
