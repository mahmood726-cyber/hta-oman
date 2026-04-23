"""
Debug test to check HTAApp exact error
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
    time.sleep(5)

    # Check if HTAApp is a string that was defined (check window)
    result = driver.execute_script("""
        // Check what's in the global scope related to HTA
        var htaRelated = {};
        for (var key in window) {
            if (key.toLowerCase().includes('hta') || key.toLowerCase().includes('app')) {
                try {
                    htaRelated[key] = typeof window[key];
                } catch(e) {}
            }
        }
        return htaRelated;
    """)
    print(f"HTA/App related globals: {result}")

    # Try to evaluate HTAApp directly
    eval_result = driver.execute_script("""
        try {
            var x = HTAApp;
            return { found: true, type: typeof HTAApp };
        } catch (e) {
            return { found: false, error: e.message };
        }
    """)
    print(f"Direct HTAApp eval: {eval_result}")

    # Check if there's an app.js loading error by looking at network
    # Try to refetch and check
    check_result = driver.execute_script("""
        // Check if the script tag for app.js exists and was executed
        var appScript = document.querySelector('script[src*="app.js"]');
        if (!appScript) {
            return { error: 'No app.js script tag found' };
        }

        // Try to get the script contents and see what happens
        return {
            scriptSrc: appScript.src,
            scriptLoaded: true,
            // Check if specific functions from app.js are defined
            normalizeSettings: typeof normalizeSettings,
            resolveWtpThresholds: typeof resolveWtpThresholds,
            formatCurrencyValue: typeof formatCurrencyValue,
            guidanceDefaults: typeof guidanceDefaults
        };
    """)
    print(f"app.js loading check: {check_result}")

    # Check if something overwritten HTAApp
    override_check = driver.execute_script("""
        // Check Object.getOwnPropertyDescriptor
        var desc = Object.getOwnPropertyDescriptor(window, 'HTAApp');
        return desc ? {
            value: typeof desc.value,
            configurable: desc.configurable,
            writable: desc.writable
        } : 'not defined on window';
    """)
    print(f"HTAApp property descriptor: {override_check}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
