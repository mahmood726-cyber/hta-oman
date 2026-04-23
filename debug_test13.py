"""
Debug test - check DSA button click flow
"""

import time
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
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
    print("Waiting for app...")
    for i in range(20):
        ready = driver.execute_script("return !!(window.app && window.app.loadDemoModel);")
        if ready:
            print(f"  App ready after {i+1}s")
            break
        time.sleep(1)

    # Load demo
    print("Loading demo...")
    driver.execute_script("window.app.loadDemoModel();")
    time.sleep(2)

    # Run base case first
    print("Running base case...")
    driver.execute_script("window.app.runBaseCase();")
    time.sleep(2)

    # Navigate to DSA section
    print("Navigating to DSA section...")
    driver.execute_script("window.showSection('charts');")
    time.sleep(1)

    # Check DSA button exists
    dsa_btn = driver.execute_script("""
        var btn = document.getElementById('btn-run-dsa');
        return btn ? { exists: true, visible: btn.offsetParent !== null } : { exists: false };
    """)
    print(f"DSA button: {dsa_btn}")

    # Click DSA button
    print("Clicking DSA button...")
    driver.execute_script("""
        var btn = document.getElementById('btn-run-dsa');
        if (btn) btn.click();
    """)

    # Wait and check progress
    print("Waiting for DSA to complete...")
    for i in range(15):
        state = driver.execute_script("""
            return {
                progressVisible: document.getElementById('dsa-progress')?.style.display !== 'none',
                tornadoVisible: document.getElementById('tornado-container')?.style.display !== 'none',
                dsaResults: window.app?.dsaResults ? {
                    paramCount: (window.app.dsaResults.parameters || []).length,
                    baseline: window.app.dsaResults.baseline
                } : null
            };
        """)
        print(f"  {i+1}s: {state}")
        if state.get('dsaResults') and state.get('tornadoVisible'):
            break
        time.sleep(1)

    # Check final state
    final = driver.execute_script("""
        return {
            dsaResults: window.app?.dsaResults ? {
                baseline: window.app.dsaResults.baseline,
                paramCount: (window.app.dsaResults.parameters || []).length
            } : null,
            tornadoContainer: {
                display: document.getElementById('tornado-container')?.style.display,
                hasChart: !!document.getElementById('tornado-chart')
            },
            chartInstance: !!window.app?.charts?.tornado
        };
    """)
    print(f"Final state: {final}")

    # If DSA results exist but chart didn't render, try calling displayDSAResults
    if final.get('dsaResults') and not final.get('chartInstance'):
        print("\\nTrying to manually display DSA results...")
        display_result = driver.execute_script("""
            try {
                if (window.app && window.app.dsaResults && window.app.displayDSAResults) {
                    window.app.displayDSAResults(15);
                    return { displayed: true, chartNow: !!window.app.charts?.tornado };
                }
                return { error: 'Missing app, dsaResults, or displayDSAResults' };
            } catch(e) {
                return { error: e.message };
            }
        """)
        print(f"Manual display: {display_result}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
