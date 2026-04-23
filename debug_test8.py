"""
Debug test - check script loading order and errors
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

    # First, let's try a minimal test page to see if HTAApp works in isolation
    print("Testing app.js in isolation...")

    # Create a minimal test page
    test_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <script>
            // Minimal stubs
            window.OmanHTAGuidance = { defaults: {} };
            class HTAValidator { validate() { return []; } }
            class MarkovEngine { run() { return {}; } runAllStrategies() { return { incremental: { comparisons: [{ icer: 0 }] } }; } }
            class PSAEngine { run() { return {}; } }
            class DSAEngine {
                constructor() { this.options = { percentageRange: 0.2 }; }
                run() { return { parameters: [] }; }
            }
            class MicrosimulationEngine { run() { return {}; } }
        </script>
    </head>
    <body>
        <div id="drop-zone"></div>
        <div id="loading-overlay" class="active"></div>
        <div id="btn-demo"></div>
        <div id="btn-open"></div>
        <div id="file-input"></div>
        <script>
            // Check before loading app.js
            window.beforeAppJs = {
                HTAValidator: typeof HTAValidator,
                MarkovEngine: typeof MarkovEngine,
                HTAApp: typeof HTAApp
            };
        </script>
        <script src="src/ui/app.js"></script>
        <script>
            // Check after loading app.js
            window.afterAppJs = {
                HTAApp: typeof HTAApp,
                windowApp: typeof window.app,
                normalizeSettings: typeof normalizeSettings
            };

            // Try to access HTAApp
            try {
                window.htaAppExists = typeof HTAApp !== 'undefined';
                if (window.htaAppExists) {
                    window.testAppInstance = new HTAApp();
                }
            } catch(e) {
                window.htaAppError = e.message;
            }
        </script>
    </body>
    </html>
    """

    # Write test HTML
    import os
    test_path = os.path.join(os.path.dirname(__file__), 'test_app_isolation.html')
    with open(test_path, 'w') as f:
        f.write(test_html)

    # Load the test page
    driver.get(f'file:///{test_path}')
    time.sleep(3)

    # Check results
    result = driver.execute_script("""
        return {
            before: window.beforeAppJs,
            after: window.afterAppJs,
            htaAppExists: window.htaAppExists,
            error: window.htaAppError,
            testInstance: window.testAppInstance ? 'created' : 'not created'
        };
    """)
    print(f"Isolation test result: {result}")

    # Now load the full index.html and compare
    print("\\nNow loading full index.html...")
    driver.get(hta_oman_index_url())
    time.sleep(5)

    full_result = driver.execute_script("""
        return {
            HTAApp: typeof HTAApp,
            windowApp: typeof window.app,
            normalizeSettings: typeof normalizeSettings,
            // Check script count
            totalScripts: document.querySelectorAll('script').length,
            srcScripts: document.querySelectorAll('script[src]').length,
            // Check for app.js specifically
            appJsTag: !!document.querySelector('script[src*="app.js"]')
        };
    """)
    print(f"Full index.html result: {full_result}")

    # Check the order of scripts
    scripts = driver.execute_script("""
        return Array.from(document.querySelectorAll('script[src]'))
            .map(s => s.src.split('/').pop())
            .filter(s => s.includes('app') || s.includes('psa') || s.includes('markov'));
    """)
    print(f"Script order (app/psa/markov): {scripts}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
