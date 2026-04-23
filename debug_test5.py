"""
Debug test - wait for DOM ready properly
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

    # Load page
    print("Loading page...")
    driver.get(hta_oman_index_url())

    # Wait for document.readyState to be complete
    print("Waiting for document ready...")
    for i in range(30):
        state = driver.execute_script("return document.readyState;")
        if state == 'complete':
            print(f"  Document ready after {i+1} iterations")
            break
        time.sleep(0.5)

    # Extra wait for any delayed scripts
    time.sleep(3)

    # Check window.app
    app_check = driver.execute_script("""
        return {
            hasApp: typeof window.app !== 'undefined' && window.app !== null,
            hasHTAApp: typeof HTAApp !== 'undefined',
            documentReady: document.readyState
        };
    """)
    print(f"After document ready: {app_check}")

    # If app exists, try to load demo and run DSA
    if app_check.get('hasApp'):
        print("\\nApp found! Testing DSA...")

        # Load demo
        driver.execute_script("window.app.loadDemoModel();")
        time.sleep(3)

        # Check project
        project_check = driver.execute_script("""
            return {
                hasProject: !!(window.app && window.app.project),
                paramCount: window.app && window.app.project ?
                    Object.keys(window.app.project.parameters || {}).length : 0
            };
        """)
        print(f"Project: {project_check}")

        # Try DSA
        dsa_result = driver.execute_script("""
            try {
                if (!window.app.dsaEngine) return { error: 'No DSA engine' };
                if (!window.app.project) return { error: 'No project' };

                var result = window.app.dsaEngine.run(window.app.project, 'icer', 20000);
                return {
                    success: true,
                    baseline: result.baseline,
                    paramCount: (result.parameters || []).length,
                    hasSwing: result.parameters && result.parameters[0] && typeof result.parameters[0].swing === 'number'
                };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        """)
        print(f"DSA result: {dsa_result}")

        # Try running actual runDSA
        print("\\nTrying window.app.runDSA()...")
        run_result = driver.execute_script("""
            try {
                // Check if runDSA exists
                if (typeof window.app.runDSA !== 'function') {
                    return { error: 'runDSA is not a function' };
                }

                // Call it (it's async)
                window.app.runDSA();
                return { started: true };
            } catch (e) {
                return { error: e.message };
            }
        """)
        print(f"runDSA call: {run_result}")

        # Wait for DSA to complete
        time.sleep(5)

        # Check DSA results
        final_result = driver.execute_script("""
            return {
                hasDsaResults: !!(window.app && window.app.dsaResults),
                tornadoVisible: document.getElementById('tornado-container')?.style.display !== 'none',
                dsaResultsParams: window.app && window.app.dsaResults ?
                    (window.app.dsaResults.parameters || []).length : 0
            };
        """)
        print(f"Final DSA state: {final_result}")

    else:
        print("\\nNo app found. Checking what's happening...")

        # Try to manually create the app
        manual_result = driver.execute_script("""
            try {
                if (typeof HTAApp === 'undefined') {
                    return { error: 'HTAApp class not defined' };
                }
                window.app = new HTAApp();
                return { success: true, hasApp: !!window.app };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        """)
        print(f"Manual app creation: {manual_result}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
