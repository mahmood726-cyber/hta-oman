import shutil
import tempfile
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.chrome.options import Options as ChromeOptions


@pytest.fixture(scope="session")
def file_path():
    return str(Path(__file__).resolve().parent / "index.html")


@pytest.fixture(scope="session")
def driver():
    temp_dir = tempfile.mkdtemp(prefix="hta_pytest_")
    try:
        edge_options = EdgeOptions()
        edge_options.add_argument("--headless=new")
        edge_options.add_argument("--disable-gpu")
        edge_options.add_argument("--no-sandbox")
        edge_options.add_argument("--disable-dev-shm-usage")
        edge_options.add_argument(f"--user-data-dir={temp_dir}")
        edge_options.add_argument("--window-size=1920,1080")
        try:
            drv = webdriver.Edge(options=edge_options)
        except Exception:
            chrome_options = ChromeOptions()
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument(f"--user-data-dir={temp_dir}")
            chrome_options.add_argument("--window-size=1920,1080")
            try:
                drv = webdriver.Chrome(options=chrome_options)
            except Exception as exc:
                pytest.skip(f"Selenium driver not available: {exc}")

        yield drv
    finally:
        try:
            drv.quit()
        except Exception:
            pass
        shutil.rmtree(temp_dir, ignore_errors=True)
