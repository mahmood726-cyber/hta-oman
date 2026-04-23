"""Resolve the HTA-oman app's index.html for selenium tests and ad-hoc scripts.

Many root-level Python scripts used to hardcode an absolute file:// URL
for the test page, which tripped Sentinel's hardcoded-path rule and broke
any clone that lived elsewhere on disk.

Resolution order:
  1. ``HTA_OMAN_INDEX_PATH`` env var (any user-chosen location)
  2. Repo-root ``index.html`` (canonical location, ships with this repo)
  3. The legacy ``Downloads/HTA-oman`` location under the user's home dir

Fails closed if none of the candidates exist.
"""

from __future__ import annotations

import os
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent


def hta_oman_index_path() -> Path:
    """Return an absolute Path to the HTA-oman app's index.html."""
    candidates: list[Path] = []
    env = os.environ.get("HTA_OMAN_INDEX_PATH", "")
    if env:
        candidates.append(Path(env).expanduser())
    candidates.append(_REPO_ROOT / "index.html")
    candidates.append(Path.home() / "Downloads" / "HTA-oman" / "index.html")

    for c in candidates:
        if c.is_file():
            return c.resolve()

    searched = ", ".join(str(c) for c in candidates)
    raise FileNotFoundError(
        f"HTA-oman index.html not found. Set HTA_OMAN_INDEX_PATH env var, or "
        f"place the file at the repo root, or restore ~/Downloads/HTA-oman/. "
        f"Searched: {searched}"
    )


def hta_oman_index_url() -> str:
    """Return a ``file://`` URI suitable for ``driver.get(...)``."""
    return hta_oman_index_path().as_uri()
