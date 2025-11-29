import os

def get_version():
    try:
        # Assuming VERSION is in the root directory, one level up from backend
        root_dir = os.getenv("PROJECT_ROOT", os.path.dirname(os.path.dirname(__file__)))
        version_file = os.path.join(root_dir, 'VERSION')
        with open(version_file, 'r') as f:
            return f.read().strip()
    except Exception:
        return "0.0.0"

VERSION = get_version()
APP_VERSION = VERSION
