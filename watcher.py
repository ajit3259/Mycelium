"""
Run separately to auto-capture screenshots dropped on the watched folder.
Usage: python watcher.py
"""
import sys
import time
import httpx
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from config import SCREENSHOTS_DIR

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
API = "http://localhost:8000"


class ScreenshotHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() not in IMAGE_EXTS:
            return
        print(f"[watcher] new image: {path.name}")
        try:
            with open(path, "rb") as f:
                httpx.post(
                    f"{API}/capture/image",
                    files={"file": (path.name, f, f"image/{path.suffix[1:]}")},
                    timeout=10,
                )
            print(f"[watcher] sent {path.name}")
        except Exception as e:
            print(f"[watcher] error: {e}")


if __name__ == "__main__":
    watch_dir = sys.argv[1] if len(sys.argv) > 1 else SCREENSHOTS_DIR
    print(f"[watcher] watching {watch_dir}")
    observer = Observer()
    observer.schedule(ScreenshotHandler(), watch_dir, recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
