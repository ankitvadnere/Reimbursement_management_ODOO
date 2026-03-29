from flask import Blueprint, request, jsonify, g
import bcrypt
from db.connection import db
from routes.auth import login_required, role_required

users_bp = Blueprint("users", __name__)


def user_row_to_dict(row):
    return {
        "id":         str(row[0]),
        "name":       row[1],
        "email":      row[2],
        "role":       row[3],
        "country":    row[4],
        "manager_id": str(row[5]) if row[5] else None,
        "created_at": str(row[6]),
    }


@users_bp.route("/", methods=["GET"])
@login_required
def list_users():
    """Admins see all users; managers see their team."""
    role = g.user["role"]
    uid  = g.user["id"]

    with db() as cur:
        if role == "admin":
            cur.execute("""
                SELECT id, name, email, role, country, manager_id, created_at
                FROM users ORDER BY created_at
            """)
        elif role == "manager":
            cur.execute("""
                SELECT id, name, email, role, country, manager_id, created_at
                FROM users WHERE manager_id = %s ORDER BY name
            """, (uid,))
        else:
            cur.execute("""
                SELECT id, name, email, role, country, manager_id, created_at
                FROM users WHERE id = %s
            """, (uid,))
        rows = cur.fetchall()

    return jsonify([user_row_to_dict(r) for r in rows]), 200


@users_bp.route("/<user_id>", methods=["PATCH"])
@login_required
@role_required("admin")
def update_user(user_id):
    data = request.get_json() or {}
    allowed = ["name", "role", "country", "manager_id"]
    sets, vals = [], []

    for field in allowed:
        if field in data:
            if field == "role":
                sets.append("role = %s::user_role")
            else:
                sets.append(f"{field} = %s")
            vals.append(data[field] or None)

    if "password" in data and data["password"]:
        hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()
        sets.append("password = %s")
        vals.append(hashed)

    if not sets:
        return jsonify({"error": "Nothing to update"}), 400

    vals.append(user_id)
    with db() as cur:
        cur.execute(f"""
            UPDATE users SET {', '.join(sets)}
            WHERE id = %s
            RETURNING id, name, email, role, country, manager_id, created_at
        """, vals)
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404

    return jsonify(user_row_to_dict(row)), 200


@users_bp.route("/", methods=["POST"])
@login_required
@role_required("admin")
def create_user():
    data       = request.get_json() or {}
    name       = (data.get("name") or "").strip()
    email      = (data.get("email") or "").strip().lower()
    password   = (data.get("password") or "").strip()
    role       = data.get("role", "employee")
    country    = (data.get("country") or "IN").upper()
    manager_id = data.get("manager_id") or None

    if not name or not email or not password:
        return jsonify({"error": "name, email, password required"}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        with db() as cur:
            cur.execute("""
                INSERT INTO users (name, email, password, role, country, manager_id)
                VALUES (%s, %s, %s, %s::user_role, %s, %s)
                RETURNING id, name, email, role, country, manager_id, created_at
            """, (name, email, hashed, role, country, manager_id))
            row = cur.fetchone()
    except Exception as e:
        if "unique" in str(e).lower():
            return jsonify({"error": "Email already exists"}), 409
        raise

    return jsonify(user_row_to_dict(row)), 201