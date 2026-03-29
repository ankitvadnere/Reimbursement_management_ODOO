import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)

    # ── Config ────────────────────────────────────────────────────
    app.config["SECRET_KEY"]      = os.getenv("JWT_SECRET", "dev-secret-change-me")
    app.config["UPLOAD_FOLDER"]   = os.path.join(os.path.dirname(__file__), "uploads")
    app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024   # 10 MB upload limit

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # ── CORS (allow React dev server) ─────────────────────────────
    CORS(app, resources={r"/api/*": {"origins": [
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",
    ]}}, supports_credentials=True)

    # ── Blueprints ────────────────────────────────────────────────
    from routes.auth     import auth_bp
    from routes.expenses import expenses_bp
    from routes.users    import users_bp
    from routes.ocr      import ocr_bp

    app.register_blueprint(auth_bp,     url_prefix="/api/auth")
    app.register_blueprint(expenses_bp, url_prefix="/api/expenses")
    app.register_blueprint(users_bp,    url_prefix="/api/users")
    app.register_blueprint(ocr_bp,      url_prefix="/api/ocr")

    # ── Serve uploaded receipts ───────────────────────────────────
    from flask import send_from_directory

    @app.route("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    # ── Health check ──────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    return app


if __name__ == "__main__":
    # Run seed on startup
    from db.seed import run as seed
    seed()

    app = create_app()
    app.run(debug=True, port=5000)