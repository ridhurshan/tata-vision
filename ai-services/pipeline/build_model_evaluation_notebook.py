"""Generate the TataVision all-model evaluation notebook.

Run from the repository root:
    python3 ai-services/pipeline/build_model_evaluation_notebook.py
"""

from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "ai-services" / "pipeline" / "TataVision_All_Models_Evaluation.ipynb"


def markdown(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": dedent(source).strip().splitlines(True)}


def code(source: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": dedent(source).strip().splitlines(True),
    }


cells = [
    markdown(
        """
        # TataVision — Evaluation Metrics and Measured Results for All Models

        This notebook addresses the supervisor's request to **state the evaluation metrics in every model table and give the results received by each model**. It evaluates the saved TataVision outputs rather than inventing results.

        Active components covered:

        1. Automatic grayscale image colorization (Caffe preprocessing model)
        2. Segment Anything Model (SAM ViT-H) — geometric extraction
        3. AnimeGANv2 Hayao — curve extraction
        4. Depth Anything V2 Small — pencil shading
        5. AnimeGANv2 Paprika — painted coloring

        **Important interpretation:** TataVision creates teaching-oriented stylized images, not exact copies. Reference-based metrics measure preservation of structure, tone, or color; they do not alone measure artistic quality. Use the human-rating sheet near the end alongside the numeric results.
        """
    ),
    markdown(
        """
        ## 1. Metric definitions (text suitable for the report tables)

        | Metric | Definition | Range / preferred direction |
        |---|---|---|
        | Edge precision | Fraction of output edge pixels that match a nearby reference edge | 0–1; higher is better |
        | Edge recall | Fraction of reference edge pixels retained in the output | 0–1; higher is better |
        | Edge F1-score | Harmonic mean of edge precision and recall | 0–1; higher is better |
        | Edge-density ratio | Output edge density divided by reference edge density | Near 1 retains similar detail; below 1 indicates simplification |
        | Global SSIM | Global luminance/contrast/structure similarity approximation | 0–1; higher is better |
        | Tonal correlation | Pearson correlation between reference and output grayscale values | −1 to 1; higher is better |
        | MAE | Mean absolute pixel difference on the 0–255 scale | 0–255; lower is better |
        | RMSE | Root mean squared pixel difference on the 0–255 scale | 0–255; lower is better |
        | PSNR | Peak signal-to-noise ratio derived from RMSE | dB; higher is better |
        | Chroma MAE | Mean absolute difference of Cb/Cr chroma channels | 0–255; lower is better |
        | Histogram intersection | Overlap between normalized RGB histograms | 0–1; higher is better |
        | Output success rate | Projects containing a readable output divided by eligible projects | 0–100%; higher is better |

        Edge matching uses a 3-pixel tolerance because extracted/stylized lines can be shifted slightly. Global SSIM is explicitly labelled as a lightweight global approximation, not the windowed `skimage` implementation.
        """
    ),
    markdown("## 2. Imports and configuration"),
    code(
        """
        from pathlib import Path
        from collections import Counter
        import csv
        import json
        import math
        import statistics

        try:
            from PIL import Image, ImageFilter
        except ImportError as exc:
            raise ImportError("Install Pillow first: %pip install Pillow") from exc

        # Works when launched from the repository root or ai-services/pipeline.
        cwd = Path.cwd().resolve()
        REPO_ROOT = cwd if (cwd / "backend" / "uploads").exists() else cwd.parents[1]
        if not (REPO_ROOT / "backend" / "uploads").exists():
            raise FileNotFoundError("Run this notebook inside the tata-vision repository.")

        OUTPUTS_ROOT = REPO_ROOT / "backend" / "uploads" / "outputs"
        RESULTS_DIR = REPO_ROOT / "ai-services" / "pipeline" / "evaluation_results"
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        EDGE_THRESHOLD = 24
        EDGE_TOLERANCE_PIXELS = 3
        MAX_EVALUATION_SIZE = (512, 512)

        print("Repository:", REPO_ROOT)
        print("Saved outputs:", OUTPUTS_ROOT)
        """
    ),
    markdown("## 3. Reusable metric functions"),
    code(
        """
        def load_rgb(path, size=None):
            image = Image.open(path).convert("RGB")
            image.thumbnail(MAX_EVALUATION_SIZE, Image.Resampling.LANCZOS)
            if size is not None and image.size != size:
                image = image.resize(size, Image.Resampling.LANCZOS)
            return image

        def flatten_gray(image):
            return list(image.convert("L").getdata())

        def mean(values):
            return sum(values) / len(values) if values else 0.0

        def mae(a, b):
            return mean([abs(x - y) for x, y in zip(a, b)])

        def rmse(a, b):
            return math.sqrt(mean([(x - y) ** 2 for x, y in zip(a, b)]))

        def psnr_from_rmse(value):
            return float("inf") if value == 0 else 20 * math.log10(255.0 / value)

        def pearson(a, b):
            ma, mb = mean(a), mean(b)
            numerator = sum((x - ma) * (y - mb) for x, y in zip(a, b))
            da = math.sqrt(sum((x - ma) ** 2 for x in a))
            db = math.sqrt(sum((y - mb) ** 2 for y in b))
            return numerator / (da * db) if da and db else 0.0

        def global_ssim(a, b):
            ma, mb = mean(a), mean(b)
            n = max(1, len(a) - 1)
            va = sum((x - ma) ** 2 for x in a) / n
            vb = sum((y - mb) ** 2 for y in b) / n
            cov = sum((x - ma) * (y - mb) for x, y in zip(a, b)) / n
            c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
            return ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2))

        def edge_mask(image, threshold=EDGE_THRESHOLD):
            gray = image.convert("L").filter(ImageFilter.FIND_EDGES)
            return gray.point(lambda p: 255 if p >= threshold else 0)

        def edge_metrics(reference, output, tolerance=EDGE_TOLERANCE_PIXELS):
            ref = edge_mask(reference)
            out = edge_mask(output)
            size = tolerance * 2 + 1
            ref_near = ref.filter(ImageFilter.MaxFilter(size))
            out_near = out.filter(ImageFilter.MaxFilter(size))
            rp, op = list(ref.getdata()), list(out.getdata())
            rnp, onp = list(ref_near.getdata()), list(out_near.getdata())
            ref_count = sum(v > 0 for v in rp)
            out_count = sum(v > 0 for v in op)
            matched_out = sum((o > 0 and rn > 0) for o, rn in zip(op, rnp))
            matched_ref = sum((r > 0 and on > 0) for r, on in zip(rp, onp))
            precision = matched_out / out_count if out_count else 0.0
            recall = matched_ref / ref_count if ref_count else 0.0
            f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
            density_ratio = out_count / ref_count if ref_count else 0.0
            return precision, recall, f1, density_ratio

        def colour_metrics(reference, output):
            ref = list(reference.getdata())
            out = list(output.getdata())
            differences = [abs(x - y) for p, q in zip(ref, out) for x, y in zip(p, q)]
            value_rmse = math.sqrt(mean([d * d for d in differences]))
            ref_ycc = list(reference.convert("YCbCr").getdata())
            out_ycc = list(output.convert("YCbCr").getdata())
            chroma = mean([abs(p[1] - q[1]) + abs(p[2] - q[2]) for p, q in zip(ref_ycc, out_ycc)]) / 2
            intersections = []
            for channel in range(3):
                hr = reference.histogram()[channel * 256:(channel + 1) * 256]
                ho = output.histogram()[channel * 256:(channel + 1) * 256]
                total = max(1, sum(hr))
                intersections.append(sum(min(x, y) for x, y in zip(hr, ho)) / total)
            return mean(differences), value_rmse, psnr_from_rmse(value_rmse), chroma, mean(intersections)

        def rounded(value, digits=4):
            if isinstance(value, float):
                return round(value, digits) if math.isfinite(value) else "inf"
            return value
        """
    ),
    markdown(
        """
        ## 4. Discover completed project outputs

        A project is eligible when `colouring_steps/01_original.png` and the stage output exist in the same project directory. This guarantees a known reference/output pair. No filename guessing or unrelated input matching is used.
        """
    ),
    code(
        """
        projects = []
        for project_dir in sorted(OUTPUTS_ROOT.iterdir(), key=lambda p: (not p.name.isdigit(), int(p.name) if p.name.isdigit() else p.name)):
            if not project_dir.is_dir():
                continue
            original = project_dir / "colouring_steps" / "01_original.png"
            if not original.exists():
                continue
            projects.append({
                "project_id": project_dir.name,
                "original": original,
                "geometric": project_dir / "geometric.png",
                "curve": project_dir / "curves.png",
                "shading": project_dir / "shading.png",
                "paprika_raw": project_dir / "colouring_steps" / "painting_model_raw.png",
                "colouring": project_dir / "colouring.png",
            })

        print(f"Eligible paired projects: {len(projects)}")
        for project in projects:
            available = [key for key, path in project.items() if key != "project_id" and path.exists()]
            print(project["project_id"], "→", ", ".join(available))
        """
    ),
    markdown("## 5. Evaluate SAM ViT-H geometric extraction"),
    code(
        """
        sam_rows = []
        for project in projects:
            if not project["geometric"].exists():
                continue
            reference = load_rgb(project["original"])
            output = load_rgb(project["geometric"], reference.size)
            precision, recall, f1, density = edge_metrics(reference, output)
            sam_rows.append({
                "project_id": project["project_id"],
                "edge_precision": precision,
                "edge_recall": recall,
                "edge_f1": f1,
                "edge_density_ratio": density,
            })
        print("SAM evaluated projects:", len(sam_rows))
        """
    ),
    markdown("## 6. Evaluate AnimeGANv2 Hayao curve extraction"),
    code(
        """
        hayao_rows = []
        for project in projects:
            if not project["curve"].exists():
                continue
            reference = load_rgb(project["original"])
            output = load_rgb(project["curve"], reference.size)
            precision, recall, f1, density = edge_metrics(reference, output)
            hayao_rows.append({
                "project_id": project["project_id"],
                "edge_precision": precision,
                "edge_recall": recall,
                "edge_f1": f1,
                "edge_density_ratio": density,
            })
        print("Hayao evaluated projects:", len(hayao_rows))
        """
    ),
    markdown("## 7. Evaluate Depth Anything V2 Small shading"),
    code(
        """
        depth_rows = []
        for project in projects:
            if not project["shading"].exists():
                continue
            reference = load_rgb(project["original"])
            output = load_rgb(project["shading"], reference.size)
            ref_gray, out_gray = flatten_gray(reference), flatten_gray(output)
            precision, recall, f1, density = edge_metrics(reference, output)
            depth_rows.append({
                "project_id": project["project_id"],
                "global_ssim": global_ssim(ref_gray, out_gray),
                "tonal_correlation": pearson(ref_gray, out_gray),
                "grayscale_mae": mae(ref_gray, out_gray),
                "edge_f1": f1,
            })
        print("Depth/shading evaluated projects:", len(depth_rows))
        """
    ),
    markdown("## 8. Evaluate AnimeGANv2 Paprika painted coloring"),
    code(
        """
        paprika_rows = []
        for project in projects:
            # Prefer the final pipeline result; report whether raw Paprika was also retained.
            if not project["colouring"].exists():
                continue
            reference = load_rgb(project["original"])
            output = load_rgb(project["colouring"], reference.size)
            colour_mae, colour_rmse, psnr, chroma_mae, histogram = colour_metrics(reference, output)
            precision, recall, f1, density = edge_metrics(reference, output)
            paprika_rows.append({
                "project_id": project["project_id"],
                "raw_model_output_saved": project["paprika_raw"].exists(),
                "colour_mae": colour_mae,
                "colour_rmse": colour_rmse,
                "psnr_db": psnr,
                "chroma_mae": chroma_mae,
                "rgb_histogram_intersection": histogram,
                "edge_f1": f1,
            })
        print("Paprika/final-coloring evaluated projects:", len(paprika_rows))
        """
    ),
    markdown(
        """
        ## 9. Evaluate automatic grayscale colorization

        Place paired images in:

        - `evaluation_data/colorization/ground_truth/<same-name>.png`
        - `evaluation_data/colorization/output/<same-name>.png`

        The ground-truth image must be the original color image. Create the model input by converting that image to grayscale, run the Caffe colorizer, and save its output using the same filename. The notebook then reports MAE, RMSE, PSNR, chroma MAE, histogram intersection, and global SSIM.

        If no pairs exist, the result is explicitly **Not measured**. This is scientifically preferable to assigning a value from visual opinion or fabricating a result.
        """
    ),
    code(
        """
        colourizer_root = REPO_ROOT / "evaluation_data" / "colorization"
        truth_dir = colourizer_root / "ground_truth"
        predicted_dir = colourizer_root / "output"
        colourizer_rows = []
        if truth_dir.exists() and predicted_dir.exists():
            for truth_path in sorted(truth_dir.iterdir()):
                predicted_path = predicted_dir / truth_path.name
                if not truth_path.is_file() or not predicted_path.exists():
                    continue
                reference = load_rgb(truth_path)
                output = load_rgb(predicted_path, reference.size)
                cmae, crmse, cpsnr, chroma, histogram = colour_metrics(reference, output)
                colourizer_rows.append({
                    "project_id": truth_path.stem,
                    "global_ssim": global_ssim(flatten_gray(reference), flatten_gray(output)),
                    "colour_mae": cmae,
                    "colour_rmse": crmse,
                    "psnr_db": cpsnr,
                    "chroma_mae": chroma,
                    "rgb_histogram_intersection": histogram,
                })
        print("Colorizer evaluated pairs:", len(colourizer_rows))
        if not colourizer_rows:
            print("RESULT: Not measured — no paired Caffe-colorizer ground truth/output files were found.")
        """
    ),
    markdown("## 10. Aggregate results and export document-ready tables"),
    code(
        """
        def aggregate(rows):
            if not rows:
                return {}
            numeric_keys = [
                key for key, value in rows[0].items()
                if key != "project_id" and isinstance(value, (int, float)) and not isinstance(value, bool)
            ]
            return {key: mean([float(row[key]) for row in rows]) for key in numeric_keys}

        summaries = {
            "Automatic grayscale colorization (Caffe)": aggregate(colourizer_rows),
            "SAM ViT-H geometric extraction": aggregate(sam_rows),
            "AnimeGANv2 Hayao curve extraction": aggregate(hayao_rows),
            "Depth Anything V2 Small shading": aggregate(depth_rows),
            "AnimeGANv2 Paprika final coloring": aggregate(paprika_rows),
        }
        counts = {
            "Automatic grayscale colorization (Caffe)": len(colourizer_rows),
            "SAM ViT-H geometric extraction": len(sam_rows),
            "AnimeGANv2 Hayao curve extraction": len(hayao_rows),
            "Depth Anything V2 Small shading": len(depth_rows),
            "AnimeGANv2 Paprika final coloring": len(paprika_rows),
        }

        metric_descriptions = {
            "Automatic grayscale colorization (Caffe)": "Global SSIM, color MAE/RMSE, PSNR, chroma MAE, RGB histogram intersection",
            "SAM ViT-H geometric extraction": "Edge precision, edge recall, edge F1-score, edge-density ratio",
            "AnimeGANv2 Hayao curve extraction": "Edge precision, edge recall, edge F1-score, edge-density ratio",
            "Depth Anything V2 Small shading": "Global SSIM, tonal correlation, grayscale MAE, edge F1-score",
            "AnimeGANv2 Paprika final coloring": "Color MAE/RMSE, PSNR, chroma MAE, RGB histogram intersection, edge F1-score",
        }

        report_rows = []
        for model, summary in summaries.items():
            result = "Not measured (paired output unavailable)" if not summary else "; ".join(
                f"{key}={rounded(value)}" for key, value in summary.items()
            )
            report_rows.append({
                "Model/component": model,
                "Evaluation metrics": metric_descriptions[model],
                "Sample count": counts[model],
                "Measured mean result": result,
            })

        widths = [max([len(key)] + [len(str(row[key])) for row in report_rows]) for key in report_rows[0]]
        header = list(report_rows[0])
        print(" | ".join(key.ljust(widths[i]) for i, key in enumerate(header)))
        print("-+-".join("-" * width for width in widths))
        for row in report_rows:
            print(" | ".join(str(row[key]).ljust(widths[i]) for i, key in enumerate(header)))

        with open(RESULTS_DIR / "document_ready_model_results.csv", "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=header)
            writer.writeheader()
            writer.writerows(report_rows)

        with open(RESULTS_DIR / "model_results.json", "w", encoding="utf-8") as handle:
            json.dump({"summary": report_rows, "per_project": {
                "colorizer": colourizer_rows, "sam": sam_rows, "hayao": hayao_rows,
                "depth": depth_rows, "paprika": paprika_rows,
            }}, handle, indent=2)

        print("\\nSaved:", RESULTS_DIR / "document_ready_model_results.csv")
        print("Saved:", RESULTS_DIR / "model_results.json")
        """
    ),
    markdown(
        """
        ## 11. Human evaluation sheet (required for artistic suitability)

        Ask at least 5 participants to rate every output from 1 (very poor) to 5 (excellent). Do not fill ratings on behalf of participants.

        | Model/component | Human evaluation metrics |
        |---|---|
        | Colorizer | Plausible colors, structural preservation, natural appearance |
        | SAM geometric extraction | Major-object preservation, simplicity, geometric-guide readability |
        | Hayao curve extraction | Important-curve preservation, noise reduction, curve-guide readability |
        | Depth shading | Depth readability, tonal consistency, pencil-texture quality |
        | Paprika coloring | Painterly quality, color consistency, detail preservation, overall usefulness |

        Enter collected ratings in `evaluation_data/human_ratings.csv` with columns `participant_id, project_id, model, metric, rating`. The following cell summarizes them.
        """
    ),
    code(
        """
        ratings_path = REPO_ROOT / "evaluation_data" / "human_ratings.csv"
        if ratings_path.exists():
            grouped = {}
            with open(ratings_path, newline="", encoding="utf-8") as handle:
                for row in csv.DictReader(handle):
                    grouped.setdefault((row["model"], row["metric"]), []).append(float(row["rating"]))
            for (model, metric), values in sorted(grouped.items()):
                print(model, "|", metric, "| n=", len(values), "| mean=", round(mean(values), 3), "| SD=", round(statistics.stdev(values), 3) if len(values) > 1 else 0.0)
        else:
            print("No human ratings file yet. Use the stated 1–5 protocol before claiming user-perceived quality results.")
        """
    ),
    markdown(
        """
        ## 12. Reporting notes for the EC05 document

        - Paste the model-specific metric names and measured mean values from `document_ready_model_results.csv` into the corresponding experiment tables.
        - State the number of evaluated image pairs (`n`) beside every result.
        - Report numeric values as means across the same paired test set; per-project evidence remains in `model_results.json`.
        - Do not call an edge-density ratio “accuracy.” It measures simplification/detail density.
        - Do not claim the automatic colorizer was numerically evaluated until paired ground-truth/output images are added.
        - Keep the qualitative human scores separate from reference-based image metrics.
        """
    ),
]

notebook = {
    "cells": cells,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

OUTPUT.write_text(json.dumps(notebook, indent=1), encoding="utf-8")
print(f"Wrote {OUTPUT}")
