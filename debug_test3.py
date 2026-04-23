"""
Debug test to check HTAApp class definition
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

    # Check all the dependencies needed for HTAApp
    deps = driver.execute_script("""
        return {
            HTAValidator: typeof HTAValidator,
            ProofCarrying: typeof ProofCarrying,
            MarkovEngine: typeof MarkovEngine,
            PSAEngine: typeof PSAEngine,
            DSAEngine: typeof DSAEngine,
            MicrosimulationEngine: typeof MicrosimulationEngine,
            PartitionedSurvivalEngine: typeof PartitionedSurvivalEngine,
            DESEngine: typeof DESEngine,
            EVPICalculator: typeof EVPICalculator,
            BudgetImpactCalculator: typeof BudgetImpactCalculator,
            getAuditLogger: typeof getAuditLogger,
            ModelWizard: typeof ModelWizard,
            ResultsDashboard: typeof ResultsDashboard,
            CHEERSReportGenerator: typeof CHEERSReportGenerator
        };
    """)
    print(f"Dependencies: {deps}")

    # Try to create HTAApp manually and catch errors
    result = driver.execute_script("""
        try {
            // Check if class exists
            if (typeof HTAApp === 'undefined') {
                return { error: 'HTAApp class is undefined' };
            }

            // Try to instantiate
            var app = new HTAApp();
            return { success: true, hasProject: app.project !== null };
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    """)
    print(f"HTAApp creation: {result}")

    # Check window.app after DOMContentLoaded should have fired
    app_check = driver.execute_script("""
        return {
            hasWindowApp: typeof window.app !== 'undefined' && window.app !== null,
            appType: typeof window.app
        };
    """)
    print(f"window.app check: {app_check}")

    # If HTAApp is undefined, check if file loaded
    if deps.get('HTAValidator') == 'undefined':
        # Check validator.js loading
        val_check = driver.execute_script("""
            var scripts = document.querySelectorAll('script[src*="validator"]');
            return {
                count: scripts.length,
                srcs: Array.from(scripts).map(s => s.src)
            };
        """)
        print(f"Validator scripts: {val_check}")

    driver.quit()
    print("\\nDone.")

if __name__ == "__main__":
    run_debug()
