"""
Debug test - PSA button click with console capture
"""

import time
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from webdriver_manager.firefox import GeckoDriverManager
from _hta_url import hta_oman_index_url, hta_oman_index_path

def run_debug():
    print("Setting up Firefox...")
    service = Service(GeckoDriverManager().install())
    driver = webdriver.Firefox(service=service)
    driver.set_window_size(1920, 1080)

    # Load and setup
    driver.get(hta_oman_index_url())
    time.sleep(3)

    for i in range(10):
        if driver.execute_script("return !!(window.app && window.app.loadDemoModel);"):
            break
        time.sleep(1)

    driver.execute_script("window.app.loadDemoModel();")
    time.sleep(2)

    # Override iterations to 100 for quick test
    print("Setting PSA iterations to 100...")
    driver.execute_script("""
        var input = document.getElementById('psa-iterations');
        if (input) input.value = '100';
    """)

    # Navigate to charts section
    driver.execute_script("window.showSection('charts');")
    time.sleep(1)

    # Setup error capture
    driver.execute_script("""
        window._psaErrors = [];
        window._psaProgress = [];
        var origWarn = console.warn;
        var origError = console.error;
        console.warn = function(...args) {
            window._psaErrors.push({ type: 'warn', msg: args.join(' ') });
            origWarn.apply(console, args);
        };
        console.error = function(...args) {
            window._psaErrors.push({ type: 'error', msg: args.join(' ') });
            origError.apply(console, args);
        };
    """)

    # Click PSA button
    print("\nClicking PSA button (100 iterations)...")
    driver.execute_script("""
        document.getElementById('btn-run-psa').click();
    """)

    # Wait and monitor
    for i in range(30):
        state = driver.execute_script("""
            return {
                psaResults: window.app?.psaResults ? {
                    meanIcer: window.app.psaResults.summary?.mean_icer
                } : null,
                progressText: document.getElementById('psa-progress-text')?.textContent,
                errors: window._psaErrors?.slice(-3)
            };
        """)
        print(f"  {i+1}s: progress={state.get('progressText')}, meanIcer={state.get('psaResults')}, errors={state.get('errors')}")

        if state.get('psaResults') and state['psaResults'].get('meanIcer') is not None:
            print("SUCCESS - PSA completed!")
            break
        time.sleep(1)

    # Final check
    final = driver.execute_script("""
        return {
            meanIcer: document.getElementById('psa-mean-icer')?.textContent,
            probCe: document.getElementById('psa-prob-ce')?.textContent,
            hasCePlane: !!window.app?.charts?.cePlane,
            hasCeac: !!window.app?.charts?.ceac
        };
    """)
    print(f"\nFinal display: {final}")

    driver.quit()
    print("\nDone.")

if __name__ == "__main__":
    run_debug()
