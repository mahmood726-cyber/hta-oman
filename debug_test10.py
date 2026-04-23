"""
Debug test - check console logs from app.js
"""

import time
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from webdriver_manager.firefox import GeckoDriverManager
from _hta_url import hta_oman_index_url, hta_oman_index_path

def run_debug():
    print("Setting up Firefox...")

    # Enable logging
    options = Options()
    options.set_preference("devtools.console.stdout.content", True)

    service = Service(GeckoDriverManager().install())
    driver = webdriver.Firefox(service=service, options=options)
    driver.set_window_size(1920, 1080)

    # Load full index.html
    print("Loading full index.html...")
    driver.get(hta_oman_index_url())
    time.sleep(5)

    # Check our debug markers
    check = driver.execute_script("""
        return {
            // Helper functions (defined before class)
            normalizeSettingsExists: typeof normalizeSettings === 'function',
            formatCurrencyValueExists: typeof formatCurrencyValue === 'function',

            // Our debug markers
            beforeHTAApp: window.__beforeHTAApp,
            afterHTAApp: window.__afterHTAApp,
            htaAppTypeMarker: window.__HTAAppType,

            // Actual HTAApp status
            HTAAppNow: typeof HTAApp,
            windowApp: typeof window.app
        };
    """)
    print(f"\\nDebug markers: {check}")

    # Check HTAApp status
    status = driver.execute_script("""
        return {
            HTAApp: typeof HTAApp,
            windowApp: typeof window.app,
            consoleLogs: window.__consoleLogs ? window.__consoleLogs.length : 0
        };
    """)
    print(f"\\nFinal status: {status}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
