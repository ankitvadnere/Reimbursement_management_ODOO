import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Blueprint, request, jsonify, g
from db.connection import db

auth_bp = Blueprint("auth", __name__)

SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
TOKEN_EXPIRY_HOURS = 24


def make_token(user):
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


def login_required(f):
    """Decorator — validates JWT and sets g.user for the route."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        g.user = {
            "id":    payload["sub"],
            "email": payload["email"],
            "role":  payload["role"],
        }
        return f(*args, **kwargs)
    return wrapper


def role_required(*roles):
    """Decorator — must be used after @login_required."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if g.user["role"] not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


# ── Routes ────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email    = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    with db() as cur:
        cur.execute("""
            SELECT id, name, email, password, role, country, manager_id
            FROM users WHERE email = %s
        """, (email,))
        row = cur.fetchone()

    if not row:
        return jsonify({"error": "Invalid email or password"}), 401

    user = {
        "id": str(row[0]), "name": row[1], "email": row[2],
        "password": row[3], "role": row[4],
        "country": row[5], "manager_id": str(row[6]) if row[6] else None,
    }

    if not bcrypt.checkpw(password.encode(), user["password"].encode()):
        return jsonify({"error": "Invalid email or password"}), 401

    token = make_token(user)
    user.pop("password")

    return jsonify({"token": token, "user": user}), 200


@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    """Returns the current user's full profile."""
    with db() as cur:
        cur.execute("""
            SELECT id, name, email, role, country, manager_id
            FROM users WHERE id = %s
        """, (g.user["id"],))
        row = cur.fetchone()

    if not row:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "id": str(row[0]), "name": row[1], "email": row[2],
        "role": row[3], "country": row[4],
        "manager_id": str(row[5]) if row[5] else None,
    }), 200


@auth_bp.route("/signup", methods=["POST"])
def signup():
    data     = request.get_json()
    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    country  = (data.get("country") or "IN").strip().upper()

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password required"}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        with db() as cur:
            # Assign to the first available manager
            cur.execute("""
                SELECT id FROM users WHERE role = 'manager' ORDER BY created_at LIMIT 1
            """)
            mgr = cur.fetchone()
            manager_id = str(mgr[0]) if mgr else None

            cur.execute("""
                INSERT INTO users (name, email, password, role, country, manager_id)
                VALUES (%s, %s, %s, 'employee', %s, %s)
                RETURNING id, name, email, role, country, manager_id
            """, (name, email, hashed, country, manager_id))
            row = cur.fetchone()
    except Exception as e:
        if "unique" in str(e).lower():
            return jsonify({"error": "Email already exists"}), 409
        raise

    user = {
        "id": str(row[0]), "name": row[1], "email": row[2],
        "role": row[3], "country": row[4],
        "manager_id": str(row[5]) if row[5] else None,
    }
    token = make_token(user)
    return jsonify({"token": token, "user": user}), 201