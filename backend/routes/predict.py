"""
backend/routes/predict.py
Updated for:
  - EfficientNetB3 / MobileNetV2 .keras format
  - class_indices.json (no hardcoded class names)
  - 224x224 input (MobileNet) — change to 300x300 if you used EfficientNetB3
"""

import io
import json
import os
import numpy as np
from PIL import Image
from fastapi import APIRouter, UploadFile, File, HTTPException
import tensorflow as tf  # pyrefly: ignore[missing-import]
from routes.image_utils import check_image_quality

router = APIRouter()

# ── Paths ────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR  = os.path.join(BASE_DIR, '..', 'model')
MODEL_H5   = os.path.join(MODEL_DIR, 'skin_disease_model.h5')
MODEL_KERAS = os.path.join(MODEL_DIR, 'skin_disease_model.keras')
MODEL_PATH = MODEL_H5 if os.path.exists(MODEL_H5) else MODEL_KERAS
IDX_PATH   = os.path.join(MODEL_DIR, 'class_indices.json')

# ── Load model once at startup ────────────────────────────────────
try:
    model = tf.keras.models.load_model(os.path.abspath(MODEL_PATH))
    print("[OK] Model loaded:", MODEL_PATH)
except Exception as e:
    print(f"[ERROR] Model load failed: {e}")
    model = None

# ── Load class indices ────────────────────────────────────────────
# class_indices.json: {"actinic_keratosis": 0, "basal_cell_carcinoma": 1, ...}
# We invert it to: {0: "actinic_keratosis", 1: "basal_cell_carcinoma", ...}
try:
    with open(os.path.abspath(IDX_PATH)) as f:
        class_indices = json.load(f)
    CLASS_NAMES = {v: k for k, v in class_indices.items()}
    print("[OK] Class indices loaded:", CLASS_NAMES)
except Exception as e:
    print(f"[ERROR] class_indices.json load failed: {e}")
    CLASS_NAMES = {}

# ── Image size ────────────────────────────────────────────────────
# MobileNetV2  → 224
# EfficientNetB3 → 300
IMG_SIZE = 224   # change to 300 if you used EfficientNetB3

# ── Recommendations database ──────────────────────────────────────
RECOMMENDATIONS = {
    'melanoma': {
        'display_name': 'Melanoma',
        'description': (
            'Melanoma is the most dangerous form of skin cancer. '
            'It develops in the cells (melanocytes) that produce melanin. '
            'Early detection is critical for successful treatment.'
        ),
        'severity': 'Critical',
        'urgency': 'See a certified dermatologist within 48 hours.',
        'dos': [
            'Visit a dermatologist immediately — do not delay',
            'Take clear photographs of the lesion to track changes',
            'Apply SPF 50+ sunscreen to all exposed skin daily',
            'Wear UV-protective clothing and hats outdoors',
            'Inform your doctor of any family history of skin cancer',
        ],
        'donts': [
            'Do NOT delay medical consultation even by a week',
            'Do not expose the area to sunlight or tanning beds',
            'Do not scratch, pick, or irritate the lesion',
            'Do not attempt home remedies or self-medication',
        ],
        'specialist': 'Oncological Dermatologist',
        'otc_note': 'No OTC treatment — requires prescription/surgical management.',
    },
    'nevus': {
        'display_name': 'Melanocytic Nevus (Mole)',
        'description': (
            'A common benign growth formed by clusters of pigmented cells. '
            'Most moles are harmless, but monitor for changes in size, '
            'shape, or color.'
        ),
        'severity': 'Low',
        'urgency': 'Not urgent. Schedule a routine check within 1 month.',
        'dos': [
            'Monitor using ABCDE rule (Asymmetry, Border, Color, Diameter, Evolution)',
            'Have an annual full-body skin exam',
            'Apply SPF 30+ sunscreen daily',
            'Photograph monthly to track changes',
        ],
        'donts': [
            'Do not pick or scratch the mole',
            'Avoid prolonged sun exposure',
            'Do not attempt home removal',
        ],
        'specialist': 'General Dermatologist',
        'otc_note': 'Daily sunscreen SPF 30+ recommended.',
    },
    'basal_cell_carcinoma': {
        'display_name': 'Basal Cell Carcinoma',
        'description': (
            'The most common form of skin cancer. Grows slowly and rarely '
            'spreads, but must be treated to prevent local tissue damage.'
        ),
        'severity': 'High',
        'urgency': 'Schedule a dermatologist appointment within 1–2 weeks.',
        'dos': [
            'Consult a dermatologist for biopsy confirmation',
            'Use SPF 50+ sunscreen every day',
            'Cover skin when outdoors',
            'Follow prescribed treatment plan',
        ],
        'donts': [
            'Do not ignore even if it seems small or painless',
            'Avoid direct sunlight on the affected area',
            'Do not self-diagnose without a biopsy',
        ],
        'specialist': 'Dermatologist / Dermatologic Surgeon',
        'otc_note': 'Requires prescription treatment only.',
    },
    'actinic_keratosis': {
        'display_name': 'Actinic Keratosis',
        'description': (
            'Rough, scaly patches caused by years of sun damage. '
            'A pre-cancerous condition that can progress to squamous '
            'cell carcinoma if untreated.'
        ),
        'severity': 'Moderate',
        'urgency': 'Schedule a dermatologist visit within 2 weeks.',
        'dos': [
            'Visit a dermatologist for proper evaluation',
            'Apply prescribed topical treatments',
            'Protect skin with SPF 50+ sunscreen daily',
            'Wear protective clothing outdoors',
        ],
        'donts': [
            'Do not pick or scratch the patches',
            'Avoid prolonged sun exposure',
            'Do not skip follow-up appointments',
        ],
        'specialist': 'Dermatologist',
        'otc_note': 'Sunscreen SPF 50+ essential. Prescription creams for treatment.',
    },
    'benign_keratosis': {
        'display_name': 'Benign Keratosis',
        'description': (
            'Non-cancerous skin growths including seborrheic keratoses. '
            'Common with aging. Generally harmless and require no treatment '
            'unless bothersome.'
        ),
        'severity': 'Low',
        'urgency': 'Not urgent. Visit a dermatologist if it changes or bleeds.',
        'dos': [
            'Monitor for changes in size, shape, or color',
            'Keep skin moisturized',
            'Consult a dermatologist if it grows rapidly',
        ],
        'donts': [
            'Do not attempt home removal',
            'Do not scratch — can cause infection',
        ],
        'specialist': 'General Dermatologist',
        'otc_note': 'Moisturizers and gentle cleansers. No treatment required.',
    },
    'dermatofibroma': {
        'display_name': 'Dermatofibroma',
        'description': (
            'A common benign skin nodule, usually on legs. Firm to touch, '
            'pink/brown in color. Harmless and rarely requires treatment.'
        ),
        'severity': 'Low',
        'urgency': 'Not urgent. See a doctor only if it grows rapidly or causes pain.',
        'dos': [
            'Keep the area clean',
            'Monitor for rapid size increase',
            'Visit a doctor if it becomes painful or bleeds',
        ],
        'donts': [
            'Do not attempt home removal',
            'Avoid trauma to the area',
        ],
        'specialist': 'General Dermatologist',
        'otc_note': 'No OTC treatment needed.',
    },
    'vascular_lesion': {
        'display_name': 'Vascular Lesion',
        'description': (
            'Abnormalities of blood vessels near the skin surface such as '
            'cherry angiomas. Most are benign but some may need evaluation.'
        ),
        'severity': 'Low',
        'urgency': 'Generally harmless. See a doctor if it bleeds or grows rapidly.',
        'dos': [
            'Monitor for changes in size or bleeding',
            'Consult a dermatologist if it bleeds frequently',
            'Protect from trauma',
        ],
        'donts': [
            'Do not scratch or pick',
            'Do not ignore sudden appearance of many new lesions',
        ],
        'specialist': 'Dermatologist / Vascular Specialist',
        'otc_note': 'No OTC treatment. Laser therapy available for removal.',
    },
}


import cv2

# ── Preprocessing (OpenCV) ─────────────────────────────────────────
def preprocess_image(image_bytes: bytes) -> np.ndarray:
    # Step 1: Decode image bytes. PIL supports all formats and converts RGBA/palette to RGB.
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        image = np.array(pil_img)
    except Exception:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Image could not be decoded.")
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Step 2: Resize to model input size (224x224)
    image = cv2.resize(image, (IMG_SIZE, IMG_SIZE))

    # Step 3: Convert pixel values to float32
    image = image.astype(np.float32)

    # Step 4: Normalize pixel values (0.0 to 1.0)
    image = image / 255.0

    # Step 5: Add batch dimension (1, 224, 224, 3)
    image = np.expand_dims(image, axis=0)

    return image


# ── Predict endpoint ──────────────────────────────────────────────
@router.post("/predict")
async def predict(file: UploadFile = File(...)):

    # Validate file type - allow all image formats
    is_image = (
        (file.content_type and file.content_type.startswith("image/"))
        or (file.filename and file.filename.lower().endswith(
            (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tiff", ".tif", ".jfif", ".avif", ".heic", ".heif", ".ico", ".svg")
        ))
    )
    if not is_image:
        raise HTTPException(400, "Please upload a valid image file.")

    if model is None:
        raise HTTPException(503, "Model not loaded. Check server logs.")

    if not CLASS_NAMES:
        raise HTTPException(503, "Class indices not loaded. Check server logs.")

    contents = await file.read()

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Maximum 10MB.")

    # OpenCV image quality check
    quality = check_image_quality(contents)
    if not quality["passed"]:
        raise HTTPException(
            status_code=400,
            detail={
                "type": "quality_error",
                "message": "Image quality check failed.",
                "issues": quality["issues"],
                "blur_score": quality["blur_score"],
                "brightness": quality["brightness"],
            }
        )

    try:
        img_array  = preprocess_image(contents)
        preds      = model.predict(img_array, verbose=0)[0]  # shape: (7,)

        top_idx    = int(np.argmax(preds))
        confidence = float(preds[top_idx])
        disease_key = CLASS_NAMES[top_idx]
        rec = RECOMMENDATIONS.get(disease_key, {})

        # Top 3 predictions
        top3_idx = np.argsort(preds)[::-1][:3]
        top3 = [
            {
                "disease":    RECOMMENDATIONS.get(
                                CLASS_NAMES[i], {}
                              ).get('display_name', CLASS_NAMES[i]),
                "confidence": round(float(preds[i]) * 100, 2),
            }
            for i in top3_idx
        ]

        return {
            "success":           True,
            "predicted_disease": rec.get("display_name", disease_key),
            "confidence":        round(confidence * 100, 2),
            "severity":          rec.get("severity"),
            "description":       rec.get("description"),
            "urgency":           rec.get("urgency"),
            "dos":               rec.get("dos", []),
            "donts":             rec.get("donts", []),
            "specialist":        rec.get("specialist"),
            "otc_note":          rec.get("otc_note"),
            "top3_predictions":  top3,
            "confidence_note": (
                "Low confidence — image may be unclear. Please consult a doctor."
                if confidence < 0.55 else None
            ),
            "disclaimer": (
                "This tool is for educational purposes only and does NOT "
                "replace professional medical advice. Always consult a "
                "qualified dermatologist."
            ),
        }

    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {str(e)}")