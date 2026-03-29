import os
import uuid
from flask import Blueprint, request, jsonify, g, current_app
from werkzeug.utils import secure_filename
from db.connection import db
from routes.auth import login_required, role_required

expenses_bp = Blueprint("expenses", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "pdf"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def expense_row_to_dict(row):
    return {
        "id":                   str(row[0]),
        "employee_id":          str(row[1]),
        "description":          row[2],
        "category":             row[3],
        "date":                 str(row[4]),
        "paid_by":              row[5],
        "amount_original":      float(row[6]),
        "currency":             row[7],
        "amount_converted":     float(row[8]),
        "remarks":              row[9],
        "receipt_url":          row[10],
        "receipt_is_pdf":       row[11],
        "status":               row[12],
        "current_approver_id":  str(row[13]) if row[13] else None,
        "rule_id":              row[14],
        "approval_step":        row[15],
        "submitted_at":         str(row[16]) if row[16] else None,
        "created_at":           str(row[17]),
    }


# ── List expenses ─────────────────────────────────────────────────

@expenses_bp.route("/", methods=["GET"])
@login_required
def list_expenses():
    role = g.user["role"]
    uid  = g.user["id"]

    with db() as cur:
        if role == "employee":
            cur.execute("""
                SELECT id, employee_id, description, category, expense_date,
                       paid_by, amount_original, currency, amount_inr, remarks,
                       receipt_url, receipt_is_pdf, status, current_approver_id,
                       rule_id, approval_step, submitted_at, created_at
                FROM expenses WHERE employee_id = %s
                ORDER BY created_at DESC
            """, (uid,))
        elif role == "manager":
            cur.execute("""
                SELECT id, employee_id, description, category, expense_date,
                       paid_by, amount_original, currency, amount_inr, remarks,
                       receipt_url, receipt_is_pdf, status, current_approver_id,
                       rule_id, approval_step, submitted_at, created_at
                FROM expenses
                WHERE current_approver_id = %s
                   OR employee_id IN (
                       SELECT id FROM users WHERE manager_id = %s
                   )
                ORDER BY created_at DESC
            """, (uid, uid))
        elif role in ("finance", "admin"):
            cur.execute("""
                SELECT id, employee_id, description, category, expense_date,
                       paid_by, amount_original, currency, amount_inr, remarks,
                       receipt_url, receipt_is_pdf, status, current_approver_id,
                       rule_id, approval_step, submitted_at, created_at
                FROM expenses
                ORDER BY created_at DESC
            """)
        rows = cur.fetchall()

    return jsonify([expense_row_to_dict(r) for r in rows]), 200


# ── Create expense ────────────────────────────────────────────────

@expenses_bp.route("/", methods=["POST"])
@login_required
def create_expense():
    uid = g.user["id"]

    # Handle multipart (with receipt) or JSON
    if request.content_type and "multipart" in request.content_type:
        form            = request.form
        receipt_file    = request.files.get("receipt")
    else:
        form            = request.get_json() or {}
        receipt_file    = None

    description     = (form.get("description") or "").strip()
    category        = (form.get("category") or "General").strip()
    expense_date    = form.get("date") or form.get("expense_date")
    paid_by         = (form.get("paid_by") or "").strip()
    amount_original = float(form.get("amount_original") or 0)
    currency        = (form.get("currency") or "INR").strip().upper()
    remarks         = (form.get("remarks") or "").strip()
    status          = form.get("status", "waiting_approval")

    if not description or not expense_date or amount_original <= 0:
        return jsonify({"error": "description, date, and amount are required"}), 400

    # Convert to INR
    with db() as cur:
        cur.execute("SELECT rate_to_inr FROM exchange_rates WHERE currency = %s", (currency,))
        rate_row = cur.fetchone()
    rate = float(rate_row[0]) if rate_row else 1.0
    amount_inr = round(amount_original * rate, 2)

    # Save receipt file
    receipt_url   = None
    receipt_is_pdf = False
    if receipt_file and receipt_file.filename and allowed_file(receipt_file.filename):
        ext        = receipt_file.filename.rsplit(".", 1)[1].lower()
        filename   = f"{uuid.uuid4()}.{ext}"
        save_path  = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
        receipt_file.save(save_path)
        receipt_url    = f"/uploads/{filename}"
        receipt_is_pdf = ext == "pdf"

    with db() as cur:
        cur.execute("""
            INSERT INTO expenses (
                employee_id, description, category, expense_date,
                paid_by, amount_original, currency, amount_inr,
                remarks, receipt_url, receipt_is_pdf, status
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::expense_status)
            RETURNING id, employee_id, description, category, expense_date,
                      paid_by, amount_original, currency, amount_inr, remarks,
                      receipt_url, receipt_is_pdf, status, current_approver_id,
                      rule_id, approval_step, submitted_at, created_at
        """, (
            uid, description, category, expense_date,
            paid_by, amount_original, currency, amount_inr,
            remarks, receipt_url, receipt_is_pdf, status
        ))
        row = cur.fetchone()

    return jsonify(expense_row_to_dict(row)), 201


# ── Update expense (edit draft / submit) ──────────────────────────

@expenses_bp.route("/<expense_id>", methods=["PATCH"])
@login_required
def update_expense(expense_id):
    uid  = g.user["id"]
    role = g.user["role"]
    data = request.get_json() or {}

    with db() as cur:
        cur.execute("SELECT employee_id, status FROM expenses WHERE id = %s", (expense_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404

        owner_id, current_status = str(row[0]), row[1]

        # Only owner can edit; admins can patch anything
        if role != "admin" and owner_id != uid:
            return jsonify({"error": "Forbidden"}), 403

        # Build dynamic SET clause
        allowed = ["description", "category", "expense_date", "paid_by",
                   "amount_original", "currency", "remarks", "status"]
        sets, vals = [], []
        for field in allowed:
            if field in data:
                sets.append(f"{field} = %s" if field != "status" else f"{field} = %s::expense_status")
                vals.append(data[field])

        if not sets:
            return jsonify({"error": "Nothing to update"}), 400

        # Recalculate INR if amount or currency changed
        if "amount_original" in data or "currency" in data:
            cur.execute("""
                SELECT amount_original, currency FROM expenses WHERE id = %s
            """, (expense_id,))
            current = cur.fetchone()
            amt = float(data.get("amount_original", current[0]))
            ccy = data.get("currency", current[1]).upper()
            cur.execute("SELECT rate_to_inr FROM exchange_rates WHERE currency = %s", (ccy,))
            rate_row = cur.fetchone()
            rate = float(rate_row[0]) if rate_row else 1.0
            sets.append("amount_inr = %s")
            vals.append(round(amt * rate, 2))

        vals.append(expense_id)
        cur.execute(f"""
            UPDATE expenses SET {', '.join(sets)}, updated_at = now()
            WHERE id = %s
            RETURNING id, employee_id, description, category, expense_date,
                      paid_by, amount_original, currency, amount_inr, remarks,
                      receipt_url, receipt_is_pdf, status, current_approver_id,
                      rule_id, approval_step, submitted_at, created_at
        """, vals)
        updated = cur.fetchone()

    return jsonify(expense_row_to_dict(updated)), 200


# ── Approve / Reject ──────────────────────────────────────────────

@expenses_bp.route("/<expense_id>/action", methods=["POST"])
@login_required
def approval_action(expense_id):
    uid  = g.user["id"]
    data = request.get_json() or {}
    action  = data.get("action")   # 'approved' | 'rejected'
    comment = data.get("comment", "")

    if action not in ("approved", "rejected"):
        return jsonify({"error": "action must be 'approved' or 'rejected'"}), 400

    if action == "rejected" and not comment.strip():
        return jsonify({"error": "Comment required when rejecting"}), 400

    with db() as cur:
        # Verify this user is the current approver
        cur.execute("""
            SELECT current_approver_id, status, approval_step
            FROM expenses WHERE id = %s
        """, (expense_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Expense not found"}), 404

        current_approver, status, step = str(row[0]) if row[0] else None, row[1], row[2]

        if status != "waiting_approval":
            return jsonify({"error": "Expense is not pending approval"}), 409

        if current_approver != uid and g.user["role"] != "admin":
            return jsonify({"error": "You are not the current approver"}), 403

        # Insert approval action — the DB trigger handles the rest
        cur.execute("""
            INSERT INTO approval_actions (expense_id, approver_id, action, comment, step)
            VALUES (%s, %s, %s::approval_result, %s, %s)
        """, (expense_id, uid, action, comment, step))

        # Return the updated expense
        cur.execute("""
            SELECT id, employee_id, description, category, expense_date,
                   paid_by, amount_original, currency, amount_inr, remarks,
                   receipt_url, receipt_is_pdf, status, current_approver_id,
                   rule_id, approval_step, submitted_at, created_at
            FROM expenses WHERE id = %s
        """, (expense_id,))
        updated = cur.fetchone()

    return jsonify(expense_row_to_dict(updated)), 200


# ── Get approval log for one expense ─────────────────────────────

@expenses_bp.route("/<expense_id>/actions", methods=["GET"])
@login_required
def get_actions(expense_id):
    with db() as cur:
        cur.execute("""
            SELECT aa.id, aa.expense_id, aa.approver_id, u.name,
                   aa.action, aa.comment, aa.step, aa.acted_at
            FROM approval_actions aa
            JOIN users u ON u.id = aa.approver_id
            WHERE aa.expense_id = %s
            ORDER BY aa.acted_at ASC
        """, (expense_id,))
        rows = cur.fetchall()

    return jsonify([{
        "id":           row[0],
        "expense_id":   str(row[1]),
        "approver_id":  str(row[2]),
        "approver_name": row[3],
        "action":       row[4],
        "comment":      row[5],
        "step":         row[6],
        "acted_at":     str(row[7]),
    } for row in rows]), 200