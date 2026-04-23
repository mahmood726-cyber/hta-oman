"""
Debug test to check JavaScript loading errors
"""

import time
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from webdriver_manager.firefox import GeckoDriverManager
from _hta_url import hta_oman_index_url, hta_oman_index_path

def run_debug():
    print("Setting up Firefox with console logging...")

    options = Options()
    options.set_preference("devtools.console.stdout.content", True)

    service = Service(GeckoDriverManager().install())
    driver = webdriver.Firefox(service=service, options=options)
    driver.set_window_size(1920, 1080)

    # Load page
    print("Loading page...")
    driver.get(hta_oman_index_url())
    time.sleep(5)

    # Check what's available in window
    checks = driver.execute_script("""
        var results = {
            // Core globals
            hasHTAApp: typeof HTAApp !== 'undefined',
            hasMarkovEngine: typeof MarkovEngine !== 'undefined',
            hasPSAEngine: typeof PSAEngine !== 'undefined',
            hasDSAEngine: typeof DSAEngine !== 'undefined',
            hasMicrosimulationEngine: typeof MicrosimulationEngine !== 'undefined',

            // App instance
            hasWindowApp: typeof window.app !== 'undefined' && window.app !== null,

            // Check for errors
            documentReady: document.readyState,

            // Check if specific elements exist
            hasDemoBtn: !!document.getElementById('btn-demo'),
            hasRunBtn: !!document.getElementById('btn-run'),
        };

        // Try to create app if it doesn't exist
        if (!results.hasWindowApp && results.hasHTAApp) {
            try {
                window.app = new HTAApp();
                results.createdApp = true;
                results.hasWindowApp = true;
            } catch (e) {
                results.appCreationError = e.message;
            }
        }

        return results;
    """)
    print(f"Initial checks: {checks}")

    if not checks.get('hasWindowApp'):
        print("\\nApp not available, checking for script errors...")

        # Check if scripts loaded
        script_check = driver.execute_script("""
            var scripts = document.querySelectorAll('script[src]');
            var results = [];
            scripts.forEach(function(s) {
                if (s.src.includes('app.js') || s.src.includes('psa.js') || s.src.includes('microsim')) {
                    results.push({
                        src: s.src.split('/').pop(),
                        loaded: true  // If we got here, it didn't cause a parse error
                    });
                }
            });
            return results;
        """)
        print(f"Script loading: {script_check}")

        # Try to check for any initialization code
        init_check = driver.execute_script("""
            // Check DOMContentLoaded handlers
            return {
                domReady: document.readyState,
                bodyExists: !!document.body,
                hasDropZone: !!document.getElementById('drop-zone')
            };
        """)
        print(f"DOM state: {init_check}")

    else:
        # App exists, check its state
        app_state = driver.execute_script("""
            return {
                hasProject: !!window.app.project,
                hasDsaEngine: !!window.app.dsaEngine,
                hasMarkovEngine: !!window.app.markovEngine,
                hasPsaEngine: !!window.app.psaEngine,
                methods: Object.keys(window.app).filter(k => typeof window.app[k] === 'function').slice(0, 10)
            };
        """)
        print(f"App state: {app_state}")

        # Try to load demo
        print("\\nTrying to load demo...")
        driver.execute_script("window.app.loadDemoModel();")
        time.sleep(3)

        # Check project after demo load
        project_state = driver.execute_script("""
            if (!window.app.project) return { error: 'No project' };
            return {
                hasProject: true,
                stateCount: Object.keys(window.app.project.states || {}).length,
                paramCount: Object.keys(window.app.project.parameters || {}).length,
                transitionCount: Object.keys(window.app.project.transitions || {}).length,
                strategyCount: Object.keys(window.app.project.strategies || {}).length
            };
        """)
        print(f"Project state: {project_state}")

        # Try DSA
        print("\\nTrying DSA...")
        dsa_result = driver.execute_script("""
            try {
                if (!window.app.dsaEngine) return { error: 'No DSA engine' };
                var result = window.app.dsaEngine.run(window.app.project, 'icer', 20000);
                return {
                    success: true,
                    baseline: result.baseline,
                    paramCount: (result.parameters || []).length,
                    firstParam: result.parameters && result.parameters[0] ? {
                        parameter: result.parameters[0].parameter,
                        swing: result.parameters[0].swing,
                        lowResult: result.parameters[0].lowResult
                    } : null
                };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        """)
        print(f"DSA result: {dsa_result}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
