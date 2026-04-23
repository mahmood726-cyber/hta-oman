"""
Debug test - check Microsimulation flow
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

    # Load full index.html
    print("Loading full index.html...")
    driver.get(hta_oman_index_url())
    time.sleep(3)

    # Wait for app
    for i in range(10):
        ready = driver.execute_script("return !!(window.app && window.app.loadDemoModel);")
        if ready:
            break
        time.sleep(1)

    # Load demo
    print("Loading demo...")
    driver.execute_script("window.app.loadDemoModel();")
    time.sleep(2)

    # Navigate to microsim section
    print("\\nNavigating to Microsim section...")
    driver.execute_script("window.showSection('microsim');")
    time.sleep(1)

    # Check microsim button and handler
    check = driver.execute_script("""
        return {
            hasMicrosimBtn: !!document.getElementById('btn-run-microsim'),
            hasAdvancedUI: !!(window.app && window.app.advancedUI),
            hasMicrosimEngine: typeof MicrosimulationEngine !== 'undefined',
            advancedUIMicrosimEngine: !!(window.app && window.app.advancedUI && window.app.advancedUI.microsimEngine)
        };
    """)
    print(f"Microsim setup: {check}")

    # Click microsim button
    print("\\nClicking Microsim button...")
    driver.execute_script("""
        var btn = document.getElementById('btn-run-microsim');
        if (btn) btn.click();
    """)

    # Wait for results
    print("Waiting for Microsim to complete...")
    for i in range(20):
        state = driver.execute_script("""
            return {
                progressVisible: document.getElementById('microsim-progress')?.style.display !== 'none',
                resultsVisible: document.getElementById('microsim-results')?.style.display !== 'none',
                meanCost: document.getElementById('microsim-mean-cost')?.textContent,
                meanQaly: document.getElementById('microsim-mean-qaly')?.textContent
            };
        """)
        print(f"  {i+1}s: {state}")
        if state.get('meanCost') and state.get('meanCost') not in ['-', '']:
            break
        time.sleep(1)

    # Check final state
    final = driver.execute_script("""
        return {
            meanCost: document.getElementById('microsim-mean-cost')?.textContent,
            meanQaly: document.getElementById('microsim-mean-qaly')?.textContent,
            meanLy: document.getElementById('microsim-mean-ly')?.textContent,
            resultsContainer: document.getElementById('microsim-results')?.style.display
        };
    """)
    print(f"\\nFinal state: {final}")

    # Try to run microsim directly
    print("\\nTrying to run Microsim directly via advancedUI...")
    direct_result = driver.execute_script("""
        try {
            if (!window.app || !window.app.advancedUI) {
                return { error: 'No advancedUI' };
            }
            if (!window.app.advancedUI.microsimEngine) {
                return { error: 'No microsimEngine on advancedUI' };
            }

            // Run microsim directly
            return new Promise((resolve) => {
                window.app.advancedUI.runMicrosimulation()
                    .then(() => resolve({ success: true }))
                    .catch(e => resolve({ error: e.message }));
            });
        } catch(e) {
            return { error: e.message };
        }
    """)
    print(f"Direct run: {direct_result}")

    # Wait a bit more
    time.sleep(5)

    # Check again
    final2 = driver.execute_script("""
        return {
            meanCost: document.getElementById('microsim-mean-cost')?.textContent,
            meanQaly: document.getElementById('microsim-mean-qaly')?.textContent
        };
    """)
    print(f"Final state after direct run: {final2}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
