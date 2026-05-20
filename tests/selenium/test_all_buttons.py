"""
Comprehensive test - clicks EVERY button and checks EVERY section
"""

import time
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.firefox import GeckoDriverManager
from _hta_url import hta_oman_index_url, hta_oman_index_path

class FullAppTester:
    def __init__(self):
        self.driver = None
        self.results = []
        self.section_results = {}

    def setup(self):
        print("Setting up Firefox...")
        service = Service(GeckoDriverManager().install())
        self.driver = webdriver.Firefox(service=service)
        self.driver.set_window_size(1920, 1080)
        return True

    def log(self, test, passed, detail=""):
        status = "PASS" if passed else "FAIL"
        safe_test = test.encode('ascii', 'ignore').decode('ascii')
        safe_detail = detail.encode('ascii', 'ignore').decode('ascii') if detail else ""
        msg = f"[{status}] {safe_test}"
        if safe_detail:
            msg += f" - {safe_detail}"
        print(msg)
        self.results.append((test, passed, detail))

    def click_element(self, element):
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.2)
            element.click()
            return True
        except:
            try:
                self.driver.execute_script("arguments[0].click();", element)
                return True
            except:
                return False

    def navigate_to(self, section_name):
        """Navigate to a section by data-section attribute"""
        try:
            nav = self.driver.find_element(By.CSS_SELECTOR, f'[data-section="{section_name}"]')
            self.click_element(nav)
            time.sleep(0.5)
            return True
        except:
            return False

    def check_section_content(self, section_id):
        """Check if a section has visible content"""
        try:
            section = self.driver.find_element(By.ID, f"section-{section_id}")
            if section.value_of_css_property("display") == "none":
                return False, "Section hidden"

            # Check for visible content
            cards = section.find_elements(By.CLASS_NAME, "card")
            tables = section.find_elements(By.TAG_NAME, "table")
            canvases = section.find_elements(By.TAG_NAME, "canvas")
            buttons = section.find_elements(By.TAG_NAME, "button")
            inputs = section.find_elements(By.TAG_NAME, "input")

            content = f"cards:{len(cards)} tables:{len(tables)} charts:{len(canvases)} btns:{len(buttons)} inputs:{len(inputs)}"
            has_content = len(cards) > 0 or len(tables) > 0 or len(canvases) > 0 or len(inputs) > 0
            return has_content, content
        except Exception as e:
            return False, str(e)[:30]

    def click_run_button(self, button_id, wait_time=5):
        """Click a run button and wait for results"""
        try:
            btn = self.driver.find_element(By.ID, button_id)
            if btn.is_displayed() and btn.is_enabled():
                self.click_element(btn)
                time.sleep(wait_time)
                return True
        except:
            pass
        return False

    def check_chart_rendered(self, canvas_id):
        """Check if a canvas has rendered content"""
        try:
            canvas = self.driver.find_element(By.ID, canvas_id)
            if not canvas.is_displayed():
                return False, "not visible"

            has_content = self.driver.execute_script("""
                var canvas = arguments[0];
                try {
                    var ctx = canvas.getContext('2d');
                    var data = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100)).data;
                    for (var i = 0; i < data.length; i += 4) {
                        if (data[i+3] > 0) return true;
                    }
                } catch(e) {}
                return false;
            """, canvas)
            return has_content, "rendered" if has_content else "empty"
        except Exception as e:
            return False, str(e)[:20]

    def check_value_element(self, elem_id):
        """Check if an element has a non-empty value"""
        try:
            elem = self.driver.find_element(By.ID, elem_id)
            text = elem.text.strip()
            has_value = text and text != "-" and text != "0" and text != ""
            return has_value, text[:25] if text else "empty"
        except:
            return False, "not found"

    def test_all_sections(self):
        """Test every navigation section"""
        print("\n" + "="*60)
        print("TESTING ALL NAVIGATION SECTIONS")
        print("="*60)

        # All sections from the sidebar
        all_sections = [
            # Core
            ("summary", "Summary"),
            ("validation", "Validation"),
            ("oman-guidance", "Oman HTA Guidance"),
            ("oman-health-data", "Oman Health Data"),
            ("evidence-stories", "Learning Stories"),
            # Model Definition
            ("parameters", "Parameters"),
            ("states", "States"),
            ("transitions", "Transitions"),
            # Analysis
            ("deterministic", "Base Case"),
            ("budget-impact", "Budget Impact"),
            ("psa", "PSA Results"),
            ("charts", "Visualizations"),
            # Advanced
            ("microsim", "Microsimulation"),
            ("des", "DES"),
            ("survival", "Survival Fitting"),
            ("calibration", "Calibration"),
            ("evppi", "EVPPI"),
            # Evidence Synthesis
            ("nma", "Network MA"),
            ("meta-methods", "Meta-Analysis"),
            ("pub-bias", "Publication Bias"),
            ("reporting", "CHEERS/GRADE"),
            # Advanced Methods
            ("three-level", "3-Level MA"),
            ("dta-ma", "DTA Meta-Analysis"),
            ("dose-response", "Dose-Response"),
            ("living-review", "Living Review"),
            ("survival-ma", "Survival MA"),
            ("mr-methods", "MR Methods"),
            ("threshold", "Threshold Analysis"),
            ("federated", "Federated Analysis"),
        ]

        for section_id, section_name in all_sections:
            if self.navigate_to(section_id):
                has_content, detail = self.check_section_content(section_id)
                self.log(f"Section: {section_name}", has_content, detail)
                self.section_results[section_id] = has_content
            else:
                self.log(f"Section: {section_name}", False, "nav failed")
                self.section_results[section_id] = False

    def test_all_run_buttons(self):
        """Test all Run/Calculate buttons"""
        print("\n" + "="*60)
        print("TESTING ALL RUN BUTTONS")
        print("="*60)

        run_buttons = [
            # Core analyses
            ("btn-run", "deterministic", "Run Model", 3),
            ("btn-run-psa", "psa", "Run PSA", 15),
            ("btn-run-dsa", "charts", "Run DSA", 10),
            ("btn-run-bia", "budget-impact", "Calculate BIA", 2),
            # Advanced
            ("btn-run-microsim", "microsim", "Run Microsim", 5),
            ("btn-run-des", "des", "Run DES", 5),
            ("btn-run-calibration", "calibration", "Run Calibration", 5),
            ("btn-run-evppi", "evppi", "Run EVPPI", 5),
            # Evidence synthesis
            ("btn-run-nma", "nma", "Run NMA", 3),
            ("btn-run-ma", "meta-methods", "Run Meta-Analysis", 3),
            ("btn-run-pub-bias", "pub-bias", "Run Pub Bias", 3),
            # Advanced methods
            ("btn-run-3level", "three-level", "Run 3-Level", 3),
            ("btn-run-dta", "dta-ma", "Run DTA", 3),
            ("btn-run-dr", "dose-response", "Run Dose-Response", 3),
            ("btn-run-living", "living-review", "Run Living Review", 3),
            ("btn-run-survival-ma", "survival-ma", "Run Survival MA", 3),
            ("btn-run-mr", "mr-methods", "Run MR", 3),
            ("btn-run-threshold", "threshold", "Run Threshold", 3),
        ]

        for btn_id, section, name, wait in run_buttons:
            # Navigate to section first
            self.navigate_to(section)
            time.sleep(0.5)

            # Try to click the run button
            clicked = self.click_run_button(btn_id, wait)
            self.log(f"Button: {name}", clicked, f"in {section}")

    def test_all_charts(self):
        """Test all chart canvases"""
        print("\n" + "="*60)
        print("TESTING ALL CHARTS")
        print("="*60)

        charts = [
            # Core charts
            ("trace-chart", "deterministic", "Trace Chart"),
            ("ce-plane-chart", "psa", "CE Plane"),
            ("ceac-chart", "psa", "CEAC"),
            ("tornado-chart", "charts", "Tornado"),
            ("survival-chart", "charts", "Survival Curves"),
            # Microsim
            ("microsim-state-chart", "microsim", "Microsim State"),
            ("microsim-trace-chart", "microsim", "Microsim Trace"),
            # DES
            # Survival fitting
            ("km-chart", "survival", "KM Chart"),
            ("survival-comparison-chart", "survival", "Survival Comparison"),
            # EVPPI
            ("evppi-chart", "evppi", "EVPPI Chart"),
            # NMA
            ("nma-network-chart", "nma", "NMA Network"),
            ("nma-ranking-chart", "nma", "NMA Ranking"),
            ("nma-forest-chart", "nma", "NMA Forest"),
            ("nma-funnel-chart", "nma", "NMA Funnel"),
            # Meta-analysis
            ("ma-forest-chart", "meta-methods", "MA Forest"),
            ("ma-cumulative-chart", "meta-methods", "MA Cumulative"),
            # Pub bias
            ("pub-bias-funnel-chart", "pub-bias", "Funnel Plot"),
            ("trim-fill-chart", "pub-bias", "Trim Fill"),
            # Dose response
            ("dr-curve-chart", "dose-response", "DR Curve"),
            # Living review
            ("living-boundaries-chart", "living-review", "Living Boundaries"),
            # DTA
            ("dta-sroc-chart", "dta-ma", "DTA SROC"),
            # MR
            ("mr-scatter-chart", "mr-methods", "MR Scatter"),
            # Survival MA
            ("survival-curves-chart", "survival-ma", "Survival MA Curves"),
        ]

        for chart_id, section, name in charts:
            self.navigate_to(section)
            time.sleep(0.3)
            rendered, detail = self.check_chart_rendered(chart_id)
            self.log(f"Chart: {name}", rendered, detail)

    def test_all_result_values(self):
        """Test all result value elements"""
        print("\n" + "="*60)
        print("TESTING ALL RESULT VALUES")
        print("="*60)

        values = [
            # Summary
            ("param-count", "summary", "Parameter Count"),
            ("state-count", "summary", "State Count"),
            ("time-horizon", "summary", "Time Horizon"),
            ("model-name", "summary", "Model Name"),
            # Base case
            ("result-icer", "deterministic", "ICER"),
            ("result-costs-int", "deterministic", "Costs Int"),
            ("result-costs-comp", "deterministic", "Costs Comp"),
            ("result-qalys-int", "deterministic", "QALYs Int"),
            ("result-qalys-comp", "deterministic", "QALYs Comp"),
            # PSA
            ("psa-mean-cost", "psa", "PSA Mean Cost"),
            ("psa-mean-qaly", "psa", "PSA Mean QALY"),
            ("psa-mean-icer", "psa", "PSA Mean ICER"),
            ("psa-prob-ce", "psa", "PSA Prob CE"),
            # Budget impact
            ("bia-total-impact", "budget-impact", "BIA Total"),
            ("bia-year1-impact", "budget-impact", "BIA Year 1"),
            # Microsim
            ("microsim-mean-cost", "microsim", "Microsim Cost"),
            ("microsim-mean-qaly", "microsim", "Microsim QALY"),
        ]

        for elem_id, section, name in values:
            self.navigate_to(section)
            time.sleep(0.3)
            has_value, detail = self.check_value_element(elem_id)
            self.log(f"Value: {name}", has_value, detail)

    def test_learning_stories(self):
        """Test all learning stories"""
        print("\n" + "="*60)
        print("TESTING LEARNING STORIES")
        print("="*60)

        self.navigate_to("evidence-stories")
        time.sleep(0.5)

        stories = [
            "what_is_hta", "understanding_icer", "understanding_uncertainty",
            "understanding_evpi", "understanding_discounting"
        ]

        for story_id in stories:
            try:
                # Close any open modal
                self.driver.execute_script("""
                    var modal = document.getElementById('story-modal');
                    if (modal) modal.style.display = 'none';
                """)
                time.sleep(0.2)

                # Click story button
                self.driver.execute_script(f"""
                    var card = document.querySelector('[data-story="{story_id}"]');
                    if (card) card.querySelector('button').click();
                """)
                time.sleep(0.5)

                # Check modal content
                content_len = self.driver.execute_script("""
                    var content = document.getElementById('story-modal-content');
                    return content ? content.textContent.length : 0;
                """)
                self.log(f"Story: {story_id}", content_len > 100, f"{content_len} chars")
            except Exception as e:
                self.log(f"Story: {story_id}", False, str(e)[:30])

        # Close modal
        self.driver.execute_script("""
            var modal = document.getElementById('story-modal');
            if (modal) modal.style.display = 'none';
        """)

    def test_reversal_cases(self):
        """Test evidence reversal cases"""
        print("\n" + "="*60)
        print("TESTING EVIDENCE REVERSAL CASES")
        print("="*60)

        self.navigate_to("evidence-stories")
        time.sleep(0.5)

        cases = ["stents_stable_angina", "knee_arthroscopy", "hormone_replacement",
                 "tight_glucose_icu", "antiarrhythmic_drugs"]

        for case_id in cases:
            try:
                self.driver.execute_script("""
                    var modal = document.getElementById('story-modal');
                    if (modal) modal.style.display = 'none';
                """)
                time.sleep(0.2)

                # Scroll to and click case
                self.driver.execute_script(f"""
                    var card = document.querySelector('[data-case="{case_id}"]');
                    if (card) {{
                        card.scrollIntoView({{block: 'center'}});
                        card.querySelector('button').click();
                    }}
                """)
                time.sleep(0.5)

                modal_visible = self.driver.execute_script("""
                    var modal = document.getElementById('story-modal');
                    return modal && modal.style.display !== 'none';
                """)
                self.log(f"Reversal: {case_id}", modal_visible)
            except Exception as e:
                self.log(f"Reversal: {case_id}", False, str(e)[:30])

    def test_data_tables(self):
        """Test all data tables have rows"""
        print("\n" + "="*60)
        print("TESTING DATA TABLES")
        print("="*60)

        tables = [
            ("params-table-body", "parameters", "Parameters Table"),
            ("states-table-body", "states", "States Table"),
            ("transitions-table-body", "transitions", "Transitions Table"),
            ("bia-results-body", "budget-impact", "BIA Results"),
            ("dsa-results-table", "charts", "DSA Results"),
        ]

        for table_id, section, name in tables:
            self.navigate_to(section)
            time.sleep(0.3)
            try:
                tbody = self.driver.find_element(By.ID, table_id)
                rows = tbody.find_elements(By.TAG_NAME, "tr")
                has_rows = len(rows) > 0
                self.log(f"Table: {name}", has_rows, f"{len(rows)} rows")
            except:
                self.log(f"Table: {name}", False, "not found")

    def run_full_test(self):
        """Run complete test suite"""
        print("\n" + "="*70)
        print("HTA-OMAN FULL APPLICATION TEST")
        print("="*70)

        if not self.setup():
            print("FATAL: Setup failed")
            return

        try:
            # Load page and demo
            self.driver.get(hta_oman_index_url())
            time.sleep(2)

            # Load demo data
            demo_btn = self.driver.find_element(By.ID, "btn-demo")
            self.click_element(demo_btn)
            time.sleep(3)
            self.log("Load Demo Data", True)

            # Run base model
            run_btn = self.driver.find_element(By.ID, "btn-run")
            self.click_element(run_btn)
            time.sleep(3)
            self.log("Run Base Model", True)

            # Run all tests
            self.test_all_sections()
            self.test_all_result_values()
            self.test_data_tables()
            self.test_all_run_buttons()
            self.test_all_charts()
            self.test_learning_stories()
            self.test_reversal_cases()

        finally:
            # Summary
            print("\n" + "="*70)
            print("FINAL TEST SUMMARY")
            print("="*70)

            passed = sum(1 for _, p, _ in self.results if p)
            failed = sum(1 for _, p, _ in self.results if not p)
            total = len(self.results)

            print(f"\nTotal Tests: {total}")
            print(f"Passed: {passed} ({100*passed//total if total > 0 else 0}%)")
            print(f"Failed: {failed}")

            if failed > 0:
                print(f"\n--- FAILURES ({failed}) ---")
                for name, p, detail in self.results:
                    if not p:
                        safe_name = name.encode('ascii', 'ignore').decode('ascii')
                        safe_detail = detail.encode('ascii', 'ignore').decode('ascii') if detail else ""
                        print(f"  - {safe_name}: {safe_detail}")

            print("\n" + "="*70)
            time.sleep(2)
            self.driver.quit()
            print("Browser closed.")


if __name__ == "__main__":
    tester = FullAppTester()
    tester.run_full_test()
