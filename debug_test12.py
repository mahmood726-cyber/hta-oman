"""
Debug test - check window.app creation
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
    time.sleep(5)

    # Check window.app status
    status = driver.execute_script("""
        return {
            windowHTAApp: typeof window.HTAApp,
            windowApp: typeof window.app,
            documentReady: document.readyState
        };
    """)
    print(f"Status: {status}")

    # Try to create window.app manually
    create_result = driver.execute_script("""
        try {
            if (typeof window.HTAApp !== 'function') {
                return { error: 'HTAApp not a function', type: typeof window.HTAApp };
            }

            window.app = new window.HTAApp();
            return {
                success: true,
                hasApp: !!window.app,
                hasDsaEngine: !!(window.app && window.app.dsaEngine),
                hasPsaEngine: !!(window.app && window.app.psaEngine)
            };
        } catch(e) {
            return { error: e.message, stack: e.stack };
        }
    """)
    print(f"Create app: {create_result}")

    # If app created, try to run DSA
    if create_result.get('success'):
        print("\\nTrying to load demo and run DSA...")

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

        # Run DSA
        dsa_result = driver.execute_script("""
            try {
                if (!window.app.dsaEngine) return { error: 'No DSA engine' };
                if (!window.app.project) return { error: 'No project' };

                var result = window.app.dsaEngine.run(window.app.project, 'icer', 20000);
                return {
                    success: true,
                    baseline: result.baseline,
                    paramCount: (result.parameters || []).length,
                    firstParamSwing: result.parameters && result.parameters[0] ?
                        result.parameters[0].swing : 'none'
                };
            } catch(e) {
                return { error: e.message, stack: e.stack };
            }
        """)
        print(f"DSA result: {dsa_result}")

        # Try microsim
        microsim_result = driver.execute_script("""
            try {
                if (typeof MicrosimulationEngine === 'undefined') {
                    return { error: 'MicrosimulationEngine not defined' };
                }
                if (!window.app.project) return { error: 'No project' };

                var engine = new MicrosimulationEngine({
                    patients: 100,
                    seed: 12345
                });
                var result = engine.run(window.app.project, {});

                // Check if it's a promise
                if (result && typeof result.then === 'function') {
                    return { isPromise: true };
                }

                return {
                    success: true,
                    hasSummary: !!result.summary
                };
            } catch(e) {
                return { error: e.message, stack: e.stack };
            }
        """)
        print(f"Microsim result: {microsim_result}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
