"""
Focused test with proper waits for each analysis
"""

import time
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.firefox import GeckoDriverManager
from _hta_url import hta_oman_index_url, hta_oman_index_path

class FocusedTester:
    def __init__(self):
        self.driver = None
        self.results = []

    def setup(self):
        print("Setting up Firefox...")
        service = Service(GeckoDriverManager().install())
        self.driver = webdriver.Firefox(service=service)
        self.driver.set_window_size(1920, 1080)

    def log(self, test, passed, detail=""):
        status = "PASS" if passed else "FAIL"
        msg = f"[{status}] {test}"
        if detail:
            msg += f" - {detail}"
        print(msg)
        self.results.append((test, passed, detail))

    def click(self, elem):
        self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", elem)
        time.sleep(0.2)
        try:
            elem.click()
        except:
            self.driver.execute_script("arguments[0].click();", elem)

    def nav(self, section):
        try:
            item = self.driver.find_element(By.CSS_SELECTOR, f'[data-section="{section}"]')
            self.click(item)
            time.sleep(0.5)
            return True
        except:
            return False

    def get_value(self, elem_id):
        try:
            elem = self.driver.find_element(By.ID, elem_id)
            return elem.text.strip()
        except:
            return None

    def wait_for_value(self, elem_id, timeout=30):
        """Wait for element to have non-empty value"""
        for i in range(timeout):
            val = self.get_value(elem_id)
            if val and val != "-" and val != "":
                return val
            time.sleep(1)
        return None

    def run_and_check(self, section, btn_id, result_checks, wait=15):
        """Navigate to section, click run button, check results"""
        print(f"\n--- Testing {section} ---")

        if not self.nav(section):
            self.log(f"{section}: Navigation", False, "nav failed")
            return

        # Click run button
        try:
            btn = self.driver.find_element(By.ID, btn_id)
            self.click(btn)
            self.log(f"{section}: Run Button", True)
        except:
            self.log(f"{section}: Run Button", False, "not found")
            return

        # Wait and check results
        time.sleep(wait)

        for elem_id, name in result_checks:
            val = self.get_value(elem_id)
            has_val = val and val != "-" and val != ""
            self.log(f"{section}: {name}", has_val, val[:30] if val else "empty")

    def check_chart(self, section, chart_id, name):
        """Check if chart has rendered content"""
        self.nav(section)
        time.sleep(0.5)
        try:
            canvas = self.driver.find_element(By.ID, chart_id)
            visible = canvas.is_displayed()
            if not visible:
                self.log(f"Chart: {name}", False, "not visible")
                return

            has_content = self.driver.execute_script("""
                var c = arguments[0];
                try {
                    var ctx = c.getContext('2d');
                    var d = ctx.getImageData(0,0,50,50).data;
                    for(var i=0;i<d.length;i+=4) if(d[i+3]>0) return true;
                } catch(e){}
                return false;
            """, canvas)
            self.log(f"Chart: {name}", has_content, "rendered" if has_content else "empty")
        except Exception as e:
            self.log(f"Chart: {name}", False, str(e)[:30])

    def run(self):
        print("="*60)
        print("FOCUSED HTA-OMAN TEST WITH PROPER WAITS")
        print("="*60)

        self.setup()

        # Load page
        self.driver.get(hta_oman_index_url())
        time.sleep(2)

        # Load demo
        demo = self.driver.find_element(By.ID, "btn-demo")
        self.click(demo)
        time.sleep(3)
        self.log("Load Demo", True)

        # Run base model
        run = self.driver.find_element(By.ID, "btn-run")
        self.click(run)
        time.sleep(3)
        self.log("Run Model", True)

        # Check base case results
        print("\n--- Base Case Results ---")
        base_values = [
            ("result-icer", "ICER"),
            ("result-costs-int", "Costs Int"),
            ("result-costs-comp", "Costs Comp"),
            ("result-qalys-int", "QALYs Int"),
            ("result-qalys-comp", "QALYs Comp"),
        ]
        self.nav("deterministic")
        for elem_id, name in base_values:
            val = self.get_value(elem_id)
            has_val = val and val != "-"
            self.log(f"Base Case: {name}", has_val, val[:25] if val else "empty")

        # Check trace chart
        self.check_chart("deterministic", "trace-chart", "Trace Chart")

        # Run and check PSA
        print("\n--- PSA Analysis ---")
        self.nav("psa")
        try:
            psa_btn = self.driver.find_element(By.ID, "btn-run-psa")
            self.click(psa_btn)
            self.log("PSA: Run Button", True)

            # Wait for PSA to complete (check for results)
            print("Waiting for PSA to complete...")
            for i in range(45):
                val = self.get_value("psa-mean-icer")
                if val and val != "-":
                    break
                time.sleep(1)
                if i % 10 == 0:
                    print(f"  ...{i}s")

            psa_values = [
                ("psa-mean-icer", "Mean ICER"),
                ("psa-prob-ce", "Prob CE"),
            ]
            for elem_id, name in psa_values:
                val = self.get_value(elem_id)
                has_val = val and val != "-"
                self.log(f"PSA: {name}", has_val, val[:20] if val else "empty")

            self.check_chart("psa", "ce-plane-chart", "CE Plane")
            self.check_chart("psa", "ceac-chart", "CEAC")
        except Exception as e:
            self.log("PSA: Run", False, str(e)[:30])

        # Run and check BIA
        print("\n--- Budget Impact Analysis ---")
        self.nav("budget-impact")
        try:
            bia_btn = self.driver.find_element(By.ID, "btn-run-bia")
            self.click(bia_btn)
            self.log("BIA: Run Button", True)
            time.sleep(3)

            bia_values = [
                ("bia-total-impact", "Total Impact"),
                ("bia-year1-impact", "Year 1 Impact"),
            ]
            for elem_id, name in bia_values:
                val = self.get_value(elem_id)
                has_val = val and val != "-"
                self.log(f"BIA: {name}", has_val, val[:25] if val else "empty")

            # Check BIA table
            try:
                tbody = self.driver.find_element(By.ID, "bia-results-body")
                rows = tbody.find_elements(By.TAG_NAME, "tr")
                self.log("BIA: Results Table", len(rows) > 0, f"{len(rows)} rows")
            except:
                self.log("BIA: Results Table", False, "not found")
        except Exception as e:
            self.log("BIA: Run", False, str(e)[:30])

        # Run and check DSA
        print("\n--- DSA Analysis ---")
        self.nav("charts")
        try:
            dsa_btn = self.driver.find_element(By.ID, "btn-run-dsa")
            self.click(dsa_btn)
            self.log("DSA: Run Button", True)

            # Wait for tornado to appear
            print("Waiting for DSA to complete...")
            for i in range(30):
                visible = self.driver.execute_script("""
                    var t = document.getElementById('tornado-container');
                    return t && t.style.display !== 'none';
                """)
                if visible:
                    break
                time.sleep(1)

            self.check_chart("charts", "tornado-chart", "Tornado Chart")
        except Exception as e:
            self.log("DSA: Run", False, str(e)[:30])

        # Run Microsim
        print("\n--- Microsimulation ---")
        self.nav("microsim")
        try:
            micro_btn = self.driver.find_element(By.ID, "btn-run-microsim")
            self.click(micro_btn)
            self.log("Microsim: Run Button", True)

            print("Waiting for Microsim...")
            for i in range(20):
                val = self.get_value("microsim-mean-cost")
                if val and val != "-":
                    break
                time.sleep(1)

            micro_values = [
                ("microsim-mean-cost", "Mean Cost"),
                ("microsim-mean-qaly", "Mean QALY"),
            ]
            for elem_id, name in micro_values:
                val = self.get_value(elem_id)
                has_val = val and val != "-"
                self.log(f"Microsim: {name}", has_val, val[:20] if val else "empty")
        except Exception as e:
            self.log("Microsim: Run", False, str(e)[:30])

        # Test Learning Stories
        print("\n--- Learning Stories ---")
        self.nav("evidence-stories")
        stories = ["what_is_hta", "understanding_icer", "understanding_uncertainty",
                   "understanding_evpi", "understanding_discounting"]

        for story in stories:
            try:
                self.driver.execute_script("""
                    var m = document.getElementById('story-modal');
                    if(m) m.style.display='none';
                """)
                time.sleep(0.2)
                self.driver.execute_script(f"""
                    var c = document.querySelector('[data-story="{story}"]');
                    if(c) c.querySelector('button').click();
                """)
                time.sleep(0.5)
                content_len = self.driver.execute_script("""
                    var c = document.getElementById('story-modal-content');
                    return c ? c.textContent.length : 0;
                """)
                self.log(f"Story: {story}", content_len > 100, f"{content_len} chars")
            except:
                self.log(f"Story: {story}", False, "error")

        # Test Reversal Cases
        print("\n--- Evidence Reversal Cases ---")
        cases = ["stents_stable_angina", "knee_arthroscopy", "hormone_replacement",
                 "tight_glucose_icu", "antiarrhythmic_drugs"]

        for case in cases:
            try:
                self.driver.execute_script("""
                    var m = document.getElementById('story-modal');
                    if(m) m.style.display='none';
                """)
                time.sleep(0.2)
                result = self.driver.execute_script(f"""
                    var c = document.querySelector('[data-case="{case}"]');
                    if(c) {{
                        c.scrollIntoView({{block:'center'}});
                        c.querySelector('button').click();
                        return true;
                    }}
                    return false;
                """)
                time.sleep(0.5)
                if result:
                    visible = self.driver.execute_script("""
                        var m = document.getElementById('story-modal');
                        return m && m.style.display !== 'none';
                    """)
                    self.log(f"Reversal: {case}", visible)
                else:
                    self.log(f"Reversal: {case}", False, "card not found")
            except:
                self.log(f"Reversal: {case}", False, "error")

        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)

        passed = sum(1 for _, p, _ in self.results if p)
        failed = sum(1 for _, p, _ in self.results if not p)
        total = len(self.results)

        print(f"\nTotal: {total}")
        print(f"Passed: {passed} ({100*passed//total}%)")
        print(f"Failed: {failed}")

        if failed > 0:
            print(f"\n--- FAILURES ---")
            for name, p, detail in self.results:
                if not p:
                    print(f"  - {name}: {detail}")

        self.driver.quit()
        print("\nDone.")


if __name__ == "__main__":
    FocusedTester().run()
