# WSGI file with automatic dependency installer
import subprocess, sys, os

# Run pip install if needed
try:
    import openpyxl
except ImportError:
    req = os.path.expanduser("~/Supplykit/backend/requirements.txt")
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", req, "--quiet"], timeout=120)

from app.main import app as application  # noqa
