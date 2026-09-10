"""

OpenCV-powered image quality checks.
Runs BEFORE the AI model to catch bad images early.

Checks:
  1. Blur detection     — is the image too blurry?
  2. Brightness check   — is it too dark or too bright?
  3. Size check         — is it large enough for analysis?
"""

import cv2
import numpy as np
from PIL import Image
import io


def check_image_quality(image_bytes: bytes) -> dict:
    """
    Run all quality checks on the uploaded image.

    Returns:
      {
        "passed": True/False,
        "issues": ["Image is too blurry", ...],   # empty if passed
        "blur_score": 245.3,                       # higher = sharper
        "brightness": 128.5,                       # 0=black, 255=white
        "width": 450,
        "height": 600,
      }
    """
    issues = []

    # ── Convert bytes → numpy array (OpenCV format) ───────────────
    # PIL opens the image, converts to RGB, then to numpy array
    try:
        pil_img   = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img_array = np.array(pil_img)
        img_bgr   = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    except Exception:
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_bgr is None:
                raise ValueError("Could not decode")
        except Exception:
            return {
                "passed": False,
                "issues": ["Could not decode the image file. Please upload a valid image."],
                "blur_score": 0.0,
                "brightness": 0.0,
                "width": 0,
                "height": 0,
            }

    height, width = img_bgr.shape[:2]

    # ── Check 1: Minimum size ─────────────────────────────────────
    # Images smaller than 100x100 are too small for skin analysis
    if width < 100 or height < 100:
        issues.append(
            f"Image too small ({width}x{height}px). "
            f"Please use an image of at least 100x100 pixels."
        )

    # ── Check 2: Blur detection using Laplacian variance ──────────
    # How it works:
    #   - Laplacian is an edge detector
    #   - Sharp images have strong edges → high variance
    #   - Blurry images have weak edges → low variance
    #   - Threshold: below 80 = too blurry for accurate analysis
    gray       = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()

    if blur_score < 80:
        issues.append(
            f"Image appears blurry (sharpness score: {blur_score:.1f}). "
            f"Please take a clearer, focused photo."
        )

    # ── Check 3: Brightness check ─────────────────────────────────
    # Mean pixel value in grayscale
    # 0   = completely black
    # 255 = completely white
    # Good range: 40–220
    brightness = float(np.mean(gray))

    if brightness < 40:
        issues.append(
            f"Image is too dark (brightness: {brightness:.0f}/255). "
            f"Please take the photo in better lighting."
        )
    elif brightness > 220:
        issues.append(
            f"Image is overexposed (brightness: {brightness:.0f}/255). "
            f"Please avoid direct flash or bright light."
        )

    return {
        "passed":     len(issues) == 0,
        "issues":     issues,
        "blur_score": round(float(blur_score), 2),
        "brightness": round(brightness, 2),
        "width":      int(width),
        "height":     int(height),
    }