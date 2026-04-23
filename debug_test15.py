"""
Debug test - check Microsim result display
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

    # Navigate to microsim
    driver.execute_script("window.showSection('microsim');")
    time.sleep(1)

    # Run microsim directly and capture results
    result = driver.execute_script("""
        return new Promise(async (resolve) => {
            try {
                if (!window.app || !window.app.advancedUI || !window.app.advancedUI.microsimEngine) {
                    resolve({ error: 'Missing components' });
                    return;
                }

                var engine = window.app.advancedUI.microsimEngine;
                var project = window.app.project;

                // Set small number of patients for quick test
                engine.options.patients = 100;
                engine.options.seed = 12345;

                // Run microsim
                var result = await engine.run(project, {});

                resolve({
                    hasSummary: !!result.summary,
                    summaryKeys: result.summary ? Object.keys(result.summary) : [],
                    meanCosts: result.summary?.mean_costs,
                    meanQalys: result.summary?.mean_qalys,
                    patientCount: (result.patients || []).length
                });
            } catch(e) {
                resolve({ error: e.message, stack: e.stack });
            }
        });
    """)
    print(f"Direct microsim result: {result}")

    # Now try running through advancedUI
    print("\\nRunning through advancedUI.runMicrosimulation()...")
    run_result = driver.execute_script("""
        return new Promise(async (resolve) => {
            try {
                await window.app.advancedUI.runMicrosimulation();
                resolve({ success: true });
            } catch(e) {
                resolve({ error: e.message, stack: e.stack });
            }
        });
    """)
    print(f"advancedUI.runMicrosimulation: {run_result}")

    # Check display elements
    display = driver.execute_script("""
        return {
            meanCost: document.getElementById('microsim-mean-cost')?.textContent,
            meanQaly: document.getElementById('microsim-mean-qaly')?.textContent,
            meanLy: document.getElementById('microsim-mean-ly')?.textContent,
            resultsVisible: document.getElementById('microsim-results')?.style.display
        };
    """)
    print(f"Display elements: {display}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
