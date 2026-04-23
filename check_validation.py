from _hta_url import hta_oman_index_url, hta_oman_index_path
#!/usr/bin/env python3
"""Check validation errors for Oman templates"""
from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions
import time
import tempfile

options = EdgeOptions()
options.add_argument('--headless')
options.add_argument('--window-size=1920,1080')
temp = tempfile.mkdtemp(prefix='hta_check_')
options.add_argument(f'--user-data-dir={temp}')

driver = webdriver.Edge(options=options)
try:
    driver.get(hta_oman_index_url())
    time.sleep(3)

    # Load diabetes template
    driver.execute_script("loadOmanTemplate('diabetes_type2_treatment');")
    time.sleep(2)

    # Get validation errors
    script = """
        var result = {valid: false, errors: [], warnings: []};
        if (window.app && window.app.validationResults) {
            result.valid = window.app.validationResults.valid;
            result.errors = window.app.validationResults.errors || [];
            result.warnings = window.app.validationResults.warnings || [];
        }
        return result;
    """
    result = driver.execute_script(script)

    print(f"Valid: {result.get('valid')}")
    print(f"Error count: {len(result.get('errors', []))}")
    print("\nValidation Errors:")
    for err in result.get('errors', []):
        code = err.get('code', 'N/A')
        path = err.get('path', 'N/A')
        msg = err.get('message', 'N/A')
        print(f"  - {code}: {path}")
        print(f"    {msg}")

    if result.get('warnings'):
        print(f"\nWarnings ({len(result.get('warnings'))}):")
        for w in result.get('warnings', [])[:5]:
            print(f"  - {w.get('code')}: {w.get('message')}")

finally:
    driver.quit()
