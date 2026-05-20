from _hta_url import hta_oman_index_url, hta_oman_index_path
#!/usr/bin/env python3
"""Test strategy differentiation - ensure intervention vs comparator produce different results"""
from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions
import time
import tempfile

options = EdgeOptions()
options.add_argument('--headless')
options.add_argument('--window-size=1920,1080')
temp = tempfile.mkdtemp(prefix='hta_diff_')
options.add_argument(f'--user-data-dir={temp}')

print("=" * 60)
print("  Strategy Differentiation Test")
print("=" * 60)

driver = webdriver.Edge(options=options)
try:
    driver.get(hta_oman_index_url())
    time.sleep(3)

    # Load GLP-1 template which has parameter_overrides for hazard ratios
    driver.execute_script("loadOmanTemplate('glp1_diabetes');")
    time.sleep(2)

    # Run the Markov model comparison
    result = driver.execute_script("""
        try {
            if (!window.app || !window.app.project) {
                return { error: 'App or project not loaded' };
            }

            const project = window.app.project;
            const engine = new MarkovEngine();

            // Debug: Check strategies and their parameter_overrides
            const stratDebug = {};
            for (const [id, strat] of Object.entries(project.strategies || {})) {
                stratDebug[id] = {
                    label: strat.label,
                    is_comparator: strat.is_comparator,
                    has_overrides: Boolean(strat.parameter_overrides),
                    override_count: Object.keys(strat.parameter_overrides || {}).length,
                    overrides: strat.parameter_overrides || {}
                };
            }

            // Run strategy comparison (method is runAllStrategies)
            const results = engine.runAllStrategies(project);

            // Extract key values
            const strategies = results.strategies || {};
            const stratKeys = Object.keys(strategies);

            let intervention = null;
            let comparator = null;

            for (const key of stratKeys) {
                const strat = project.strategies[key];
                if (strat && strat.is_comparator) {
                    comparator = {
                        id: key,
                        label: strategies[key].label,
                        costs: strategies[key].total_costs,
                        qalys: strategies[key].total_qalys
                    };
                } else {
                    intervention = {
                        id: key,
                        label: strategies[key].label,
                        costs: strategies[key].total_costs,
                        qalys: strategies[key].total_qalys
                    };
                }
            }

            // Check if ICER can be calculated
            let icer = null;
            if (results.incremental && results.incremental.comparisons) {
                const comp = results.incremental.comparisons[0];
                if (comp) {
                    icer = comp.icer;
                }
            }

            return {
                strategyCount: stratKeys.length,
                intervention: intervention,
                comparator: comparator,
                icer: icer,
                incCosts: results.incremental?.comparisons?.[0]?.incremental_costs,
                incQalys: results.incremental?.comparisons?.[0]?.incremental_qalys,
                dominance: results.incremental?.comparisons?.[0]?.dominance,
                stratDebug: stratDebug
            };
        } catch (e) {
            return { error: e.message };
        }
    """)

    print("\n[Test 1] Template loaded with strategies")
    if result.get('error'):
        print(f"  FAIL: {result['error']}")
    elif result.get('strategyCount', 0) >= 2:
        print(f"  PASS: {result['strategyCount']} strategies found")
    else:
        print(f"  FAIL: Expected 2+ strategies, got {result.get('strategyCount')}")

    # Debug: Show strategy parameter_overrides
    print("\n[DEBUG] Strategy parameter_overrides:")
    for strat_id, info in result.get('stratDebug', {}).items():
        print(f"  {strat_id}: {info.get('label')}")
        print(f"    is_comparator: {info.get('is_comparator')}")
        print(f"    has_overrides: {info.get('has_overrides')}")
        print(f"    override_count: {info.get('override_count')}")
        if info.get('overrides'):
            for k, v in info.get('overrides', {}).items():
                print(f"      {k}: {v}")

    print("\n[Test 2] Intervention strategy results")
    int_data = result.get('intervention', {})
    if int_data and int_data.get('costs') is not None:
        print(f"  PASS: {int_data.get('label')}")
        print(f"        Costs: {int_data.get('costs', 0):.2f} OMR")
        print(f"        QALYs: {int_data.get('qalys', 0):.4f}")
    else:
        print(f"  FAIL: No intervention results")

    print("\n[Test 3] Comparator strategy results")
    comp_data = result.get('comparator', {})
    if comp_data and comp_data.get('costs') is not None:
        print(f"  PASS: {comp_data.get('label')}")
        print(f"        Costs: {comp_data.get('costs', 0):.2f} OMR")
        print(f"        QALYs: {comp_data.get('qalys', 0):.4f}")
    else:
        print(f"  FAIL: No comparator results")

    print("\n[Test 4] Strategy differentiation (results differ)")
    if int_data and comp_data:
        costs_differ = abs(int_data.get('costs', 0) - comp_data.get('costs', 0)) > 0.01
        qalys_differ = abs(int_data.get('qalys', 0) - comp_data.get('qalys', 0)) > 0.0001

        if costs_differ or qalys_differ:
            print(f"  PASS: Strategies produce different results")
            print(f"        Cost difference: {int_data.get('costs', 0) - comp_data.get('costs', 0):.2f} OMR")
            print(f"        QALY difference: {int_data.get('qalys', 0) - comp_data.get('qalys', 0):.4f}")
        else:
            print(f"  FAIL: Strategies have identical results (no differentiation)")
    else:
        print(f"  FAIL: Cannot compare strategies")

    print("\n[Test 5] ICER calculation")
    icer = result.get('icer')
    dominance = result.get('dominance')
    inc_costs = result.get('incCosts')
    inc_qalys = result.get('incQalys')

    if icer is not None:
        print(f"  PASS: ICER = {icer:,.0f} OMR/QALY")
        print(f"        Incremental costs: {inc_costs:.2f} OMR")
        print(f"        Incremental QALYs: {inc_qalys:.4f}")
    elif dominance == 'dominant':
        print(f"  PASS: Intervention is DOMINANT (more effective, less costly)")
    elif dominance == 'dominated':
        print(f"  PASS: Intervention is DOMINATED (less effective, more costly)")
    else:
        print(f"  INFO: No ICER - dominance: {dominance}")
        print(f"        Incremental costs: {inc_costs}")
        print(f"        Incremental QALYs: {inc_qalys}")

    # Final summary
    print("\n" + "=" * 60)
    tests_passed = 0
    total_tests = 5

    if result.get('strategyCount', 0) >= 2:
        tests_passed += 1
    if int_data and int_data.get('costs') is not None:
        tests_passed += 1
    if comp_data and comp_data.get('costs') is not None:
        tests_passed += 1
    if int_data and comp_data:
        costs_differ = abs(int_data.get('costs', 0) - comp_data.get('costs', 0)) > 0.01
        qalys_differ = abs(int_data.get('qalys', 0) - comp_data.get('qalys', 0)) > 0.0001
        if costs_differ or qalys_differ:
            tests_passed += 1
    if icer is not None or dominance in ['dominant', 'dominated']:
        tests_passed += 1

    print(f"  Results: {tests_passed}/{total_tests} tests passed")
    print("=" * 60)

finally:
    driver.quit()
