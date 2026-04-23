"""
Debug test - understand the HTAApp scope issue
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

    # Check debug markers and try to understand the scope
    check = driver.execute_script("""
        var results = {
            // Debug markers from app.js
            beforeHTAApp: window.__beforeHTAApp,
            afterHTAApp: window.__afterHTAApp,
            htaAppTypeAtDefinition: window.__HTAAppType,

            // Current state
            htaAppNow: typeof HTAApp,
            windowHTAApp: typeof window.HTAApp,
            thisHTAApp: typeof this.HTAApp,

            // Check if it's been deleted
            hasOwnProperty: window.hasOwnProperty('HTAApp'),

            // Check globalThis
            globalThisHTAApp: typeof globalThis.HTAApp,

            // Check if window.app was ever created
            windowApp: typeof window.app,
        };

        // Check for any error that might have occurred
        if (window.onerror) {
            results.hasErrorHandler = true;
        }

        return results;
    """)
    print(f"Scope analysis: {check}")

    # Try to access HTAApp using different methods
    access_test = driver.execute_script("""
        var results = {};

        // Method 1: Direct access
        try {
            results.direct = typeof HTAApp;
        } catch(e) {
            results.directError = e.message;
        }

        // Method 2: eval
        try {
            results.eval = eval('typeof HTAApp');
        } catch(e) {
            results.evalError = e.message;
        }

        // Method 3: Window bracket notation
        try {
            results.bracket = typeof window['HTAApp'];
        } catch(e) {
            results.bracketError = e.message;
        }

        // Method 4: Function constructor (global scope)
        try {
            results.functionScope = (new Function('return typeof HTAApp'))();
        } catch(e) {
            results.functionScopeError = e.message;
        }

        return results;
    """)
    print(f"Access methods: {access_test}")

    # Check if there's something overwriting globals
    overwrites = driver.execute_script("""
        // Look for any patterns that might delete or overwrite HTAApp
        var potentialIssues = [];

        // Check if any script has 'use strict' at global level
        // Check for any getters/setters on window
        try {
            var desc = Object.getOwnPropertyDescriptor(window, 'HTAApp');
            if (desc) {
                potentialIssues.push('HTAApp has property descriptor: ' + JSON.stringify(desc));
            }
        } catch(e) {}

        // Check if window itself has been modified
        potentialIssues.push('window is writable: ' + Object.getOwnPropertyDescriptor(globalThis, 'window')?.writable);

        return potentialIssues;
    """)
    print(f"Potential issues: {overwrites}")

    # The key insight: htaAppTypeAtDefinition is 'function' but htaAppNow is 'undefined'
    # This means something is removing HTAApp after it's defined
    # Let's check scripts that load AFTER app.js

    after_app_check = driver.execute_script("""
        // Find app.js script tag
        var scripts = Array.from(document.querySelectorAll('script'));
        var appJsIdx = scripts.findIndex(s => s.src && s.src.includes('app.js'));

        // Get scripts that come after
        var afterScripts = scripts.slice(appJsIdx + 1).filter(s => s.src);

        return {
            appJsIndex: appJsIdx,
            totalScripts: scripts.length,
            afterCount: afterScripts.length,
            firstFewAfter: afterScripts.slice(0, 5).map(s => s.src.split('/').pop())
        };
    """)
    print(f"Scripts after app.js: {after_app_check}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
