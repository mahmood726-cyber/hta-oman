"""
Debug test to check DSA and Microsimulation errors
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

    # Load page
    driver.get(hta_oman_index_url())
    time.sleep(3)

    # Wait for app to be ready
    print("Waiting for app to initialize...")
    for i in range(30):
        ready = driver.execute_script("return !!(window.app && typeof window.app.loadDemoModel === 'function');")
        if ready:
            print(f"  App ready after {i+1}s")
            break
        time.sleep(1)
    else:
        print("  Warning: App not ready after 30s")

    # Load demo
    print("Loading demo data...")
    driver.execute_script("if (window.app && window.app.loadDemoModel) window.app.loadDemoModel();")
    time.sleep(3)

    # Wait for project to be loaded
    print("Waiting for project to load...")
    for i in range(10):
        has_project = driver.execute_script("return !!(window.app && window.app.project);")
        if has_project:
            print(f"  Project loaded after {i+1}s")
            break
        time.sleep(1)
    else:
        print("  Warning: Project not loaded after 10s")

    # Run base model
    print("Running base model...")
    driver.execute_script("if (window.app && window.app.runBaseCase) window.app.runBaseCase();")
    time.sleep(3)

    print("\n--- DEBUG: DSA ---")

    # Navigate to charts section
    driver.execute_script("""
        var nav = document.querySelector('[data-section="charts"]');
        if (nav) nav.click();
    """)
    time.sleep(0.5)

    # Check DSA engine availability
    dsa_check = driver.execute_script("""
        return {
            hasApp: !!window.app,
            hasDsaEngine: !!(window.app && window.app.dsaEngine),
            hasProject: !!(window.app && window.app.project),
            projectParams: window.app && window.app.project ? Object.keys(window.app.project.parameters || {}).length : 0
        };
    """)
    print(f"DSA Check: {dsa_check}")

    # Try to run DSA manually and capture errors
    dsa_result = driver.execute_script("""
        try {
            if (!window.app || !window.app.dsaEngine || !window.app.project) {
                return { error: 'Missing app, dsaEngine, or project' };
            }

            // Run DSA with explicit parameters
            var project = window.app.project;
            var engine = window.app.dsaEngine;

            // Check if run method exists
            if (typeof engine.run !== 'function') {
                return { error: 'DSA engine has no run method' };
            }

            // Try to run
            var result = engine.run(project, 'icer', 20000);

            // Check result
            if (result && result.parameters) {
                return {
                    success: true,
                    baseline: result.baseline,
                    metric: result.metric,
                    paramCount: result.parameters.length,
                    firstParam: result.parameters[0] || null
                };
            } else {
                return { error: 'DSA returned empty result', result: result };
            }
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    """)
    print(f"DSA Result: {dsa_result}")

    print("\n--- DEBUG: Microsimulation ---")

    # Navigate to microsim section
    driver.execute_script("""
        var nav = document.querySelector('[data-section="microsim"]');
        if (nav) nav.click();
    """)
    time.sleep(0.5)

    # Check microsim engine availability
    microsim_check = driver.execute_script("""
        return {
            hasMicrosimEngine: typeof MicrosimulationEngine !== 'undefined',
            hasAdvancedUI: !!(window.app && window.app.advancedUI),
            advancedUIHasEngine: !!(window.app && window.app.advancedUI && window.app.advancedUI.microsimEngine)
        };
    """)
    print(f"Microsim Check: {microsim_check}")

    # Try to run microsimulation manually
    microsim_result = driver.execute_script("""
        try {
            if (typeof MicrosimulationEngine === 'undefined') {
                return { error: 'MicrosimulationEngine not defined' };
            }

            if (!window.app || !window.app.project) {
                return { error: 'No app or project' };
            }

            var engine = new MicrosimulationEngine({
                patients: 100,  // Small number for quick test
                seed: 12345
            });

            var project = window.app.project;

            // Check project structure
            var states = Object.keys(project.states || {});
            var transitions = Object.keys(project.transitions || {});
            var params = Object.keys(project.parameters || {});

            if (states.length === 0) {
                return { error: 'No states in project', states: states };
            }

            if (transitions.length === 0) {
                return { error: 'No transitions in project', transitions: transitions };
            }

            // Try synchronous run (first few patients)
            var result = engine.run(project, {});

            // Check if it returns a promise
            if (result && typeof result.then === 'function') {
                return { isPromise: true, message: 'Returns a promise, cannot check synchronously' };
            }

            return {
                success: true,
                states: states,
                transitions: transitions.slice(0, 5),
                params: params.slice(0, 5)
            };
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    """)
    print(f"Microsim Result: {microsim_result}")

    # Try to get browser console logs (may not work in all browsers)
    try:
        logs = driver.get_log('browser')
        if logs:
            print("\n--- Browser Console Logs ---")
            for log in logs[-20:]:  # Last 20 logs
                print(f"  [{log['level']}] {log['message'][:200]}")
    except Exception as e:
        print(f"Could not get browser logs: {e}")

    driver.quit()
    print("\nDone.")

if __name__ == "__main__":
    run_debug()
