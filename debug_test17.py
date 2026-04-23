"""
Debug test - PSA specific
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

    # Run base case
    print("Running base case...")
    driver.execute_script("window.app.runBaseCase();")
    time.sleep(2)

    # Check PSA prereqs
    print("\n=== Checking PSA Prerequisites ===")
    prereqs = driver.execute_script("""
        return {
            hasProject: !!window.app.project,
            hasPSAEngine: typeof PSAEngine !== 'undefined',
            psaButton: !!document.getElementById('btn-run-psa'),
            psaIterationsInput: document.getElementById('psa-iterations')?.value
        };
    """)
    print(f"Prerequisites: {prereqs}")

    # Try running PSA directly
    print("\n=== Running PSA directly ===")
    psa_result = driver.execute_script("""
        return new Promise(async (resolve) => {
            try {
                if (typeof PSAEngine === 'undefined') {
                    resolve({ error: 'PSAEngine not defined' });
                    return;
                }

                const engine = new PSAEngine({ iterations: 100, seed: 12345 });

                // Get project
                const project = window.app.project;
                if (!project) {
                    resolve({ error: 'No project' });
                    return;
                }

                // Simple run - no overrides
                const result = await engine.run(project, {}, {});

                resolve({
                    success: true,
                    hasIterations: !!(result.iterations && result.iterations.length),
                    iterationCount: (result.iterations || []).length,
                    hasSummary: !!result.summary,
                    summaryKeys: result.summary ? Object.keys(result.summary) : [],
                    meanIcer: result.summary?.mean_icer,
                    probCe30k: result.summary?.prob_ce?.[30000]
                });
            } catch(e) {
                resolve({ error: e.message, stack: e.stack });
            }
        });
    """)
    print(f"Direct PSA result: {psa_result}")

    # Try clicking the button and see console errors
    print("\n=== Clicking PSA button ===")
    driver.execute_script("""
        document.getElementById('btn-run-psa').click();
    """)
    time.sleep(5)

    # Check what happened
    state = driver.execute_script("""
        return {
            psaResults: window.app?.psaResults ? {
                iterations: (window.app.psaResults.iterations || []).length,
                meanIcer: window.app.psaResults.summary?.mean_icer
            } : null,
            psaProgressVisible: document.getElementById('psa-progress')?.style.display,
            meanIcerDisplay: document.getElementById('psa-mean-icer')?.textContent
        };
    """)
    print(f"After button click: {state}")

    driver.quit()
    print("\nDone.")

if __name__ == "__main__":
    run_debug()
