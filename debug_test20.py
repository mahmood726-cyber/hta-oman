"""
Debug test - PSA with proper strategy overrides
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

    # Load and setup
    driver.get(hta_oman_index_url())
    time.sleep(3)

    for i in range(10):
        if driver.execute_script("return !!(window.app && window.app.loadDemoModel);"):
            break
        time.sleep(1)

    driver.execute_script("window.app.loadDemoModel();")
    time.sleep(2)

    # Run PSA with proper strategy overrides
    print("=== Running PSA with strategy overrides ===")
    result = driver.execute_script("""
        return new Promise(async (resolve) => {
            try {
                const project = window.app.project;
                const strategies = project.strategies || {};

                // Get strategy-specific overrides (like app.runPSA does)
                let intOverrides = {}, compOverrides = {};
                for (const [id, strat] of Object.entries(strategies)) {
                    if (strat.is_comparator) {
                        compOverrides = strat.parameter_overrides || {};
                    } else {
                        intOverrides = strat.parameter_overrides || {};
                    }
                }

                console.log('intOverrides:', intOverrides);
                console.log('compOverrides:', compOverrides);

                const engine = new PSAEngine({ iterations: 100, seed: 12345 });
                const result = await engine.run(project, intOverrides, compOverrides);

                resolve({
                    intOverrides: intOverrides,
                    compOverrides: compOverrides,
                    incCostsLength: result.scatter?.incremental_costs?.length,
                    firstIncCost: result.scatter?.incremental_costs?.[0],
                    firstIncQaly: result.scatter?.incremental_qalys?.[0],
                    meanIncCosts: result.summary?.mean_incremental_costs,
                    meanIncQalys: result.summary?.mean_incremental_qalys,
                    meanIcer: result.summary?.mean_icer,
                    probCe: result.summary?.prob_ce,
                    strategyIntCosts: result.strategy_results?.intervention?.mean_costs,
                    strategyCompCosts: result.strategy_results?.comparator?.mean_costs
                });
            } catch(e) {
                resolve({ error: e.message, stack: e.stack });
            }
        });
    """)
    print(f"PSA with overrides: {result}")

    # Also try clicking the button and seeing if it works
    print("\n=== Testing via button click ===")
    driver.execute_script("window.showSection('charts');")
    time.sleep(1)

    driver.execute_script("""
        document.getElementById('btn-run-psa').click();
    """)

    # Wait for completion
    for i in range(30):
        state = driver.execute_script("""
            return {
                psaResults: window.app?.psaResults ? {
                    iterations: window.app.psaResults.iterations,
                    meanIcer: window.app.psaResults.summary?.mean_icer,
                    firstIncCost: window.app.psaResults.scatter?.incremental_costs?.[0]
                } : null,
                progressVisible: document.getElementById('psa-progress')?.style.display,
                meanIcerDisplay: document.getElementById('psa-mean-icer')?.textContent
            };
        """)
        print(f"  {i+1}s: {state}")
        if state.get('psaResults') and state['psaResults'].get('meanIcer') is not None:
            break
        if state.get('progressVisible') == 'none' and i > 5:
            break
        time.sleep(1)

    driver.quit()
    print("\nDone.")

if __name__ == "__main__":
    run_debug()
