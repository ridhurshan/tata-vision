"""
geometric.py  -  SAM based "main object -> coloured parts" extractor
=====================================================================

Pipeline (exactly the order requested)
  1. LOAD SAM            official `segment_anything` -> Ultralytics SAM -> classical fallback
  2. DETECT OBJECTS      YOLO-seg boxes refined by SAM  (fallback: SAM salient-object search, then GrabCut)
                         only the MAIN subject(s) are kept - small / off-centre / duplicate detections are dropped
  3. REMOVE BACKGROUND   everything outside the main object mask is thrown away
  4. ISOLATE PARTS       SAM "segment everything" runs ONLY inside each object (cropped, zoomed, background greyed
                         out) -> parts are cleaned, tiny / same-colour parts merged, edges smoothed
  5. COLOUR THE PARTS    every part gets its own distinct colour (neighbours never share one)
  6. DISPLAY             coloured parts only, numbered, with a legend that names the closest basic geometric
                         shape of every part (circle, ellipse, rectangle, square, triangle, pentagon ...)

Extras: SVG export, JSON report, per-part transparent PNGs, transparent cut-out, dashed best-fit shape overlay.

Quick use
    python geometric.py photo.jpg
    python geometric.py photo.jpg --ckpt sam_checkpoints/sam_vit_b_01ec64.pth --model vit_b

Flask / library use (same signature as before)
    generate_geometric(input_path, output_path, checkpoint_path, model_type="vit_h")
"""
import json
import math
import sys
import time
import urllib.request
import warnings
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
from scipy import ndimage as ndi

warnings.filterwarnings("ignore")


# ════════════════════════════════════════════════════════════════════════════
#  SETTINGS  (change here, or pass your own Config to analyse())
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class Config:
    # ── input / output ──
    image_source: Optional[str] = None        # path | URL | None (Colab upload / demo image)
    output_dir: Path = Path("geometric_output")
    max_image_side: int = 1600                # bigger photos are shrunk to this

    # ── 1. SAM ──
    sam_model_type: str = "vit_h"             # vit_h (best) | vit_l | vit_b (fastest, use on CPU)
    sam_checkpoint: Optional[str] = None      # explicit .pth path (else downloaded into sam_checkpoint_dir)
    sam_checkpoint_dir: Path = Path("sam_checkpoints")
    sam_auto_download: bool = True

    # ── 2. object detection ──
    detector: str = "auto"                    # 'auto' (YOLO, then salient fallback) | 'yolo' | 'saliency'
    yolo_size: str = "m"                      # n | s | m | l | x   (bigger = fewer missed objects)
    detector_conf: float = 0.30
    max_objects: int = 3                      # at most this many MAIN objects are kept
    min_object_frac: float = 0.01             # ignore objects smaller than 1 % of the picture
    main_object_rel: float = 0.30             # keep objects scoring >= 30 % of the best one (lower = more objects)
    ignore_labels: tuple = ()                 # e.g. ("chair", "bench") never treated as a subject

    # ── 4. parts ──
    parts_work_side: int = 800                # object is zoomed/shrunk to this size before SAM looks for parts
    parts_points_per_side: int = 32           # SAM grid density (16 = faster, 48 = more detail)
    max_parts_per_object: int = 10            # hard cap -> only the MAIN segments survive
    min_part_frac: float = 0.015              # parts smaller than 1.5 % of their object are merged into a neighbour
    merge_color_delta: float = 8.0            # neighbouring parts this similar in colour (Lab dE) are merged
    min_part_thickness: float = 0.008         # slivers thinner than this share of the object size are merged (0 = off)
    edge_smooth: float = 1.5                  # boundary smoothing (pixels)

    # ── 5/6. look ──
    view_side: int = 1000                     # long side of the displayed diagram
    show_numbers: bool = True
    show_legend: bool = True
    show_shape_outline: bool = False          # dashed best-fit basic shape drawn over every part
    background_color: Tuple[int, int, int] = (255, 255, 255)
    outline_color: Tuple[int, int, int] = (30, 30, 30)
    save_extras: bool = True                  # svg + json + part PNGs + cut-out (notebook / CLI)


CFG = Config()

try:
    import torch
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
except Exception:
    DEVICE = "cpu"


def log(*a):
    print("[geometric]", *a, flush=True)


# ════════════════════════════════════════════════════════════════════════════
#  IMAGE LOADING + SMALL HELPERS
# ════════════════════════════════════════════════════════════════════════════
def load_image(source=None, max_side=1600):
    """Return an RGB uint8 image (H, W, 3)."""
    rgb = None
    if source is None:
        try:                                                    # Google Colab upload
            from google.colab import files
            source = next(iter(files.upload()))
        except Exception:
            source = None
    if source is None:
        from skimage import data
        log("no image given -> using the built-in demo photo")
        rgb = data.astronaut()
    elif str(source).startswith(("http://", "https://")):
        import requests
        r = requests.get(source, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        bgr = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
        if bgr is None:
            raise ValueError("The URL did not return a readable image.")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    else:
        bgr = cv2.imread(str(source), cv2.IMREAD_COLOR)
        if bgr is None:
            raise FileNotFoundError(f"Cannot read image: {source}")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    s = min(1.0, max_side / max(h, w))
    if s < 1:
        rgb = cv2.resize(rgb, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    return np.ascontiguousarray(rgb)


def mask_iou(a, b):
    if a is None or b is None:
        return 0.0
    u = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum()) / float(u) if u else 0.0


def fill_by_nearest(lab, region):
    """Give every unlabelled pixel inside `region` the label of its nearest labelled pixel."""
    zero = (lab == 0) & region
    if not zero.any() or not (lab > 0).any():
        return lab
    idx = ndi.distance_transform_edt(lab == 0, return_distances=False, return_indices=True)
    out = lab.copy()
    out[zero] = lab[idx[0][zero], idx[1][zero]]
    return out


def relabel(lab):
    """Make labels contiguous 1..n (0 stays background)."""
    u = np.unique(lab)
    u = u[u > 0]
    lut = np.zeros(int(lab.max()) + 1, np.int32)
    lut[u] = np.arange(1, len(u) + 1)
    return lut[lab]


def split_components(lab, min_px=12):
    """Every connected piece of a label becomes its own label; pieces under `min_px` are dropped (-> 0)."""
    out = np.zeros_like(lab)
    nxt = 1
    for l, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None:
            continue
        sub = (lab[sl] == l).astype(np.uint8)
        n, cc = cv2.connectedComponents(sub, connectivity=4)
        for j in range(1, n):
            comp = cc == j
            if comp.sum() >= min_px:
                out[sl][comp] = nxt
                nxt += 1
    return out


def resample_labels(lab, out_hw, region=None, sigma=0.0):
    """Resize a label map with soft (anti-aliased) boundaries; optionally clip to `region`."""
    H, W = out_hw
    out = np.zeros((H, W), np.int32)
    ids = [int(i) for i in np.unique(lab) if i > 0]
    if not ids:
        return out
    interp = cv2.INTER_AREA if H * W < lab.size else cv2.INTER_LINEAR
    best = np.full((H, W), -1.0, np.float32)
    total = np.zeros((H, W), np.float32)
    for i in ids:
        f = cv2.resize((lab == i).astype(np.float32), (W, H), interpolation=interp)
        if sigma > 0:
            f = cv2.GaussianBlur(f, (0, 0), sigma)
        total += f
        u = f > best
        best[u] = f[u]
        out[u] = i
    if region is not None:
        out[~region] = 0
        out[region & (best < 1e-3)] = 0
        out = fill_by_nearest(out, region)
    else:
        out[total < 0.5] = 0                                  # background stays background
    return out


def boundaries(lab):
    b = np.zeros(lab.shape, bool)
    d = lab[:, :-1] != lab[:, 1:]
    b[:, :-1] |= d
    b[:, 1:] |= d
    d = lab[:-1, :] != lab[1:, :]
    b[:-1, :] |= d
    b[1:, :] |= d
    return b


def adjacency(lab, n):
    """(n+1)x(n+1) matrix: number of touching pixel pairs between labels (0 = background ignored)."""
    A = np.zeros((n + 1, n + 1), np.int64)
    for a, b in ((lab[:, :-1], lab[:, 1:]), (lab[:-1, :], lab[1:, :])):
        m = (a != b) & (a > 0) & (b > 0)
        if m.any():
            pair = a[m].astype(np.int64) * (n + 1) + b[m]
            cnt = np.bincount(pair, minlength=(n + 1) ** 2).reshape(n + 1, n + 1)
            A += cnt + cnt.T
    return A


def to_lab_float(rgb):
    return cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)


# ════════════════════════════════════════════════════════════════════════════
#  1. LOAD SAM
# ════════════════════════════════════════════════════════════════════════════
SAM_URLS = {"vit_h": "/models/sam_vit_h_4b8939.pth",
            "vit_l": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth",
            "vit_b": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"}


class SamEngine:
    """Common interface. The base class is the 'no SAM available' engine."""
    kind = "none"

    @property
    def ok(self):
        return self.kind != "none"

    def set_image(self, image): ...
    def box_mask(self, box): return None
    def point_masks(self, pts, labels): return []
    def auto_masks(self, image, points_per_side=32, min_area=100): return []


class OfficialSam(SamEngine):
    """Meta's segment_anything package (best quality, supports every prompt type)."""
    kind = "sam_official"

    def __init__(self, model_type, checkpoint):
        from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
        sam = sam_model_registry[model_type](checkpoint=str(checkpoint))
        sam.to(device=DEVICE)
        sam.eval()
        self.sam, self.predictor, self._AMG = sam, SamPredictor(sam), SamAutomaticMaskGenerator

    def set_image(self, image):
        self.predictor.set_image(image)                      # RGB uint8

    def box_mask(self, box):
        m, s, _ = self.predictor.predict(box=np.asarray(box, np.float32), multimask_output=False)
        return m[0].astype(bool), float(s[0])

    def point_masks(self, pts, labels):
        m, s, _ = self.predictor.predict(point_coords=np.asarray(pts, np.float32),
                                         point_labels=np.asarray(labels), multimask_output=True)
        return [(m[i].astype(bool), float(s[i])) for i in range(len(s))]

    def auto_masks(self, image, points_per_side=32, min_area=100):
        gen = self._AMG(self.sam, points_per_side=points_per_side, pred_iou_thresh=0.86,
                        stability_score_thresh=0.92, crop_n_layers=0, min_mask_region_area=int(min_area))
        return gen.generate(image)


class UltralyticsSam(SamEngine):
    """Fallback when only `ultralytics` is installed."""
    kind = "sam_ultralytics"

    def __init__(self, model_type):
        from ultralytics import SAM
        self.model = SAM("sam_b.pt" if model_type == "vit_b" else "sam_l.pt")
        self._bgr = None
        self._hw = None

    @staticmethod
    def _bgr_of(image):
        return np.ascontiguousarray(image[:, :, ::-1])

    def _masks(self, res, hw):
        if res.masks is None:
            return []
        out = []
        for mk in res.masks.data.cpu().numpy():
            if mk.shape != hw:
                mk = cv2.resize(mk.astype(np.uint8), (hw[1], hw[0]), interpolation=cv2.INTER_NEAREST)
            out.append(mk > 0)
        return out

    def set_image(self, image):
        self._bgr, self._hw = self._bgr_of(image), image.shape[:2]

    def box_mask(self, box):
        r = self.model.predict(self._bgr, bboxes=[[float(v) for v in box]], verbose=False, device=DEVICE)[0]
        ms = self._masks(r, self._hw)
        return (ms[0], 0.9) if ms else None

    def point_masks(self, pts, labels):
        r = self.model.predict(self._bgr, points=[[list(map(float, p)) for p in pts]],
                               labels=[list(map(int, labels))], verbose=False, device=DEVICE)[0]
        return [(m, 0.9) for m in self._masks(r, self._hw)]

    def auto_masks(self, image, points_per_side=32, min_area=100):
        r = self.model.predict(self._bgr_of(image), verbose=False, device=DEVICE)[0]
        return [dict(segmentation=m, area=int(m.sum()), predicted_iou=0.9, stability_score=0.9)
                for m in self._masks(r, image.shape[:2]) if m.sum() >= min_area]


_ENGINES = {}


def _resolve_checkpoint(cfg, checkpoint, model_type):
    """Find (or download) the .pth file. Returns (path | None, model_type inferred from the file name)."""
    if checkpoint and Path(checkpoint).is_file():
        p = Path(checkpoint)
        for mt in SAM_URLS:                                   # the file name tells the real model size
            if mt in p.name and mt != model_type:
                log(f"checkpoint name says {mt}, overriding model_type={model_type}")
                model_type = mt
        return p, model_type
    source = SAM_URLS[model_type]
    source_path = Path(source).expanduser()
    if source_path.is_file():
        return source_path.resolve(), model_type
    if not source.startswith(("http://", "https://")):
        log(f"SAM checkpoint not found: {source_path}")
        return None, model_type
    p = Path(cfg.sam_checkpoint_dir) / source.split("/")[-1]
    if p.is_file():
        return p, model_type
    if cfg.sam_auto_download:
        p.parent.mkdir(parents=True, exist_ok=True)
        log(f"downloading SAM {model_type} checkpoint (one time) ...")
        try:
            urllib.request.urlretrieve(source, p)
            return p, model_type
        except Exception as e:
            log("download failed ->", e)
    return None, model_type


def load_sam(cfg=CFG, checkpoint=None, model_type=None):
    """STEP 1 - load SAM once and reuse it."""
    model_type = model_type or cfg.sam_model_type
    checkpoint = checkpoint or cfg.sam_checkpoint
    key = (model_type, str(checkpoint))
    if key in _ENGINES:
        return _ENGINES[key]
    engine = SamEngine()
    ckpt, mt = _resolve_checkpoint(cfg, checkpoint, model_type)
    if ckpt is not None:
        try:
            engine = OfficialSam(mt, ckpt)
        except Exception as e:
            log(f"official SAM unavailable -> {type(e).__name__}: {str(e)[:120]}")
    if not engine.ok:
        try:
            engine = UltralyticsSam(model_type)
        except Exception as e:
            log(f"Ultralytics SAM unavailable -> {type(e).__name__}: {str(e)[:120]}")
    log(f"SAM engine: {engine.kind}  (device: {DEVICE})")
    if not engine.ok:
        log("WARNING: no SAM found - using the classical GrabCut + colour clustering fallback (lower quality)")
    _ENGINES[key] = engine
    return engine


# ════════════════════════════════════════════════════════════════════════════
#  2. DETECT THE MAIN OBJECT(S)
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class Obj:
    idx: int = 0
    label: str = "object"
    conf: float = 1.0
    box: Tuple[float, float, float, float] = (0, 0, 0, 0)
    mask: Optional[np.ndarray] = None            # bool H x W (full image)
    source: str = "yolo"
    score: float = 0.0


_YOLO = {}


def run_yolo(image, cfg):
    from ultralytics import YOLO
    name = f"yolo11{cfg.yolo_size}-seg.pt"
    if name not in _YOLO:
        _YOLO[name] = YOLO(name)
    h, w = image.shape[:2]
    res = _YOLO[name].predict(np.ascontiguousarray(image[:, :, ::-1]), conf=cfg.detector_conf, verbose=False,
                              device=DEVICE, agnostic_nms=True)[0]
    out = []
    if res.boxes is None:
        return out
    for i, b in enumerate(res.boxes):
        label = res.names[int(b.cls.item())]
        if label in cfg.ignore_labels:
            continue
        mask = None
        if res.masks is not None and i < len(res.masks.xy) and len(res.masks.xy[i]) >= 3:
            m = np.zeros((h, w), np.uint8)
            cv2.fillPoly(m, [np.round(res.masks.xy[i]).astype(np.int32)], 1)
            mask = m.astype(bool)
        out.append(Obj(label=label, conf=float(b.conf.item()), box=tuple(map(float, b.xyxy[0].tolist())),
                       mask=mask, source="yolo"))
    return out


def clean_mask(m, hole_frac=0.01):
    """Keep the big pieces, remove specks, close pin-holes (real holes such as a mug handle are kept)."""
    m = m.astype(np.uint8)
    n, cc, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n <= 1:
        return m > 0
    areas = st[1:, cv2.CC_STAT_AREA]
    keep = [i + 1 for i, a in enumerate(areas) if a >= 0.12 * areas.max()]
    m = np.isin(cc, keep).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    m = m > 0
    holes = ndi.binary_fill_holes(m) & ~m
    if holes.any():
        hl, hn = ndi.label(holes)
        sizes = ndi.sum(holes, hl, range(1, hn + 1))
        for k, sz in enumerate(sizes, 1):
            if sz < hole_frac * m.sum():
                m[hl == k] = True
    return m


def plausible_subject(m, max_border=0.40, lo=0.02, hi=0.85):
    h, w = m.shape
    frac = m.mean()
    border = (m[0].sum() + m[-1].sum() + m[:, 0].sum() + m[:, -1].sum()) / (2.0 * (h + w))
    return lo <= frac <= hi and border <= max_border


def find_salient(image, engine, cfg):
    """No detector result -> look for the most 'subject-like' SAM mask (centre, contrast, not the backdrop)."""
    h, w = image.shape[:2]
    objs = []
    if engine.ok:
        # (a) cheap: one positive point in the middle, negative points in the corners
        try:
            pts = [[w / 2, h / 2], [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]
            best = None
            for m, s in engine.point_masks(pts, [1, 0, 0, 0, 0]):
                if plausible_subject(m) and s >= 0.80:
                    val = s + 0.5 * m.mean()
                    if best is None or val > best[0]:
                        best = (val, m, s)
            if best:
                objs.append(Obj(label="subject", conf=best[2], mask=best[1], source="sam-point"))
        except Exception as e:
            log("point prompt failed ->", str(e)[:100])
        # (b) thorough: score every 'segment everything' mask
        if not objs:
            try:
                masks = engine.auto_masks(image, points_per_side=20, min_area=int(0.002 * h * w))
                s = 256.0 / max(h, w)
                sw, sh = max(8, round(w * s)), max(8, round(h * s))
                lab = to_lab_float(cv2.resize(image, (sw, sh), interpolation=cv2.INTER_AREA))
                cy, cx = sh / 2, sw / 2
                diag = math.hypot(cx, cy)
                scored = []
                for r in masks:
                    m = cv2.resize(r["segmentation"].astype(np.uint8), (sw, sh), interpolation=cv2.INTER_NEAREST) > 0
                    if not plausible_subject(m, 0.35, 0.02, 0.80):
                        continue
                    ys, xs = np.nonzero(m)
                    d = math.hypot(xs.mean() - cx, ys.mean() - cy) / diag
                    ring = (cv2.dilate(m.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0) & ~m
                    if ring.sum() < 10:
                        continue
                    contrast = float(np.linalg.norm(lab[m].mean(0) - lab[ring].mean(0)))
                    sc = math.sqrt(m.mean()) * (1 - 0.6 * d) * min(1.0, contrast / 40 + 0.2) * r.get("stability_score", 1)
                    scored.append((sc, r["segmentation"]))
                for sc, m in sorted(scored, key=lambda t: -t[0])[:cfg.max_objects * 3]:
                    objs.append(Obj(label="subject", conf=min(1.0, sc * 2), mask=m, source="sam-saliency", score=sc))
            except Exception as e:
                log("salient search failed ->", str(e)[:100])
    if not objs:                                              # (c) classical: GrabCut on the middle of the picture
        objs = grabcut_subject(image)
    return objs


def grabcut_subject(image):
    h, w = image.shape[:2]
    s = min(1.0, 480.0 / max(h, w))
    sw, sh = max(16, round(w * s)), max(16, round(h * s))
    small = cv2.cvtColor(cv2.resize(image, (sw, sh), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2BGR)
    mask = np.zeros((sh, sw), np.uint8)
    rect = (int(0.05 * sw), int(0.05 * sh), int(0.90 * sw), int(0.90 * sh))
    try:
        cv2.grabCut(small, mask, rect, np.zeros((1, 65)), np.zeros((1, 65)), 5, cv2.GC_INIT_WITH_RECT)
        fg = ((mask == 1) | (mask == 3)).astype(np.uint8)
        fg = cv2.resize(fg, (w, h), interpolation=cv2.INTER_NEAREST) > 0
    except Exception:
        fg = np.zeros((h, w), bool)
    if not (0.03 <= fg.mean() <= 0.92):
        return []
    return [Obj(label="subject", conf=0.5, mask=fg, source="grabcut")]


def select_main(objs, hw, cfg):
    """Keep only the dominant objects: big, central, confident. Drop duplicates and background clutter."""
    h, w = hw
    A = float(h * w)
    cx, cy, diag = w / 2, h / 2, math.hypot(w / 2, h / 2)
    keep = []
    for o in objs:
        if o.mask is None or not o.mask.any():
            continue
        o.mask = clean_mask(o.mask)
        area = o.mask.sum() / A
        if area < cfg.min_object_frac:
            continue
        ys, xs = np.nonzero(o.mask)
        d = math.hypot(xs.mean() - cx, ys.mean() - cy) / diag
        o.score = (area ** 0.7) * (0.6 + 0.4 * (1 - d)) * (0.5 + 0.5 * o.conf)
        keep.append(o)
    keep.sort(key=lambda o: -o.score)
    out = []
    for o in keep:
        dup = False
        for k in out:
            inter = np.logical_and(o.mask, k.mask).sum()
            if mask_iou(o.mask, k.mask) > 0.5 or inter > 0.8 * min(o.mask.sum(), k.mask.sum()):
                dup = True
                break
        if not dup:
            out.append(o)
    if not out:
        return []
    top = out[0].score
    out = [o for o in out if o.score >= cfg.main_object_rel * top][:cfg.max_objects]
    return out


def detect_main_objects(image, engine, cfg):
    """STEP 2 - find the main subject(s) and give each one a precise SAM mask."""
    h, w = image.shape[:2]
    if engine.ok:
        engine.set_image(image)                                # embeds the picture once
    objs = []
    if cfg.detector in ("auto", "yolo"):
        try:
            objs = run_yolo(image, cfg)
            log(f"detector: {len(objs)} raw detection(s)")
        except Exception as e:
            log(f"YOLO unavailable ({type(e).__name__}) -> salient-object search")
    if engine.ok:                                              # sharpen every box with SAM
        for o in objs:
            try:
                r = engine.box_mask(o.box)
            except Exception:
                r = None
            if r is not None and (o.mask is None or mask_iou(r[0], o.mask) >= 0.55):
                o.mask, o.source = r[0], "yolo+sam"
    objs = [o for o in objs if o.mask is not None]
    main = select_main(objs, (h, w), cfg)
    if not main and cfg.detector != "yolo":
        log("no detector hit -> searching for the salient subject")
        main = select_main(find_salient(image, engine, cfg), (h, w), cfg)
    if not main:
        log("nothing separable found -> treating the whole picture as the subject")
        main = [Obj(label="scene", mask=np.ones((h, w), bool), source="whole")]
    for i, o in enumerate(main, 1):
        ys, xs = np.nonzero(o.mask)
        o.box = (float(xs.min()), float(ys.min()), float(xs.max() + 1), float(ys.max() + 1))
        o.idx = i
        log(f"  main object {i}: {o.label} ({o.mask.mean() * 100:.0f}% of picture, via {o.source})")
    return main


# ════════════════════════════════════════════════════════════════════════════
#  3 + 4. REMOVE BACKGROUND, ISOLATE THE MAIN PARTS OF EVERY OBJECT
# ════════════════════════════════════════════════════════════════════════════
def crop_box(mask, shape, pad_frac=0.04):
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pad = int(pad_frac * max(x1 - x0, y1 - y0)) + 2
    h, w = shape
    return max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)


def labels_from_masks(raw, wm, cfg):
    """SAM masks (hierarchical: whole / part / sub-part) -> one label map. Smaller masks are painted on top."""
    area_obj = float(wm.sum())
    cands = []
    for r in raw:
        seg = r["segmentation"] & wm
        a = int(seg.sum())
        if a < 0.5 * cfg.min_part_frac * area_obj:
            continue
        if a / max(1, int(r["segmentation"].sum())) < 0.6:    # mostly background -> not a part of this object
            continue
        if a > 0.95 * area_obj:                               # the whole object itself, not a part
            continue
        cands.append((a, seg))
    cands.sort(key=lambda t: -t[0])
    lab = np.zeros(wm.shape, np.int32)
    for i, (_, seg) in enumerate(cands, 1):
        lab[seg] = i
    return lab


def kmeans_labels(wc, wm, cfg):
    """No-SAM fallback: colour + position clustering inside the object."""
    sm = cv2.bilateralFilter(cv2.bilateralFilter(wc, 9, 40, 40), 9, 40, 40)
    lab = to_lab_float(sm)
    h, w = wm.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sp = 35.0 / max(h, w)
    feats = np.dstack([lab, xx * sp, yy * sp])[wm].astype(np.float32)
    if len(feats) < 50:
        return wm.astype(np.int32)
    K = int(np.clip(cfg.max_parts_per_object // 2 + 1, 3, 8))
    _, labels, _ = cv2.kmeans(feats, K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 25, 1.0),
                              3, cv2.KMEANS_PP_CENTERS)
    out = np.zeros((h, w), np.int32)
    out[wm] = labels.ravel() + 1
    return out


def add_residual(lab, region, min_px):
    """Big unlabelled areas inside the object become their own part; small ones are left for nearest-fill."""
    res = (region & (lab == 0)).astype(np.uint8)
    n, cc, st, _ = cv2.connectedComponentsWithStats(res, connectivity=4)
    out = lab.copy()
    nxt = int(lab.max()) + 1
    for j in range(1, n):
        if st[j, cv2.CC_STAT_AREA] >= min_px:
            out[cc == j] = nxt
            nxt += 1
    return out


def part_thickness(lab, n):
    """Radius of the largest circle that fits inside every label (thin slivers have a tiny radius)."""
    th = np.zeros(n + 1)
    for l, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is not None:
            th[l] = ndi.distance_transform_edt(np.pad(lab[sl] == l, 1)).max()
    return th


def merge_parts(lab, lab_img, min_area, max_parts, color_delta, min_thick=0.0):
    """Merge tiny parts into the neighbour they share most border with, merge near-identical colours,
    and finally enforce the maximum number of parts. Works on bookkeeping tables (fast)."""
    n = int(lab.max())
    if n <= 1:
        return lab
    flat = lab.ravel()
    area = np.bincount(flat, minlength=n + 1).astype(np.float64)
    sums = np.stack([np.bincount(flat, weights=lab_img[..., c].ravel(), minlength=n + 1) for c in range(3)], 1)
    A = adjacency(lab, n).astype(np.float64)
    thick = part_thickness(lab, n) if min_thick > 0 else np.full(n + 1, 1e9)
    alive = np.ones(n + 1, bool)
    alive[0] = False
    parent = np.arange(n + 1)

    def mean(i):
        return sums[i] / max(area[i], 1.0)

    def dE(i, j):
        return float(np.linalg.norm(mean(i) - mean(j)))

    def merge(src, dst):
        A[dst, :] += A[src, :]
        A[:, dst] += A[:, src]
        A[src, :] = 0
        A[:, src] = 0
        A[dst, dst] = 0
        area[dst] += area[src]
        sums[dst] += sums[src]
        thick[dst] = max(thick[dst], thick[src])
        alive[src] = False
        parent[src] = dst

    while True:
        ids = np.flatnonzero(alive)
        if len(ids) <= 1:
            break
        thin = [i for i in ids if thick[i] < min_thick]
        if thin:                                               # 1a) sliver / outline fringe -> dissolved: its pixels
            i = min(thin, key=lambda k: area[k])               #     go to whichever neighbour is nearest (nearest-fill)
            alive[i], parent[i] = False, 0
            A[i, :] = 0
            A[:, i] = 0
            continue
        small = [i for i in ids if area[i] < min_area]
        if small:                                              # 1b) tiny blob -> longest-border neighbour
            i = min(small, key=lambda k: area[k])
            nb = np.flatnonzero(A[i] > 0)
            if len(nb) == 0:
                alive[i], parent[i] = False, 0                 # isolated speck, filled by nearest-label later
            else:
                merge(i, max(nb, key=lambda k: A[i, k]))
            continue
        if len(ids) > max_parts:                               # 2) too many -> fold the smallest away
            i = min(ids, key=lambda k: area[k])
            nb = np.flatnonzero(A[i] > 0)
            if len(nb) == 0:
                alive[i], parent[i] = False, 0
            else:
                merge(i, max(nb, key=lambda k: A[i, k] / (1.0 + dE(i, k) / 15.0)))
            continue
        best = None                                            # 3) neighbours with (almost) the same colour
        for i in ids:
            for j in np.flatnonzero(A[i] > 0):
                if j > i:
                    d = dE(i, j)
                    if best is None or d < best[0]:
                        best = (d, i, j)
        if best is not None and best[0] < color_delta:
            _, i, j = best
            merge(*((i, j) if area[i] < area[j] else (j, i)))
            continue
        break

    res = np.zeros(n + 1, np.int32)
    for k in range(1, n + 1):
        r = k
        while r != 0 and parent[r] != r:
            r = parent[r]
        res[k] = r
    return res[lab]


def segment_object_parts(image, obj, engine, cfg):
    """STEP 3+4 for ONE object: crop -> grey out background -> SAM everything -> clean -> label map.
    Returns (label map for the crop, 0 = not this object, crop box)."""
    box = crop_box(obj.mask, image.shape[:2])
    x0, y0, x1, y1 = box
    crop, m = image[y0:y1, x0:x1], obj.mask[y0:y1, x0:x1]
    ch, cw = m.shape
    if m.sum() < 400:                                          # too small to split
        return m.astype(np.int32), box
    s = cfg.parts_work_side / max(ch, cw)
    ww, wh = max(16, round(cw * s)), max(16, round(ch * s))
    wc = cv2.resize(crop, (ww, wh), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    wm = cv2.resize(m.astype(np.float32), (ww, wh), interpolation=cv2.INTER_LINEAR) > 0.5
    area = float(wm.sum())

    lab0 = None
    if engine.ok:
        try:
            inp = wc.copy()
            inp[~wm] = (127, 127, 127)                         # background removed: SAM only sees the object
            raw = engine.auto_masks(inp, cfg.parts_points_per_side, 0.002 * ww * wh)
            lab0 = labels_from_masks(raw, wm, cfg)
        except Exception as e:
            log(f"SAM part search failed -> {type(e).__name__}: {str(e)[:100]}")
    if lab0 is None or lab0.max() == 0:
        lab0 = kmeans_labels(wc, wm, cfg)

    lab = add_residual(lab0, wm, cfg.min_part_frac * area)
    lab = split_components(lab, min_px=max(8, int(0.0005 * area)))
    lab = relabel(fill_by_nearest(lab, wm))
    lab = merge_parts(lab, to_lab_float(wc), cfg.min_part_frac * area, cfg.max_parts_per_object,
                      cfg.merge_color_delta, cfg.min_part_thickness * max(wm.shape))
    lab = relabel(fill_by_nearest(lab, wm))

    # back to the crop's own resolution with smooth, anti-aliased borders; clipped to the exact object mask
    full = resample_labels(lab, (ch, cw), region=m, sigma=cfg.edge_smooth * max(1.0, 1.0 / s))
    full = split_components(full, min_px=max(25, int(0.0015 * m.sum())))
    full = relabel(fill_by_nearest(full, m))
    return full, box


# ════════════════════════════════════════════════════════════════════════════
#  PARTS  +  BEST-FIT BASIC SHAPE
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class Part:
    id: int
    obj_idx: int
    obj_label: str
    mask: np.ndarray                    # bool, cropped to the part's bounding box
    ox: int
    oy: int
    area: int
    frac_obj: float                     # share of its object
    centroid: Tuple[float, float]
    label_xy: Tuple[float, float]       # best spot for the number (deepest inside point)
    label_r: float                      # radius of the largest circle that fits there
    shape: str = "Freeform"
    shape_iou: float = 0.0
    outline: Optional[np.ndarray] = None   # best-fit shape polygon, image coordinates
    color: Tuple[int, int, int] = (200, 200, 200)

    @property
    def bbox(self):
        h, w = self.mask.shape
        return (self.ox, self.oy, self.ox + w, self.oy + h)


def _ellipse_poly(cx, cy, a, b, ang, n=72):
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x, y = a * np.cos(t), b * np.sin(t)
    ca, sa = math.cos(ang), math.sin(ang)
    return np.stack([cx + x * ca - y * sa, cy + x * sa + y * ca], 1)


def _raster_iou(poly, m):
    c = np.zeros(m.shape, np.uint8)
    cv2.fillPoly(c, [np.round(poly).astype(np.int32)], 1)
    inter = np.logical_and(c > 0, m).sum()
    union = np.logical_or(c > 0, m).sum()
    return float(inter) / float(union) if union else 0.0


POLY_NAMES = {3: "Triangle", 4: "Quadrilateral", 5: "Pentagon", 6: "Hexagon", 7: "Heptagon", 8: "Octagon"}


def fit_shape(mask, ox=0, oy=0):
    """Which basic shape is this part closest to?  Every candidate is rasterised and compared by IoU.
    Returns (name, iou, outline polygon in image coordinates or None)."""
    PAD = 4
    m = np.pad(mask.astype(np.uint8), PAD)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    M = cv2.moments(m, binaryImage=True)
    if not cnts or M["m00"] < 5:
        return "Freeform", 0.0, None
    c = max(cnts, key=cv2.contourArea)
    A = M["m00"]
    cx, cy = M["m10"] / A, M["m01"] / A
    mb = m > 0
    cands = {}

    r = math.sqrt(A / math.pi)                                  # circle of equal area
    cands["circle"] = _ellipse_poly(cx, cy, r, r, 0.0)

    cov = np.array([[M["mu20"], M["mu11"]], [M["mu11"], M["mu02"]]]) / A   # ellipse with the same moments
    ev, vec = np.linalg.eigh(cov)
    a, b = 2 * math.sqrt(max(ev[1], 1e-6)), 2 * math.sqrt(max(ev[0], 1e-6))
    cands["ellipse"] = _ellipse_poly(cx, cy, a, b, math.atan2(vec[1, 1], vec[0, 1]))

    rect = cv2.minAreaRect(c)                                   # tightest rotated rectangle
    cands["rectangle"] = cv2.boxPoints(rect)

    try:
        _, tri = cv2.minEnclosingTriangle(c.astype(np.float32))
        if tri is not None:
            cands["triangle"] = tri.reshape(-1, 2)
    except Exception:
        pass

    approx = cv2.approxPolyDP(c, 0.025 * cv2.arcLength(c, True), True).reshape(-1, 2)
    if 3 <= len(approx) <= 8 and cv2.isContourConvex(approx.reshape(-1, 1, 2).astype(np.int32)):
        cands["polygon"] = approx.astype(np.float32)

    scores = {k: _raster_iou(p, mb) for k, p in cands.items()}
    best = max(scores, key=scores.get)
    if best in ("ellipse", "polygon") and scores.get("circle", 0) >= scores[best] - 0.015 and b / max(a, 1e-6) > 0.88:
        best = "circle"
    if best == "polygon" and max(scores.get("rectangle", 0), scores.get("triangle", 0)) >= scores[best] - 0.01:
        best = "rectangle" if scores.get("rectangle", 0) >= scores.get("triangle", 0) else "triangle"
    iou = scores[best]

    if iou < 0.78:
        return "Freeform", iou, None
    if best == "ellipse" and b / max(a, 1e-6) > 0.92:
        best = "circle"
    if best == "rectangle":
        side = sorted(rect[1])
        name = "Square" if side[1] > 0 and side[0] / side[1] > 0.88 else "Rectangle"
    elif best == "polygon":
        name = POLY_NAMES[len(cands["polygon"])]
    else:
        name = best.capitalize()
    outline = cands[best] - PAD + np.array([ox, oy], np.float32)
    return name, iou, outline.astype(np.float32)


def make_part(pid, obj, mask, ox, oy, obj_area):
    pm = np.pad(mask.astype(np.uint8), 1)
    dist = cv2.distanceTransform(pm, cv2.DIST_L2, 5)
    yy, xx = np.unravel_index(int(dist.argmax()), dist.shape)
    cy, cx = ndi.center_of_mass(mask)
    p = Part(id=pid, obj_idx=obj.idx, obj_label=obj.label, mask=mask, ox=ox, oy=oy, area=int(mask.sum()),
             frac_obj=float(mask.sum()) / max(1, obj_area), centroid=(cx + ox, cy + oy),
             label_xy=(xx - 1 + ox, yy - 1 + oy), label_r=float(dist.max()))
    p.shape, p.shape_iou, p.outline = fit_shape(mask, ox, oy)
    return p


def build_parts(shape_hw, objs, labs):
    """Merge every object's label map into ONE global part map and create the Part records."""
    H, W = shape_hw
    plan, gid = [], 0
    for o, (lab, box) in zip(objs, labs):                       # numbering: object order, then big -> small
        ids = sorted(range(1, int(lab.max()) + 1), key=lambda k: -int((lab == k).sum()))
        plan.append((o, lab, box, {k: (gid := gid + 1) for k in ids}))
    part_map = np.zeros((H, W), np.int32)
    for o, lab, (x0, y0, x1, y1), g in sorted(plan, key=lambda t: -int(t[0].mask.sum())):   # small objects on top
        view = part_map[y0:y1, x0:x1]
        for k, gg in g.items():
            view[lab == k] = gg
    owner = {gg: o for o, _, _, g in plan for gg in g.values()}
    areas = np.bincount(part_map.ravel(), minlength=gid + 1)
    alive = [g for g in range(1, gid + 1) if areas[g] >= 20]    # parts fully hidden by another object vanish
    lut = np.zeros(gid + 1, np.int32)
    lut[alive] = np.arange(1, len(alive) + 1)
    part_map = lut[part_map]
    slices = ndi.find_objects(part_map)
    obj_area = {o.idx: int(o.mask.sum()) for o in objs}
    parts = []
    for new_id, g in enumerate(alive, 1):
        sl = slices[new_id - 1]
        if sl is None:
            continue
        o = owner[g]
        parts.append(make_part(new_id, o, part_map[sl] == new_id, sl[1].start, sl[0].start, obj_area[o.idx]))
    return part_map, parts


# ════════════════════════════════════════════════════════════════════════════
#  5. COLOURS  (every part distinct, neighbours always far apart)
# ════════════════════════════════════════════════════════════════════════════
PALETTE = [(0, 130, 200), (245, 130, 48), (60, 180, 75), (230, 25, 75), (145, 30, 180), (255, 225, 25),
           (70, 240, 240), (240, 50, 230), (128, 128, 0), (0, 128, 128), (170, 110, 40), (250, 190, 212),
           (128, 0, 0), (170, 255, 195), (220, 190, 255), (0, 0, 128), (255, 215, 180), (128, 128, 128),
           (210, 245, 60), (46, 139, 87), (255, 105, 180), (100, 100, 255)]


def assign_colors(parts, part_map):
    if not parts:
        return
    n = len(parts)
    A = adjacency(part_map, n)
    pal = np.array(PALETTE, np.uint8)
    pal_lab = to_lab_float(pal.reshape(1, -1, 3)).reshape(-1, 3)
    used = np.zeros(len(PALETTE), int)
    chosen = {}
    for p in sorted(parts, key=lambda q: -q.area):
        nb = [chosen[j] for j in np.flatnonzero(A[p.id]) if j in chosen]
        every = list(chosen.values())
        best, best_val = 0, -1e9
        for ci in range(len(PALETTE)):
            val = -1000.0 * used[ci]                            # unused colours first, then reuse the least used
            val += min([np.linalg.norm(pal_lab[ci] - pal_lab[k]) for k in nb], default=60.0)      # far from neighbours
            val += 0.6 * min([np.linalg.norm(pal_lab[ci] - pal_lab[k]) for k in every], default=60.0)   # and from all
            if val > best_val:
                best, best_val = ci, val
        chosen[p.id] = best
        used[best] += 1
        p.color = tuple(int(v) for v in PALETTE[best])


# ════════════════════════════════════════════════════════════════════════════
#  6. DISPLAY  (views, stages, legend)
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class View:
    """Crop around the subject + zoom so that every stage image shares the same frame."""
    x0: int
    y0: int
    x1: int
    y1: int
    scale: float

    @property
    def hw(self):
        return (max(1, round((self.y1 - self.y0) * self.scale)), max(1, round((self.x1 - self.x0) * self.scale)))

    def image(self, img):
        H, W = self.hw
        c = img[self.y0:self.y1, self.x0:self.x1]
        return cv2.resize(c, (W, H), interpolation=cv2.INTER_AREA if self.scale < 1 else cv2.INTER_CUBIC)

    def alpha(self, m):
        H, W = self.hw
        a = cv2.resize(m[self.y0:self.y1, self.x0:self.x1].astype(np.float32), (W, H),
                       interpolation=cv2.INTER_AREA if self.scale < 1 else cv2.INTER_LINEAR)
        return np.clip(cv2.GaussianBlur(a, (0, 0), 0.8), 0, 1)

    def labels(self, lab, region=None):
        return resample_labels(lab[self.y0:self.y1, self.x0:self.x1], self.hw, region, sigma=0.8)

    def pt(self, xy):
        return ((xy[0] - self.x0) * self.scale, (xy[1] - self.y0) * self.scale)


def make_view(fg, shape_hw, cfg):
    x0, y0, x1, y1 = crop_box(fg, shape_hw, pad_frac=0.06)
    return View(x0, y0, x1, y1, cfg.view_side / float(max(x1 - x0, y1 - y0)))


def checkerboard(h, w, cell=14):
    yy, xx = np.mgrid[0:h, 0:w]
    c = (((yy // cell) + (xx // cell)) % 2).astype(np.float32)
    return (235 + 14 * c)[..., None].repeat(3, 2)


def _thickness(h, w):
    return max(1, round(min(h, w) / 450))


def stage_detection(image, objs):
    """Stage 1 - what was found: background dimmed, main objects tinted and outlined."""
    out = (image.astype(np.float32) * 0.45)
    th = max(2, round(min(image.shape[:2]) / 300))
    for o in objs:
        col = np.array(PALETTE[(o.idx - 1) % len(PALETTE)], np.float32)
        m = o.mask
        out[m] = image[m] * 0.55 + col * 0.45
    out = out.astype(np.uint8)
    for o in objs:
        col = PALETTE[(o.idx - 1) % len(PALETTE)]
        cs, _ = cv2.findContours(o.mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(out, cs, -1, col, th, cv2.LINE_AA)
        x0, y0 = int(o.box[0]), int(o.box[1])
        tag = f"{o.idx}: {o.label} {o.conf * 100:.0f}%" if o.source.startswith("yolo") else f"{o.idx}: {o.label}"
        fs = max(0.5, min(image.shape[:2]) / 1100)
        (tw, tt), bl = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, fs, 2)
        y = max(tt + 8, y0)
        cv2.rectangle(out, (x0, y - tt - 8), (x0 + tw + 10, y + 2), col, -1)
        cv2.putText(out, tag, (x0 + 5, y - 4), cv2.FONT_HERSHEY_SIMPLEX, fs, (0, 0, 0), 2, cv2.LINE_AA)
    return out


def stage_cutout(view, image, fg):
    """Stage 2 - background removed (checkerboard = transparent)."""
    img = view.image(image).astype(np.float32)
    a = view.alpha(fg)[..., None]
    chk = checkerboard(*img.shape[:2])
    return (img * a + chk * (1 - a)).astype(np.uint8)


def draw_dashed(img, pts, color, th, dash=10, gap=7):
    pts = np.asarray(pts, np.float32)
    for i in range(len(pts)):
        p, q = pts[i], pts[(i + 1) % len(pts)]
        L = float(np.linalg.norm(q - p))
        if L < 1:
            continue
        d = (q - p) / L
        t = 0.0
        while t < L:
            e = min(t + dash, L)
            cv2.line(img, tuple(np.round(p + d * t).astype(int)), tuple(np.round(p + d * e).astype(int)),
                     color, th, cv2.LINE_AA)
            t += dash + gap


def _text_color(rgb):
    return (0, 0, 0) if 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 150 else (255, 255, 255)


def draw_legend(parts, objs, height, cfg):
    k = height / 900.0
    row = max(22, int(34 * k))
    width = int(360 * k)
    fs = 0.52 * k + 0.08
    th = 1 if fs < 0.7 else 2
    rows = [("title", None)]
    for o in objs:
        rows.append(("head", o))
        rows += [("part", p) for p in parts if p.obj_idx == o.idx]
    H = max(height, row * (len(rows) + 1))
    panel = np.full((H, width, 3), cfg.background_color, np.uint8)
    y = int(row * 0.9)
    pad = int(16 * k)
    for kind, it in rows:
        if kind == "title":
            cv2.putText(panel, "PARTS", (pad, y), cv2.FONT_HERSHEY_SIMPLEX, fs * 1.15, (40, 40, 40), th + 1, cv2.LINE_AA)
            cv2.line(panel, (pad, y + 8), (width - pad, y + 8), (190, 190, 190), 1, cv2.LINE_AA)
        elif kind == "head":
            n_parts = sum(1 for p in parts if p.obj_idx == it.idx)
            cv2.putText(panel, f"{it.label.title()}  ({n_parts} parts)", (pad, y), cv2.FONT_HERSHEY_SIMPLEX, fs,
                        (90, 90, 90), th, cv2.LINE_AA)
        else:
            sw = int(row * 0.62)
            cv2.rectangle(panel, (pad, y - sw + 4), (pad + sw, y + 4), it.color, -1)
            cv2.rectangle(panel, (pad, y - sw + 4), (pad + sw, y + 4), cfg.outline_color, 1, cv2.LINE_AA)
            cv2.putText(panel, f"{it.id}  {it.shape}", (pad + sw + 10, y), cv2.FONT_HERSHEY_SIMPLEX, fs,
                        (25, 25, 25), th, cv2.LINE_AA)
            pct = f"{it.frac_obj * 100:.0f}%"
            (tw, _), _ = cv2.getTextSize(pct, cv2.FONT_HERSHEY_SIMPLEX, fs, th)
            cv2.putText(panel, pct, (width - pad - tw, y), cv2.FONT_HERSHEY_SIMPLEX, fs, (110, 110, 110), th,
                        cv2.LINE_AA)
        y += row
    return panel


def render_parts(view, part_map, parts, objs, cfg, numbers=True, legend=True, shapes=False):
    """Coloured parts only - flat colours, clear outlines, optional numbers / legend / best-fit shapes."""
    fg_view = view.labels(part_map)                              # part ids at display resolution
    H, W = fg_view.shape
    lut = np.zeros((len(parts) + 1, 3), np.uint8)
    lut[0] = cfg.background_color
    for p in parts:
        lut[p.id] = p.color
    img = lut[fg_view].copy()
    t = _thickness(H, W)
    k3 = lambda s: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (s, s))
    edges = cv2.dilate(boundaries(fg_view).astype(np.uint8), k3(t)) > 0
    sil = cv2.dilate(boundaries((fg_view > 0).astype(np.int32)).astype(np.uint8), k3(t + 2)) > 0
    img[edges] = cfg.outline_color
    img[sil] = cfg.outline_color
    img = np.ascontiguousarray(img)

    if shapes:
        for p in parts:
            if p.outline is not None:
                pts = np.array([view.pt(q) for q in p.outline])
                dark = tuple(int(c * 0.45) for c in p.color)
                draw_dashed(img, pts, (255, 255, 255), t + 2)
                draw_dashed(img, pts, dark, t)
    if numbers:
        r = max(10, round(min(H, W) * 0.016))
        fs = r * 0.042
        for p in parts:
            if p.label_r * view.scale < 0.55 * r:
                continue
            cx, cy = (int(round(v)) for v in view.pt(p.label_xy))
            cv2.circle(img, (cx, cy), r, (255, 255, 255), -1, cv2.LINE_AA)
            cv2.circle(img, (cx, cy), r, cfg.outline_color, max(1, t - 1), cv2.LINE_AA)
            txt = str(p.id)
            (tw, tt), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, fs, max(1, t - 1))
            cv2.putText(img, txt, (cx - tw // 2, cy + tt // 2), cv2.FONT_HERSHEY_SIMPLEX, fs, (20, 20, 20),
                        max(1, t - 1), cv2.LINE_AA)
    if legend:
        panel = draw_legend(parts, objs, H, cfg)
        Hh = max(H, panel.shape[0])
        canvas = np.full((Hh, W + panel.shape[1], 3), cfg.background_color, np.uint8)
        canvas[:H, :W] = img
        canvas[:panel.shape[0], W:] = panel
        img = canvas
    return img


# ════════════════════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ════════════════════════════════════════════════════════════════════════════
@dataclass
class Result:
    image: np.ndarray
    objects: List[Obj]
    fg_mask: np.ndarray
    part_map: np.ndarray
    parts: List[Part]
    view: View
    stages: List[np.ndarray]              # [1 detection, 2 background removed, 3 parts, 4 final]
    final: np.ndarray
    engine: str = "none"
    seconds: float = 0.0


def analyse(image, cfg=CFG, engine=None):
    t0 = time.time()
    engine = engine or load_sam(cfg)                                       # 1. load SAM
    objs = detect_main_objects(image, engine, cfg)                         # 2. detect main object(s)
    fg = np.zeros(image.shape[:2], bool)                                   # 3. remove background
    for o in objs:
        fg |= o.mask
    log(f"background removed: kept {fg.mean() * 100:.0f}% of the picture")
    labs = []                                                              # 4. isolate parts
    for o in objs:
        lab, box = segment_object_parts(image, o, engine, cfg)
        labs.append((lab, box))
        log(f"  object {o.idx} ({o.label}): {int(lab.max())} main part(s)")
    part_map, parts = build_parts(image.shape[:2], objs, labs)
    assign_colors(parts, part_map)                                         # 5. colour
    view = make_view(fg, image.shape[:2], cfg)                             # 6. display
    s1 = stage_detection(image, objs)
    s2 = stage_cutout(view, image, fg)
    s3 = render_parts(view, part_map, parts, objs, cfg, numbers=False, legend=False)
    s4 = render_parts(view, part_map, parts, objs, cfg, numbers=cfg.show_numbers, legend=cfg.show_legend,
                      shapes=cfg.show_shape_outline)
    dt = time.time() - t0
    log(f"done: {len(objs)} object(s), {len(parts)} part(s) in {dt:.1f}s")
    return Result(image, objs, fg, part_map, parts, view, [s1, s2, s3, s4], s4, engine.kind, dt)


# ════════════════════════════════════════════════════════════════════════════
#  EXPORT
# ════════════════════════════════════════════════════════════════════════════
def _save_rgb(path, img):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    img = np.asarray(img)
    if img.dtype != np.uint8:
        img = np.clip(img, 0, 255).astype(np.uint8)
    if not cv2.imwrite(str(path), cv2.cvtColor(img, cv2.COLOR_RGB2BGR)):
        raise RuntimeError(f"Could not save image: {path}")
    return str(path)


def _save_rgba(path, rgb, alpha):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = np.dstack([cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    cv2.imwrite(str(path), rgba)


def parts_to_svg(res, path, cfg=CFG):
    """Editable vector drawing of the coloured parts (one <path> per part, in the diagram's coordinates)."""
    lab = res.view.labels(res.part_map)
    H, W = lab.shape
    hexc = lambda c: "#%02x%02x%02x" % tuple(c)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
           f'<rect width="{W}" height="{H}" fill="{hexc(cfg.background_color)}"/>']
    for p in res.parts:
        m = (lab == p.id).astype(np.uint8)
        cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = []
        for c in cs:
            if len(c) < 3:
                continue
            c = cv2.approxPolyDP(c, 0.9, True).reshape(-1, 2)
            d.append("M" + " L".join(f"{x},{y}" for x, y in c) + " Z")
        if d:
            out.append(f'<path id="part-{p.id}" d="{" ".join(d)}" fill="{hexc(p.color)}" fill-rule="evenodd" '
                       f'stroke="{hexc(cfg.outline_color)}" stroke-width="1.6" stroke-linejoin="round">'
                       f'<title>{p.id}: {p.shape} ({p.obj_label})</title></path>')
    out.append("</svg>")
    Path(path).write_text("\n".join(out), encoding="utf-8")


def part_to_dict(p, hw=None):
    return dict(mask=p.mask, ox=p.ox, oy=p.oy, area=p.area, color=p.color, id=p.id, object=p.obj_label,
                object_index=p.obj_idx, shape=p.shape, shape_iou=round(p.shape_iou, 3),
                fraction_of_object=round(p.frac_obj, 4), centroid=p.centroid, bbox=p.bbox)


def save_results(res, out_dir, cfg=CFG, save_extras=True):
    """Writes the 4 stage images, and (optionally) svg, json, cut-out and one transparent PNG per part."""
    d = Path(out_dir)
    names = ["01_detected_objects.png", "02_background_removed.png", "03_parts_isolated.png", "04_final_parts.png"]
    for n, im in zip(names, res.stages):
        _save_rgb(d / n, im)
    if save_extras:
        _save_rgba(d / "cutout.png", res.image, res.fg_mask.astype(np.float32))
        parts_to_svg(res, d / "parts.svg", cfg)
        for p in res.parts:
            x0, y0, x1, y1 = p.bbox
            _save_rgba(d / "parts" / f"part_{p.id:02d}_{p.shape.lower().replace(' ', '_')}.png",
                       res.image[y0:y1, x0:x1], p.mask.astype(np.float32))
        rep = dict(engine=res.engine, seconds=round(res.seconds, 2),
                   objects=[dict(index=o.idx, label=o.label, confidence=round(o.conf, 3), source=o.source,
                                 box=[round(v, 1) for v in o.box], area_fraction=round(float(o.mask.mean()), 4))
                            for o in res.objects],
                   parts=[{k: v for k, v in part_to_dict(p).items() if k != "mask"} | dict(color="#%02x%02x%02x" % p.color)
                          for p in res.parts])
        (d / "report.json").write_text(json.dumps(rep, indent=2, default=lambda o: list(o)), encoding="utf-8")
    return d


def show(res, steps=False):
    """Display in a notebook / window. Default: only the final coloured parts."""
    import matplotlib.pyplot as plt
    if steps:
        titles = ["1. main object found", "2. background removed", "3. parts isolated", "4. result"]
        fig, ax = plt.subplots(1, 4, figsize=(22, 6))
        for a, t, im in zip(ax, titles, res.stages):
            a.imshow(im)
            a.set_title(t)
            a.axis("off")
    else:
        plt.figure(figsize=(12, 7))
        plt.imshow(res.final)
        plt.axis("off")
    plt.tight_layout()
    plt.show()


# ════════════════════════════════════════════════════════════════════════════
#  FLASK / LIBRARY ENTRY POINT  (same signature and return keys as the old file)
# ════════════════════════════════════════════════════════════════════════════
def generate_geometric(input_path, output_path, checkpoint_path, model_type="vit_h", save_extras=False):
    log("[Stage 1] geometric extraction started")
    input_path, output_path, checkpoint_path = Path(input_path), Path(output_path), Path(checkpoint_path)
    if not input_path.is_file():
        raise FileNotFoundError(f"Input image not found: {input_path}")
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"SAM checkpoint not found: {checkpoint_path}")

    cfg = replace(CFG, sam_model_type=model_type, sam_checkpoint=str(checkpoint_path),
                  sam_checkpoint_dir=checkpoint_path.parent)
    image = load_image(input_path, cfg.max_image_side)
    res = analyse(image, cfg, load_sam(cfg, str(checkpoint_path), model_type))

    steps_dir = output_path.parent / "geometric_steps"
    step_names = ["01_extraction.png", "02_extraction.png", "03_extraction.png", "04_specific_shapes.png"]
    step_paths = [_save_rgb(steps_dir / n, im) for n, im in zip(step_names, res.stages)]
    _save_rgb(output_path, res.final)
    if save_extras:
        save_results(res, steps_dir / "extras", cfg, True)
    log("[Stage 1] steps saved:", steps_dir)
    log("[Stage 1] output saved:", output_path)

    comps = [part_to_dict(p) for p in res.parts]
    return {
        "working_image": image,
        "all_masks": comps,
        "final_masks": comps,
        "geometric_output": res.final,
        "extraction_stages": res.stages[:3],
        "specific_shapes_output": res.final,
        "steps_directory": str(steps_dir),
        "step_paths": step_paths,
        "all_step_paths": step_paths,
        "output_path": str(output_path),
        "result": res,
    }


# ════════════════════════════════════════════════════════════════════════════
#  COMMAND LINE / NOTEBOOK
# ════════════════════════════════════════════════════════════════════════════
def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description="SAM main-object -> coloured geometric parts")
    ap.add_argument("image", nargs="?", default=CFG.image_source, help="path or URL (omit for the demo image)")
    ap.add_argument("--ckpt", default=None, help="SAM .pth checkpoint")
    ap.add_argument("--model", default=CFG.sam_model_type, choices=list(SAM_URLS))
    ap.add_argument("--out", default=str(CFG.output_dir))
    ap.add_argument("--max-parts", type=int, default=CFG.max_parts_per_object)
    ap.add_argument("--detector", default=CFG.detector, choices=["auto", "yolo", "saliency"])
    ap.add_argument("--shapes", action="store_true", help="draw dashed best-fit shapes over the parts")
    ap.add_argument("--no-show", action="store_true")
    a = ap.parse_args(argv)

    cfg = replace(CFG, sam_model_type=a.model, sam_checkpoint=a.ckpt, output_dir=Path(a.out),
                  max_parts_per_object=a.max_parts, detector=a.detector, show_shape_outline=a.shapes)
    image = load_image(a.image, cfg.max_image_side)
    res = analyse(image, cfg)
    d = save_results(res, cfg.output_dir, cfg, cfg.save_extras)
    log("saved in", d.resolve())
    if not a.no_show:
        try:
            show(res)
        except Exception:
            pass
    return res


if __name__ == "__main__":
    main(sys.argv[1:] if not hasattr(sys, "ps1") and "ipykernel" not in sys.modules else [])
