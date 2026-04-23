from _hta_url import hta_oman_index_url, hta_oman_index_path
#!/usr/bin/env python3
"""Test new disease templates"""
from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions
import time
import tempfile

options = EdgeOptions()
options.add_argument('--headless')
options.add_argument('--window-size=1920,1080')
temp = tempfile.mkdtemp(prefix='hta_templates_')
options.add_argument(f'--user-data-dir={temp}')

print("=" * 60)
print("  New Disease Templates Test")
print("=" * 60)

# New templates to test
NEW_TEMPLATES = [
    'glp1_diabetes',
    'pcsk9_inhibitors',
    'immunotherapy_nsclc',
    'biologics_asthma',
    'sma_treatment',
    'esketamine_depression'
]

driver = webdriver.Edge(options=options)
try:
    driver.get(hta_oman_index_url())
    time.sleep(3)

    # Get all available templates
    all_templates = driver.execute_script("""
        if (window.OmanHealthDatasets && window.OmanHealthDatasets.getAllTemplates) {
            return window.OmanHealthDatasets.getAllTemplates();
        }
        return [];
    """)

    print(f"\n[Test 1] Templates available: {len(all_templates)} total")
    template_ids = [t.get('id') for t in all_templates]

    print("\n[Test 2] New templates present:")
    passed = 0
    for tmpl_id in NEW_TEMPLATES:
        if tmpl_id in template_ids:
            print(f"  PASS {tmpl_id}")
            passed += 1
        else:
            print(f"  FAIL {tmpl_id} - NOT FOUND")

    print(f"\n[Test 3] Test loading each new template:")
    load_passed = 0
    for tmpl_id in NEW_TEMPLATES:
        if tmpl_id in template_ids:
            try:
                driver.execute_script(f"loadOmanTemplate('{tmpl_id}');")
                time.sleep(1)

                # Check project loaded
                result = driver.execute_script("""
                    if (window.app && window.app.project) {
                        return {
                            name: window.app.project.metadata?.name,
                            stateCount: Object.keys(window.app.project.states || {}).length,
                            paramCount: Object.keys(window.app.project.parameters || {}).length,
                            stratCount: Object.keys(window.app.project.strategies || {}).length
                        };
                    }
                    return null;
                """)

                if result and result.get('stateCount', 0) > 0:
                    print(f"  PASS {tmpl_id}: {result.get('stateCount')} states, {result.get('paramCount')} params, {result.get('stratCount')} strategies")
                    load_passed += 1
                else:
                    print(f"  FAIL {tmpl_id}: Failed to load project")
            except Exception as e:
                print(f"  FAIL {tmpl_id}: {str(e)}")

    print("\n" + "=" * 60)
    print(f"  Results: {passed}/{len(NEW_TEMPLATES)} new templates present")
    print(f"  Results: {load_passed}/{len(NEW_TEMPLATES)} templates loaded successfully")
    print("=" * 60)

finally:
    driver.quit()
