"""
Comprehensive debug test - verify DSA, PSA, and Microsim all work
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

    # Run base case first
    print("\n=== Running Base Case ===")
    driver.execute_script("window.app.runBaseCase();")
    time.sleep(2)

    base_result = driver.execute_script("""
        return {
            hasResults: !!window.app.results,
            strategies: Object.keys(window.app.results?.strategies || {}),
            icer: window.app.results?.strategies?.Treatment?.icer
        };
    """)
    print(f"Base case results: {base_result}")

    # Test DSA
    print("\n=== Testing DSA ===")
    driver.execute_script("window.showSection('charts');")
    time.sleep(1)

    # Click DSA button
    driver.execute_script("""
        var btn = document.getElementById('btn-run-dsa');
        if (btn) btn.click();
    """)

    # Wait for DSA
    for i in range(15):
        state = driver.execute_script("""
            return {
                dsaResults: window.app?.dsaResults ? {
                    baseline: window.app.dsaResults.baseline,
                    paramCount: (window.app.dsaResults.parameters || []).length
                } : null,
                chartExists: !!window.app?.charts?.tornado
            };
        """)
        print(f"  DSA {i+1}s: {state}")
        if state.get('dsaResults') and state.get('chartExists'):
            break
        time.sleep(1)

    # Test PSA
    print("\n=== Testing PSA ===")
    driver.execute_script("""
        var btn = document.getElementById('btn-run-psa');
        if (btn) btn.click();
    """)

    # Wait for PSA
    for i in range(20):
        state = driver.execute_script("""
            return {
                psaResults: window.app?.psaResults ? {
                    iterations: (window.app.psaResults.iterations || []).length,
                    meanIcer: window.app.psaResults.summary?.meanIcer
                } : null,
                statsShowing: {
                    meanIcer: document.getElementById('psa-mean-icer')?.textContent,
                    probCe: document.getElementById('psa-prob-ce')?.textContent
                }
            };
        """)
        print(f"  PSA {i+1}s: {state}")
        if state.get('psaResults') and state.get('psaResults', {}).get('iterations', 0) > 0:
            break
        time.sleep(1)

    # Test Microsim
    print("\n=== Testing Microsim ===")
    driver.execute_script("window.showSection('microsim');")
    time.sleep(1)

    driver.execute_script("""
        var btn = document.getElementById('btn-run-microsim');
        if (btn) btn.click();
    """)

    # Wait for Microsim
    for i in range(20):
        state = driver.execute_script("""
            return {
                meanCost: document.getElementById('microsim-mean-cost')?.textContent,
                meanQaly: document.getElementById('microsim-mean-qaly')?.textContent,
                resultsVisible: document.getElementById('microsim-results')?.style.display
            };
        """)
        print(f"  Microsim {i+1}s: {state}")
        if state.get('meanCost') and state.get('meanCost') not in ['-', '']:
            break
        time.sleep(1)

    # Final summary
    print("\n=== Final Summary ===")
    summary = driver.execute_script("""
        return {
            baseCase: !!window.app.results,
            dsa: {
                hasResults: !!window.app.dsaResults,
                paramCount: (window.app.dsaResults?.parameters || []).length,
                hasChart: !!window.app.charts?.tornado
            },
            psa: {
                hasResults: !!window.app.psaResults,
                iterations: (window.app.psaResults?.iterations || []).length,
                hasCePlane: !!window.app.charts?.cePlane,
                hasCeac: !!window.app.charts?.ceac
            },
            microsim: {
                meanCost: document.getElementById('microsim-mean-cost')?.textContent,
                meanQaly: document.getElementById('microsim-mean-qaly')?.textContent
            }
        };
    """)
    print(f"Summary: {summary}")

    driver.quit()
    print("\nDone.")

if __name__ == "__main__":
    run_debug()
