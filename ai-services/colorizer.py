"""Optional grayscale-to-colour preprocessing for uploaded reference images.

The model files are bundled in ``Colorizer-master/models``.  The model is
loaded lazily so colour uploads do not pay the model-load cost and continue
through the normal pipeline unchanged.
"""

from pathlib import Path
from threading import Lock
import urllib.request

import cv2
import numpy as np
from PIL import Image


COLORIZER_ROOT = Path(__file__).resolve().parent / "Colorizer-master"
COLORIZER_MODELS = COLORIZER_ROOT / "models"
COLORIZER_PROTOTXT = COLORIZER_MODELS / "models_colorization_deploy_v2.prototxt"
COLORIZER_MODEL = COLORIZER_MODELS / "colorization_release_v2.caffemodel"
COLORIZER_POINTS = COLORIZER_MODELS / "pts_in_hull.npy"
COLORIZER_MODEL_URL = (
    "https://eecs.berkeley.edu/~rich.zhang/projects/2016_colorization/"
    "files/demo_v2/colorization_release_v2.caffemodel"
)

_net = None
_model_lock = Lock()


def _download_colorizer_model():
    """Download the large optional model once, outside the Git repository."""
    if COLORIZER_MODEL.is_file():
        return

    COLORIZER_MODELS.mkdir(parents=True, exist_ok=True)
    temporary_model = COLORIZER_MODEL.with_name(
        f"{COLORIZER_MODEL.name}.part"
    )
    print("Downloading the grayscale colorizer model (one time)...")
    try:
        urllib.request.urlretrieve(COLORIZER_MODEL_URL, temporary_model)
        temporary_model.replace(COLORIZER_MODEL)
    except Exception as download_error:
        if temporary_model.exists():
            temporary_model.unlink()
        raise RuntimeError(
            "The grayscale colorizer model could not be downloaded. "
            f"Download it manually from {COLORIZER_MODEL_URL}."
        ) from download_error


def image_needs_colorization(image_path):
    """Return True for grayscale/neutral line-art uploads, not colour images."""
    with Image.open(image_path) as image:
        original_mode = image.mode
        rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)

    if original_mode in {"1", "L", "LA", "I", "F"}:
        return True

    chroma = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16)
    mean_chroma = float(chroma.mean())
    high_chroma_fraction = float((chroma > 8).mean())

    # Small JPEG channel noise is still neutral. A real colour image has
    # enough saturated pixels to fail at least one of these checks.
    return mean_chroma <= 2.5 and high_chroma_fraction <= 0.01


def _get_colorizer_net():
    global _net
    if _net is not None:
        return _net

    with _model_lock:
        if _net is not None:
            return _net

        _download_colorizer_model()

        missing = [
            path for path in (COLORIZER_PROTOTXT, COLORIZER_MODEL, COLORIZER_POINTS)
            if not path.is_file()
        ]
        if missing:
            raise FileNotFoundError(
                "Colorizer model files are missing: "
                + ", ".join(str(path) for path in missing)
            )

        net = cv2.dnn.readNetFromCaffe(
            str(COLORIZER_PROTOTXT),
            str(COLORIZER_MODEL),
        )
        points = np.load(str(COLORIZER_POINTS))
        points = points.transpose().reshape(2, 313, 1, 1)

        class8 = net.getLayerId("class8_ab")
        conv8 = net.getLayerId("conv8_313_rh")
        net.getLayer(class8).blobs = [points.astype("float32")]
        net.getLayer(conv8).blobs = [np.full([1, 313], 2.606, dtype="float32")]

        _net = net
        print("Loaded grayscale colorizer model from:", COLORIZER_MODELS)
        return _net


def colorize_image(input_path, output_path):
    """Colorize one neutral upload and save an RGB PNG at ``output_path``."""
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(input_path) as image:
        rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray_rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    scaled = gray_rgb.astype("float32") / 255.0
    lab = cv2.cvtColor(scaled, cv2.COLOR_RGB2LAB)

    resized = cv2.resize(lab, (224, 224))
    lightness = cv2.split(resized)[0]
    lightness -= 50

    net = _get_colorizer_net()
    net.setInput(cv2.dnn.blobFromImage(lightness))
    ab = net.forward()[0].transpose((1, 2, 0))
    ab = cv2.resize(ab, (rgb.shape[1], rgb.shape[0]))

    original_lightness = cv2.split(lab)[0]
    colorized_lab = np.concatenate(
        (original_lightness[:, :, np.newaxis], ab),
        axis=2,
    )
    colorized = cv2.cvtColor(colorized_lab, cv2.COLOR_LAB2RGB)
    colorized = (255 * np.clip(colorized, 0, 1)).astype("uint8")

    if not cv2.imwrite(
        str(output_path),
        cv2.cvtColor(colorized, cv2.COLOR_RGB2BGR),
    ):
        raise IOError(f"Could not save colorized image: {output_path}")

    return str(output_path)


def colorize_if_needed(input_path, output_path):
    """Return preprocessing metadata and leave colour uploads untouched."""
    if not image_needs_colorization(input_path):
        return {
            "applied": False,
            "input_path": str(input_path),
            "output_path": str(input_path),
        }

    colorized_path = colorize_image(input_path, output_path)
    return {
        "applied": True,
        "input_path": str(input_path),
        "output_path": colorized_path,
    }
