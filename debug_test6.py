"""
Debug test - try to load app.js directly and check for errors
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

    # Load a blank page first
    print("Loading blank page...")
    driver.get('about:blank')
    time.sleep(1)

    # Try to load and evaluate app.js content directly
    print("\\nFetching app.js content...")

    result = driver.execute_script("""
        return new Promise((resolve, reject) => {
            fetch(arguments[0])
                .then(r => r.text())
                .then(text => {
                    resolve({
                        length: text.length,
                        first500: text.substring(0, 500),
                        last500: text.substring(text.length - 500)
                    });
                })
                .catch(e => resolve({ error: e.message }));
        });
    """, (hta_oman_index_path().parent / 'src' / 'ui' / 'app.js').as_uri())
    print(f"Fetch result: length={result.get('length')}")

    # Now load the actual page
    print("\\nLoading actual index.html...")
    driver.get(hta_oman_index_url())
    time.sleep(5)

    # Check for JavaScript errors by trying to eval class definition
    print("\\nChecking class definition area...")

    # Try to find where the class definition fails
    test_result = driver.execute_script("""
        // Try to find what's defined right before HTAApp would be defined
        var check = {
            normalizeSettings: typeof normalizeSettings,
            resolveWtpThresholds: typeof resolveWtpThresholds,
            formatCurrencyValue: typeof formatCurrencyValue,
            guidanceDefaults: typeof guidanceDefaults,
            HTAApp: typeof HTAApp,
            windowApp: typeof window.app
        };

        // Try to eval a simple class to make sure classes work
        try {
            eval('class TestClass { constructor() { this.x = 1; } }');
            check.canCreateClass = true;
            check.testClassWorks = new TestClass().x === 1;
        } catch(e) {
            check.classError = e.message;
        }

        return check;
    """)
    print(f"Class check: {test_result}")

    # Try to read the script tag content
    script_check = driver.execute_script("""
        var scripts = document.querySelectorAll('script[src*="app.js"]');
        var results = [];
        scripts.forEach(s => {
            results.push({
                src: s.src,
                async: s.async,
                defer: s.defer,
                type: s.type || 'default',
                loaded: s.readyState || 'unknown'
            });
        });
        return results;
    """)
    print(f"Script tags: {script_check}")

    # Try to fetch and eval a small piece of app.js
    print("\\nTrying to eval app.js class definition directly...")
    eval_result = driver.execute_script("""
        // This should work since we have the helper functions
        try {
            // Define a minimal version of HTAApp to test
            class TestHTAApp {
                constructor() {
                    this.validator = new HTAValidator();
                    this.markovEngine = new MarkovEngine();
                }
            }
            var testApp = new TestHTAApp();
            return {
                success: true,
                hasValidator: !!testApp.validator,
                hasMarkov: !!testApp.markovEngine
            };
        } catch(e) {
            return { error: e.message, stack: e.stack };
        }
    """)
    print(f"Direct eval test: {eval_result}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
