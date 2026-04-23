"""
Debug test - find what's interfering with HTAApp
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

    # Get all script tags and their order
    scripts = driver.execute_script("""
        var scripts = document.querySelectorAll('script');
        var appJsIndex = -1;
        var results = [];

        scripts.forEach((s, i) => {
            var info = {
                index: i,
                src: s.src ? s.src.split('/').pop() : '(inline)',
                type: s.type || 'default'
            };

            if (s.src && s.src.includes('app.js')) {
                appJsIndex = i;
                info.isAppJs = true;
            }

            // Only include scripts around app.js or interesting ones
            if (s.src && (s.src.includes('app') || s.src.includes('ui') ||
                i >= appJsIndex - 3 && i <= appJsIndex + 3)) {
                results.push(info);
            }
        });

        return { appJsIndex: appJsIndex, nearbyScripts: results };
    """)
    print(f"Scripts near app.js: {scripts}")

    # Check scripts loaded after app.js
    after_scripts = driver.execute_script("""
        var scripts = Array.from(document.querySelectorAll('script[src]'))
            .map(s => s.src.split('/').pop());
        var appJsIdx = scripts.indexOf('app.js');
        return {
            afterAppJs: scripts.slice(appJsIdx + 1, appJsIdx + 10),
            totalAfter: scripts.slice(appJsIdx + 1).length
        };
    """)
    print(f"Scripts after app.js: {after_scripts}")

    # Check if any script defines something that conflicts with HTAApp
    check_scripts = driver.execute_script("""
        // Check each script that loaded after app.js for HTAApp reference
        var issues = [];

        // Check inline scripts for any HTAApp manipulation
        var inlineScripts = document.querySelectorAll('script:not([src])');
        inlineScripts.forEach((s, i) => {
            var content = s.textContent;
            if (content.includes('HTAApp') || content.includes('class HTA')) {
                issues.push({
                    type: 'inline',
                    index: i,
                    snippet: content.substring(0, 200)
                });
            }
        });

        return issues;
    """)
    print(f"Scripts mentioning HTAApp: {check_scripts}")

    # Check if there's something overwriting HTAApp
    overwrite_check = driver.execute_script("""
        // Try to get HTAApp from different scopes
        var checks = {
            windowHTAApp: typeof window.HTAApp,
            globalHTAApp: typeof globalThis.HTAApp,
            selfHTAApp: typeof self.HTAApp,
        };

        // Check if HTAApp is configurable/deletable
        try {
            var desc = Object.getOwnPropertyDescriptor(window, 'HTAApp');
            checks.descriptor = desc ? JSON.stringify(desc) : 'no descriptor';
        } catch(e) {
            checks.descriptorError = e.message;
        }

        // Check for any getters that might be interfering
        try {
            checks.hasGetter = !!(Object.getOwnPropertyDescriptor(window, 'HTAApp') || {}).get;
        } catch(e) {}

        return checks;
    """)
    print(f"HTAApp scope check: {overwrite_check}")

    # Check advancedUI.js since it loads right after app.js
    advui_check = driver.execute_script("""
        // Check if AdvancedUI is causing issues
        return {
            advancedUI: typeof AdvancedUI,
            advancedUIConstructor: typeof AdvancedUI === 'function' ?
                AdvancedUI.toString().substring(0, 300) : 'N/A'
        };
    """)
    print(f"AdvancedUI check: {advui_check}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
