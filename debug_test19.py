"""
Debug test - Check project structure for strategies
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

    # Check project structure
    print("=== Project Structure ===")
    structure = driver.execute_script("""
        const p = window.app.project;
        const strategies = p.strategies || {};

        return {
            strategyIds: Object.keys(strategies),
            strategies: Object.entries(strategies).map(([id, s]) => ({
                id: id,
                name: s.name,
                is_comparator: s.is_comparator,
                parameter_overrides: s.parameter_overrides || {},
                hasOverrides: Object.keys(s.parameter_overrides || {}).length > 0
            })),
            parameters: Object.entries(p.parameters || {}).map(([id, param]) => ({
                id: id,
                value: param.value,
                distribution: param.distribution?.type
            }))
        };
    """)
    print(f"Strategies: {structure['strategies']}")
    print(f"Parameters: {structure['parameters']}")

    # Check how app.runBaseCase differentiates strategies
    print("\n=== How Base Case Runs ===")
    bc = driver.execute_script("""
        // Simulate what runBaseCase does
        const strategies = window.app.project.strategies || {};
        const overridesUsed = {};

        for (const [id, strat] of Object.entries(strategies)) {
            overridesUsed[id] = {
                name: strat.name,
                is_comparator: strat.is_comparator,
                overrides: strat.parameter_overrides || {}
            };
        }
        return overridesUsed;
    """)
    print(f"Base case overrides: {bc}")

    # Check how the Markov engine handles strategies
    print("\n=== Markov Engine Strategy Handling ===")
    markov_check = driver.execute_script("""
        const engine = new MarkovEngine();
        const project = window.app.project;

        // Run with strategy-specific behavior
        const strategies = project.strategies || {};
        const results = {};

        for (const [id, strat] of Object.entries(strategies)) {
            const overrides = strat.parameter_overrides || {};
            const result = engine.run(project, overrides);
            results[id] = {
                name: strat.name,
                overridesApplied: Object.keys(overrides),
                total_costs: result.total_costs,
                total_qalys: result.total_qalys
            };
        }
        return results;
    """)
    print(f"Per-strategy Markov results: {markov_check}")

    driver.quit()
    print("\nDone.")

if __name__ == "__main__":
    run_debug()
