"""
Debug test - Deep PSA investigation
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

    # Run base case to verify Markov works
    print("Running base case via Markov Engine...")
    base = driver.execute_script("""
        const engine = new MarkovEngine();
        const result = engine.run(window.app.project, {});
        return {
            totalCosts: result.total_costs,
            totalQalys: result.total_qalys,
            hasTrace: !!result.trace
        };
    """)
    print(f"Base Markov result: {base}")

    # Debug PSA step by step
    print("\n=== Manual PSA Debug ===")
    debug_result = driver.execute_script("""
        return new Promise(async (resolve) => {
            try {
                const project = window.app.project;
                const engine = new PSAEngine({ iterations: 5, seed: 12345 });

                // Check what we have
                const params = project.parameters || {};
                const paramKeys = Object.keys(params);

                // Sample params once
                const sampled = engine.sampleParameters(params);

                // Run one iteration manually
                const markov = new MarkovEngine();
                const intResult = markov.run(project, sampled);
                const compResult = markov.run(project, {});

                const incC = intResult.total_costs - compResult.total_costs;
                const incQ = intResult.total_qalys - compResult.total_qalys;
                const icer = incQ !== 0 ? incC / incQ : null;

                resolve({
                    paramKeys: paramKeys.slice(0, 10),
                    sampledKeys: Object.keys(sampled).slice(0, 10),
                    firstSampledValue: Object.values(sampled)[0],
                    intResult: {
                        total_costs: intResult.total_costs,
                        total_qalys: intResult.total_qalys
                    },
                    compResult: {
                        total_costs: compResult.total_costs,
                        total_qalys: compResult.total_qalys
                    },
                    incC: incC,
                    incQ: incQ,
                    icer: icer
                });
            } catch(e) {
                resolve({ error: e.message, stack: e.stack });
            }
        });
    """)
    print(f"Manual PSA debug: {debug_result}")

    # Now run full PSA and check arrays
    print("\n=== Full PSA run with array checks ===")
    full_result = driver.execute_script("""
        return new Promise(async (resolve) => {
            try {
                const engine = new PSAEngine({ iterations: 10, seed: 12345 });
                const result = await engine.run(window.app.project, {}, {});

                resolve({
                    incCostsLength: result.scatter?.incremental_costs?.length,
                    incQalysLength: result.scatter?.incremental_qalys?.length,
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
    print(f"Full PSA result: {full_result}")

    driver.quit()
    print("\nDone.")

if __name__ == "__main__":
    run_debug()
