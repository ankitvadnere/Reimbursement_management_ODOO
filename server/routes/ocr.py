import re
import json
from flask import Blueprint, request, jsonify
from routes.auth import login_required

ocr_bp = Blueprint("ocr", __name__)

try:
    import pytesseract
    from PIL import Image
    import io
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


def parse_ocr_text(text):
    """Extract amount, date, merchant from raw OCR text."""
    result = {
        "merchantName":      None,
        "amount":            None,
        "expenseDate":       None,
        "currencyCode":      "INR",
        "inferredCategory":  None,
        "confidence":        60,
        "raw":               text,
    }

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if lines:
        result["merchantName"] = lines[0]

    # Amount: look for patterns like 1,234.56 or ₹500 or $ 83.00
    amount_match = re.search(
        r'(?:total|amount|grand\s*total|subtotal)[^\d]*(\d[\d,]*\.?\d*)',
        text, re.IGNORECASE
    )
    if not amount_match:
        amount_match = re.search(r'[\$₹€£]?\s*(\d[\d,]*\.\d{2})', text)
    if amount_match:
        result["amount"] = float(amount_match.group(1).replace(",", ""))

    # Currency
    if re.search(r'\$|USD', text):
        result["currencyCode"] = "USD"
    elif re.search(r'€|EUR', text):
        result["currencyCode"] = "EUR"
    elif re.search(r'£|GBP', text):
        result["currencyCode"] = "GBP"

    # Date: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    date_match = re.search(
        r'(\d{4}[-/]\d{2}[-/]\d{2})|(\d{2}[-/]\d{2}[-/]\d{4})',
        text
    )
    if date_match:
        raw_date = date_match.group(0).replace("/", "-")
        parts = raw_date.split("-")
        if len(parts[0]) == 4:
            result["expenseDate"] = raw_date
        else:
            result["expenseDate"] = f"{parts[2]}-{parts[1]}-{parts[0]}"

    # Category inference
    text_lower = text.lower()
    if any(w in text_lower for w in ["restaurant", "cafe", "food", "meal", "dining", "swiggy", "zomato"]):
        result["inferredCategory"] = "Meals & Entertainment"
    elif any(w in text_lower for w in ["hotel", "lodge", "airbnb", "accommodation"]):
        result["inferredCategory"] = "Accommodation"
    elif any(w in text_lower for w in ["airline", "flight", "uber", "ola", "taxi", "train", "irctc"]):
        result["inferredCategory"] = "Travel"
    elif any(w in text_lower for w in ["amazon", "office", "stationery", "supplies"]):
        result["inferredCategory"] = "Office Supplies"
    elif any(w in text_lower for w in ["aws", "google", "microsoft", "software", "subscription"]):
        result["inferredCategory"] = "Software & Subscriptions"

    return result


@ocr_bp.route("/", methods=["POST"])
@login_required
def scan_receipt():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    if not OCR_AVAILABLE:
        # Return a graceful empty response so frontend still works
        return jsonify({
            "parsed": {
                "merchantName": None, "amount": None,
                "expenseDate": None, "currencyCode": "INR",
                "inferredCategory": None, "confidence": 0,
                "raw": "",
            },
            "warning": "OCR not available — fill in details manually",
        }), 200

    try:
        img_bytes = file.read()
        image     = Image.open(io.BytesIO(img_bytes))
        raw_text  = pytesseract.image_to_string(image)
        parsed    = parse_ocr_text(raw_text)
        return jsonify({"parsed": parsed}), 200
    except Exception as e:
        return jsonify({"error": f"OCR failed: {str(e)}"}), 500