from _hta_url import hta_oman_index_url, hta_oman_index_path
#!/usr/bin/env python3
"""Test new analytical modules: BIA, CHEERS, Sensitivity, VOI, Life Tables"""
from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions
import time
import tempfile

options = EdgeOptions()
options.add_argument('--headless')
options.add_argument('--window-size=1920,1080')
temp = tempfile.mkdtemp(prefix='hta_modules_')
options.add_argument(f'--user-data-dir={temp}')

print("=" * 70)
print("  New Analytical Modules Test")
print("=" * 70)

driver = webdriver.Edge(options=options)
passed = 0
total = 0

def test(name, condition, details=""):
    global passed, total
    total += 1
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        print(f"  [FAIL] {name}")
    if details:
        print(f"         {details}")

try:
    driver.get(hta_oman_index_url())
    time.sleep(3)

    # Test 1: Budget Impact Analysis
    print("\n1. Budget Impact Analysis (BIA)")
    print("-" * 50)

    bia_exists = driver.execute_script("return typeof BudgetImpactAnalysis !== 'undefined';")
    test("BIA class exists", bia_exists)

    bia_defaults = driver.execute_script("""
        if (typeof BudgetImpactAnalysis !== 'undefined') {
            return BudgetImpactAnalysis.OmanDefaults;
        }
        return null;
    """)
    test("Oman BIA defaults defined", bia_defaults is not None,
         f"Horizon: {bia_defaults.get('horizon') if bia_defaults else 'N/A'} years")

    # Test BIA run
    bia_result = driver.execute_script("""
        if (typeof BudgetImpactAnalysis === 'undefined') return null;
        try {
            const bia = new BudgetImpactAnalysis({ currency: 'OMR' });
            const result = bia.run({
                population: { basePopulation: 10000, growthRate: 0.02 },
                currentScenario: {
                    treatments: [{ id: 'standard', share: 1.0 }]
                },
                newScenario: {
                    treatments: [
                        { id: 'standard', share: 0.7 },
                        { id: 'new', share: 0.3 }
                    ]
                },
                costs: {
                    standard: { annual: 500 },
                    new: { annual: 2000 }
                },
                horizon: 4
            });
            return {
                years: result.years.length,
                hasNetImpact: result.netImpact && result.netImpact.cumulative !== undefined,
                cumulative: result.netImpact?.cumulative
            };
        } catch (e) {
            return { error: e.message };
        }
    """)
    test("BIA calculation runs", bia_result and not bia_result.get('error'),
         f"4-year impact: {bia_result.get('cumulative', 0):,.0f} OMR" if bia_result else "")

    # Test 2: CHEERS 2022 Checklist
    print("\n2. CHEERS 2022 Checklist")
    print("-" * 50)

    cheers_exists = driver.execute_script("return typeof CHEERS2022Checklist !== 'undefined';")
    test("CHEERS2022Checklist class exists", cheers_exists)

    cheers_items = driver.execute_script("""
        if (typeof CHEERS2022Checklist === 'undefined') return null;
        const c = new CHEERS2022Checklist();
        const items = c.getChecklistItems();
        const sections = Object.keys(items);
        let totalItems = 0;
        for (const sec of sections) {
            totalItems += items[sec].items.length;
        }
        return { sections: sections.length, items: totalItems };
    """)
    test("CHEERS checklist items loaded", cheers_items and cheers_items.get('items') == 28,
         f"{cheers_items.get('items') if cheers_items else 0} items in {cheers_items.get('sections') if cheers_items else 0} sections")

    # Test auto-populate
    driver.execute_script("loadOmanTemplate('diabetes_type2_treatment');")
    time.sleep(1)

    auto_pop = driver.execute_script("""
        if (typeof CHEERS2022Checklist === 'undefined') return null;
        const c = new CHEERS2022Checklist();
        const populated = c.autoPopulate(window.app?.project);
        return Object.keys(populated).length;
    """)
    test("CHEERS auto-populate from model", auto_pop and auto_pop > 5,
         f"{auto_pop} fields auto-populated" if auto_pop else "")

    # Test 3: Sensitivity Analysis
    print("\n3. Advanced Sensitivity Analysis")
    print("-" * 50)

    sens_exists = driver.execute_script("return typeof SensitivityAnalysis !== 'undefined';")
    test("SensitivityAnalysis class exists", sens_exists)

    # Test one-way sensitivity
    oneway_result = driver.execute_script("""
        if (typeof SensitivityAnalysis === 'undefined' || !window.app?.project) return null;
        try {
            const sa = new SensitivityAnalysis();
            const params = Object.keys(window.app.project.parameters || {}).slice(0, 3);
            const result = sa.runOneWay(window.app.project, params.map(id => ({ id })));
            return {
                baseCase: result.baseCase,
                paramCount: result.parameters.length
            };
        } catch (e) {
            return { error: e.message };
        }
    """)
    test("One-way sensitivity runs", oneway_result and not oneway_result.get('error'),
         f"Base ICER: {oneway_result.get('baseCase', 0):,.0f}, {oneway_result.get('paramCount', 0)} params" if oneway_result else "")

    # Test two-way sensitivity
    twoway_result = driver.execute_script("""
        if (typeof SensitivityAnalysis === 'undefined' || !window.app?.project) return null;
        try {
            const sa = new SensitivityAnalysis();
            const params = Object.keys(window.app.project.parameters || {});
            if (params.length < 2) return { error: 'Need 2+ params' };
            const result = sa.runTwoWay(
                window.app.project,
                { id: params[0], steps: 5 },
                { id: params[1], steps: 5 }
            );
            return {
                matrixSize: result.matrix?.length,
                costEffectivePct: result.stats?.costEffectivePercent?.toFixed(1)
            };
        } catch (e) {
            return { error: e.message };
        }
    """)
    test("Two-way sensitivity (heatmap) runs", twoway_result and not twoway_result.get('error'),
         f"5x5 matrix, {twoway_result.get('costEffectivePct')}% cost-effective" if twoway_result else "")

    # Test 4: Value of Information
    print("\n4. Value of Information (VOI)")
    print("-" * 50)

    voi_exists = driver.execute_script("return typeof ValueOfInformation !== 'undefined';")
    test("ValueOfInformation class exists", voi_exists)

    # Test EVPI (with small iterations for speed)
    evpi_result = driver.execute_script("""
        if (typeof ValueOfInformation === 'undefined' || !window.app?.project) return null;
        try {
            const voi = new ValueOfInformation();
            const result = voi.calculateEVPI(window.app.project, {
                iterations: 100,
                wtp: 7800,
                populationSize: 5000,
                timeHorizon: 5
            });
            return {
                evpiPerPatient: result.evpiPerPatient,
                populationEvpi: result.populationEvpi,
                probWrong: result.probWrongDecision
            };
        } catch (e) {
            return { error: e.message };
        }
    """)
    test("EVPI calculation runs", evpi_result and not evpi_result.get('error'),
         f"Per-patient EVPI: {evpi_result.get('evpiPerPatient', 0):,.0f} OMR" if evpi_result else "")

    # Test 5: Oman Life Tables
    print("\n5. Oman Life Tables")
    print("-" * 50)

    lifetables_exists = driver.execute_script("return typeof OmanLifeTables !== 'undefined';")
    test("OmanLifeTables module exists", lifetables_exists)

    life_exp = driver.execute_script("""
        if (typeof OmanLifeTables === 'undefined') return null;
        return OmanLifeTables.LIFE_EXPECTANCY;
    """)
    test("Life expectancy data", life_exp and life_exp.get('both'),
         f"Life expectancy: {life_exp.get('both')} years ({life_exp.get('year')})" if life_exp else "")

    mortality = driver.execute_script("""
        if (typeof OmanLifeTables === 'undefined') return null;
        const rate50 = OmanLifeTables.getMortalityRate(50, 'both');
        const rate70 = OmanLifeTables.getMortalityRate(70, 'both');
        return { age50: rate50, age70: rate70 };
    """)
    test("Age-specific mortality rates", mortality and mortality.get('age50'),
         f"Age 50: {mortality.get('age50', 0)*1000:.1f}/1000, Age 70: {mortality.get('age70', 0)*1000:.1f}/1000" if mortality else "")

    disease_mult = driver.execute_script("""
        if (typeof OmanLifeTables === 'undefined') return null;
        return OmanLifeTables.DISEASE_MORTALITY_MULTIPLIERS;
    """)
    test("Disease mortality multipliers", disease_mult and 'post_mi' in disease_mult,
         f"Post-MI Year 1 RR: {disease_mult.get('post_mi', {}).get('year1', 'N/A')}" if disease_mult else "")

    # Summary
    print("\n" + "=" * 70)
    print(f"  RESULTS: {passed}/{total} tests passed ({passed/total*100:.0f}%)")
    print("=" * 70)

finally:
    driver.quit()
