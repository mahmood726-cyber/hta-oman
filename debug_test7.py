"""
Debug test - find the specific error in HTAApp
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

    print("Loading index.html...")
    driver.get(hta_oman_index_url())
    time.sleep(5)

    # Try creating a minimal HTAApp with each component to find what fails
    tests = [
        ("Basic class", """
            class TestApp1 {
                constructor() {
                    this.project = null;
                    this.results = null;
                }
            }
            var t1 = new TestApp1();
            return { success: true, hasProject: 'project' in t1 };
        """),
        ("With HTAValidator", """
            class TestApp2 {
                constructor() {
                    this.validator = new HTAValidator();
                }
            }
            var t2 = new TestApp2();
            return { success: true, hasValidator: !!t2.validator };
        """),
        ("With MarkovEngine", """
            class TestApp3 {
                constructor() {
                    this.markovEngine = new MarkovEngine();
                }
            }
            var t3 = new TestApp3();
            return { success: true, hasEngine: !!t3.markovEngine };
        """),
        ("With PSAEngine", """
            class TestApp4 {
                constructor() {
                    this.psaEngine = new PSAEngine();
                }
            }
            var t4 = new TestApp4();
            return { success: true, hasPSA: !!t4.psaEngine };
        """),
        ("With DSAEngine", """
            class TestApp5 {
                constructor() {
                    this.dsaEngine = typeof DSAEngine !== 'undefined' ? new DSAEngine() : null;
                }
            }
            var t5 = new TestApp5();
            return { success: true, hasDSA: !!t5.dsaEngine };
        """),
        ("With engines object", """
            class TestApp6 {
                constructor() {
                    this.engines = {
                        'markov_cohort': new MarkovEngine(),
                        'microsim': typeof MicrosimulationEngine !== 'undefined' ? new MicrosimulationEngine() : null
                    };
                }
            }
            var t6 = new TestApp6();
            return { success: true, engineCount: Object.keys(t6.engines).length };
        """),
        ("With method", """
            class TestApp7 {
                constructor() {
                    this.x = 1;
                }
                testMethod() {
                    return this.x + 1;
                }
            }
            var t7 = new TestApp7();
            return { success: true, methodResult: t7.testMethod() };
        """),
        ("With async method", """
            class TestApp8 {
                constructor() {
                    this.x = 1;
                }
                async asyncMethod() {
                    return this.x + 1;
                }
            }
            var t8 = new TestApp8();
            return { success: true, hasAsync: typeof t8.asyncMethod === 'function' };
        """),
    ]

    print("\\nRunning component tests...")
    for name, code in tests:
        result = driver.execute_script(f"""
            try {{
                {code}
            }} catch(e) {{
                return {{ error: e.message, stack: e.stack.substring(0, 500) }};
            }}
        """)
        status = "PASS" if result.get('success') else "FAIL"
        print(f"  [{status}] {name}: {result}")

    # Now try to figure out what's in app.js that's different
    print("\\nChecking what's defined in window scope...")
    window_check = driver.execute_script("""
        // Get all function/class names that start with HTA or App
        var names = [];
        for (var key in window) {
            try {
                if (key.includes('HTA') || key.includes('App')) {
                    names.push({ name: key, type: typeof window[key] });
                }
            } catch(e) {}
        }
        return names;
    """)
    print(f"HTA/App names in window: {window_check}")

    # Check if there's a script error logged
    print("\\nChecking for onerror handler...")
    driver.execute_script("""
        window.__scriptErrors = [];
        window.onerror = function(msg, url, line, col, error) {
            window.__scriptErrors.push({msg: msg, url: url, line: line});
        };
    """)

    # Try to reload the app.js
    print("Trying to reload app.js...")
    reload_result = driver.execute_script("""
        return new Promise((resolve) => {
            var script = document.createElement('script');
            script.src = 'src/ui/app.js?' + Date.now();  // cache bust
            script.onload = function() {
                setTimeout(function() {
                    resolve({
                        loaded: true,
                        HTAApp: typeof HTAApp,
                        errors: window.__scriptErrors
                    });
                }, 1000);
            };
            script.onerror = function(e) {
                resolve({ error: 'Script load failed', event: e.toString() });
            };
            document.head.appendChild(script);
        });
    """)
    print(f"Reload result: {reload_result}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
