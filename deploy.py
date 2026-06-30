"""Cross-platform deploy: build frontend and copy to idle blue/green folder."""
import subprocess, shutil, sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
LIVE_FILE = PROJECT_ROOT / "current_live.txt"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

def get_live() -> str:
    if LIVE_FILE.exists():
        live = LIVE_FILE.read_text().strip()
        if live in ("blue", "green"):
            return live
    return "blue"

def main():
    live = get_live()
    target = "green" if live == "blue" else "blue"
    print(f"Live: {live} → Building to {target}")

    # Build
    proc = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(FRONTEND_DIR),
        capture_output=True, text=True,
        shell=True
    )
    if proc.returncode != 0:
        print("Build failed:", proc.stderr[-2000:], file=sys.stderr)
        sys.exit(1)

    # Copy
    build_dir = FRONTEND_DIR / "build"
    target_dir = PROJECT_ROOT / target
    if target_dir.exists():
        shutil.rmtree(target_dir)
    shutil.copytree(build_dir, target_dir)
    print(f"Deployed to {target}/")

if __name__ == "__main__":
    main()
