"""
Final Comprehensive Test - Verify ALL Features
"""

import time
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from webdriver_manager.firefox import GeckoDriverManager
from _hta_url import hta_oman_index_url, hta_oman_index_path

def run_test():
    print("=" * 60)
    print("HTA-OMAN COMPREHENSIVE FEATURE TEST")
    print("=" * 60)

    service = Service(GeckoDriverManager().install())
    driver = webdriver.Firefox(service=service)
    driver.set_window_size(1920, 1080)

    # Load app
    driver.get(hta_oman_index_url())
    time.sleep(3)

    for i in range(10):
        if driver.execute_script("return !!(window.app && window.app.loadDemoModel);"):
            break
        time.sleep(1)

    driver.execute_script("window.app.loadDemoModel();")
    time.sleep(2)

    results = {}

    # 1. BASE CASE
    print("\n[1/4] Testing BASE CASE...")
    driver.execute_script("window.app.runBaseCase();")
    time.sleep(2)

    bc = driver.execute_script("""
        return {
            hasResults: !!window.app.results,
            strategies: Object.keys(window.app.results?.strategies || {}).length,
            hasTornado: !!document.getElementById('tornado-chart')
        };
    """)
    results['base_case'] = bc['hasResults']
    print(f"   Results: hasResults={bc['hasResults']}, strategies={bc['strategies']}")

    # 2. DSA
    print("\n[2/4] Testing DSA (Tornado)...")
    driver.execute_script("window.showSection('charts');")
    time.sleep(0.5)
    driver.execute_script("document.getElementById('btn-run-dsa').click();")

    for i in range(15):
        state = driver.execute_script("""
            return {
                hasResults: !!window.app.dsaResults,
                paramCount: (window.app.dsaResults?.parameters || []).length,
                hasChart: !!window.app.charts?.tornado
            };
        """)
        if state['hasResults'] and state['hasChart']:
            break
        time.sleep(1)

    results['dsa'] = state['hasResults'] and state['hasChart']
    print(f"   Results: hasResults={state['hasResults']}, paramCount={state.get('paramCount', 0)}, hasChart={state['hasChart']}")

    # 3. PSA
    print("\n[3/4] Testing PSA (CE Plane + CEAC)...")
    driver.execute_script("""
        document.getElementById('psa-iterations').value = '100';
        document.getElementById('btn-run-psa').click();
    """)

    for i in range(20):
        state = driver.execute_script("""
            return {
                hasResults: !!window.app.psaResults,
                meanIcer: window.app.psaResults?.summary?.mean_icer,
                hasCePlane: !!window.app.charts?.cePlane,
                hasCeac: !!window.app.charts?.ceac
            };
        """)
        if state['hasResults'] and state['meanIcer'] is not None:
            break
        time.sleep(1)

    results['psa'] = state['hasResults'] and state.get('meanIcer') is not None
    icer_val = state.get('meanIcer')
    icer_str = f"{icer_val:.2f}" if icer_val else 'N/A'
    print(f"   Results: hasResults={state['hasResults']}, meanIcer={icer_str}")
    print(f"   Charts: CE Plane={state['hasCePlane']}, CEAC={state['hasCeac']}")

    # 4. MICROSIMULATION
    print("\n[4/4] Testing MICROSIMULATION...")
    driver.execute_script("""
        window.showSection('microsim');
        setTimeout(() => {
            document.getElementById('btn-run-microsim').click();
        }, 500);
    """)
    time.sleep(1)

    for i in range(20):
        state = driver.execute_script("""
            return {
                meanCost: document.getElementById('microsim-mean-cost')?.textContent,
                meanQaly: document.getElementById('microsim-mean-qaly')?.textContent,
                resultsVisible: document.getElementById('microsim-results')?.style.display
            };
        """)
        if state['meanCost'] and state['meanCost'] not in ['-', '']:
            break
        time.sleep(1)

    results['microsim'] = state.get('meanCost', '') not in ['-', '', None]
    print(f"   Results: meanCost={state.get('meanCost')}, meanQaly={state.get('meanQaly')}")

    # SUMMARY
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    all_pass = True
    for test, passed in results.items():
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_pass = False
        print(f"  {test.upper():20} [{status}]")

    print("=" * 60)
    if all_pass:
        print("ALL TESTS PASSED!")
    else:
        print("SOME TESTS FAILED")
    print("=" * 60)

    driver.quit()
    return all_pass

if __name__ == "__main__":
    run_test()
