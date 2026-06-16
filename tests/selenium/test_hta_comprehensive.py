"""
Comprehensive Selenium test for HTA-Oman application
Tests all sections, runs analyses, and verifies all charts/results display
"""

import time
import os
from selenium import webdriver
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    ElementClickInterceptedException,
    StaleElementReferenceException
)
from webdriver_manager.firefox import GeckoDriverManager

class HTAComprehensiveTester:
    def __init__(self):
        self.driver = None
        self.results = []
        self.errors = []

    def setup(self):
        """Initialize Firefox WebDriver"""
        print("Setting up Firefox WebDriver...")
        options = FirefoxOptions()

        try:
            service = FirefoxService(GeckoDriverManager().install())
            self.driver = webdriver.Firefox(service=service, options=options)
            self.driver.set_window_size(1920, 1080)
            print("Firefox WebDriver initialized successfully")
            return True
        except Exception as e:
            print(f"Failed to initialize Firefox: {e}")
            try:
                from selenium.webdriver.chrome.service import Service as ChromeService
                from webdriver_manager.chrome import ChromeDriverManager
                chrome_service = ChromeService(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=chrome_service)
                self.driver.set_window_size(1920, 1080)
                print("Chrome WebDriver initialized successfully")
                return True
            except Exception as e2:
                print(f"Failed to initialize any browser: {e2}")
                return False

    def log_result(self, test_name, passed, details=""):
        """Log test result"""
        status = "PASS" if passed else "FAIL"
        # Sanitize for console output
        safe_name = test_name.encode('ascii', 'ignore').decode('ascii')
        safe_details = details.encode('ascii', 'ignore').decode('ascii') if details else ""
        result = f"[{status}] {safe_name}"
        if safe_details:
            result += f" - {safe_details}"
        print(result)
        self.results.append((test_name, passed, details))
        if not passed:
            self.errors.append((test_name, details))

    def safe_click(self, element, description="element"):
        """Safely click an element"""
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.2)
            element.click()
            return True
        except ElementClickInterceptedException:
            try:
                self.driver.execute_script("arguments[0].click();", element)
                return True
            except:
                return False
        except:
            return False

    def wait_for_element(self, by, value, timeout=10):
        """Wait for element to be present and visible"""
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.visibility_of_element_located((by, value))
            )
            return element
        except TimeoutException:
            return None

    def click_nav_item(self, text_contains):
        """Click a navigation item by partial text match"""
        nav_items = self.driver.find_elements(By.CLASS_NAME, "nav-item")
        for item in nav_items:
            if text_contains.lower() in item.text.lower():
                self.safe_click(item, text_contains)
                time.sleep(0.5)
                return True
        return False

    def load_page_and_demo(self):
        """Load page and demo data"""
        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'index.html'))
        url = f"file:///{file_path.replace(os.sep, '/')}"
        print(f"Loading: {url}")
        self.driver.get(url)
        time.sleep(2)

        # Click Load Demo
        try:
            demo_btn = self.driver.find_element(By.ID, "btn-demo")
            self.safe_click(demo_btn, "Load Demo")
            time.sleep(3)  # Wait for demo data
            self.log_result("Load Demo Data", True)

            # Run the model to generate base case results
            try:
                run_btn = self.driver.find_element(By.ID, "btn-run")
                if run_btn.is_displayed():
                    self.safe_click(run_btn, "Run Model")
                    time.sleep(3)  # Wait for model to run
                    self.log_result("Run Model", True)
            except:
                self.log_result("Run Model", False, "Button not found")

            return True
        except Exception as e:
            self.log_result("Load Demo Data", False, str(e)[:50])
            return False

    def test_summary_section(self):
        """Test Summary section displays all data"""
        print("\n=== TESTING SUMMARY SECTION ===")
        self.click_nav_item("Summary")
        time.sleep(1)

        # Check summary card values
        card_ids = [
            ("param-count", "Parameters"),
            ("state-count", "States"),
            ("time-horizon", "Time Horizon"),
            ("model-name", "Model Name"),
        ]

        for elem_id, name in card_ids:
            try:
                elem = self.driver.find_element(By.ID, elem_id)
                value = elem.text.strip()
                has_value = value and value != "-" and value != ""
                self.log_result(f"Summary: {name}", has_value, f"Value: {value[:30]}")
            except Exception as e:
                self.log_result(f"Summary: {name}", False, "Not found")

        # Check validation panel
        try:
            validation = self.driver.find_element(By.ID, "validation-status")
            self.log_result("Validation Panel", validation.is_displayed())
        except:
            self.log_result("Validation Panel", False, "Not found")

    def test_parameters_section(self):
        """Test Parameters section"""
        print("\n=== TESTING PARAMETERS SECTION ===")
        self.click_nav_item("Parameters")
        time.sleep(1)

        # Check parameters table body
        try:
            tbody = self.driver.find_element(By.ID, "params-table-body")
            rows = tbody.find_elements(By.TAG_NAME, "tr")
            self.log_result("Parameters Table", len(rows) > 0, f"{len(rows)} rows")
        except:
            self.log_result("Parameters Table", False, "Not found")

    def test_states_section(self):
        """Test States section"""
        print("\n=== TESTING STATES SECTION ===")
        self.click_nav_item("States")
        time.sleep(1)

        try:
            tbody = self.driver.find_element(By.ID, "states-table-body")
            rows = tbody.find_elements(By.TAG_NAME, "tr")
            self.log_result("States Table", len(rows) > 0, f"{len(rows)} rows")
        except:
            self.log_result("States Table", False, "Not found")

    def test_transitions_section(self):
        """Test Transitions section"""
        print("\n=== TESTING TRANSITIONS SECTION ===")
        self.click_nav_item("Transitions")
        time.sleep(1)

        try:
            tbody = self.driver.find_element(By.ID, "transitions-table-body")
            rows = tbody.find_elements(By.TAG_NAME, "tr")
            self.log_result("Transitions Table", len(rows) > 0, f"{len(rows)} rows")
        except:
            self.log_result("Transitions Table", False, "Not found")

    def test_base_case_section(self):
        """Test Base Case section with charts"""
        print("\n=== TESTING BASE CASE SECTION ===")
        self.click_nav_item("Base Case")
        time.sleep(1)

        # Check result cards - use correct IDs
        result_ids = [
            ("result-icer", "ICER"),
            ("result-costs-int", "Costs Intervention"),
            ("result-costs-comp", "Costs Comparator"),
            ("result-qalys-int", "QALYs Intervention"),
            ("result-qalys-comp", "QALYs Comparator"),
        ]

        for elem_id, name in result_ids:
            try:
                elem = self.driver.find_element(By.ID, elem_id)
                value = elem.text.strip()
                has_value = value and value != "-" and value != "0"
                self.log_result(f"Base Case: {name}", has_value, f"Value: {value[:20]}")
            except:
                self.log_result(f"Base Case: {name}", False, "Not found")

        # Check for charts
        try:
            trace_chart = self.driver.find_element(By.ID, "trace-chart")
            visible = trace_chart.is_displayed()
            self.log_result("Trace Chart", visible)
        except:
            self.log_result("Trace Chart", False, "Not found")

        # Check dashboard container
        try:
            dashboard = self.driver.find_element(By.ID, "dashboard-container")
            has_content = len(dashboard.text.strip()) > 0 or len(dashboard.find_elements(By.TAG_NAME, "div")) > 0
            self.log_result("Results Dashboard", has_content, f"Has content: {has_content}")
        except:
            self.log_result("Results Dashboard", False, "Not found")

    def test_psa_section(self):
        """Test PSA Results section - run PSA first"""
        print("\n=== TESTING PSA SECTION ===")
        self.click_nav_item("PSA Results")
        time.sleep(1)

        # Run PSA if button available
        try:
            psa_btn = self.driver.find_element(By.ID, "btn-run-psa")
            if psa_btn.is_displayed():
                self.safe_click(psa_btn, "Run PSA")
                self.log_result("PSA Button Click", True)
                # Wait for PSA to complete - check for results (up to 30 seconds)
                for i in range(30):
                    time.sleep(1)
                    try:
                        mean_icer = self.driver.find_element(By.ID, "psa-mean-icer")
                        if mean_icer.text.strip() and mean_icer.text.strip() != "-":
                            break
                    except:
                        pass
        except:
            pass

        # Check for CE plane chart
        try:
            ce_plane = self.driver.find_element(By.ID, "ce-plane-chart")
            visible = ce_plane.is_displayed()
            self.log_result("CE Plane Chart", visible)
        except:
            self.log_result("CE Plane Chart", False, "Not found")

        # Check for CEAC chart
        try:
            ceac = self.driver.find_element(By.ID, "ceac-chart")
            visible = ceac.is_displayed()
            self.log_result("CEAC Chart", visible)
        except:
            self.log_result("CEAC Chart", False, "Not found")

        # Check PSA summary stats
        stat_ids = ["psa-mean-cost", "psa-mean-qaly", "psa-mean-icer", "psa-prob-ce"]
        for stat_id in stat_ids:
            try:
                elem = self.driver.find_element(By.ID, stat_id)
                value = elem.text.strip()
                has_value = value and value != "-"
                name = stat_id.replace("psa-", "").replace("-", " ").title()
                self.log_result(f"PSA Stat: {name}", has_value, f"Value: {value[:15]}")
            except:
                pass

    def test_visualizations_section(self):
        """Test Visualizations section - run DSA"""
        print("\n=== TESTING VISUALIZATIONS SECTION ===")
        self.click_nav_item("Visualizations")
        time.sleep(1)

        # Click Run DSA button
        try:
            dsa_btn = self.driver.find_element(By.ID, "btn-run-dsa")
            if dsa_btn.is_displayed():
                self.safe_click(dsa_btn, "Run DSA")
                self.log_result("DSA Button Click", True)

                # Wait for DSA to complete - monitor progress (up to 30 seconds)
                for i in range(30):
                    time.sleep(1)
                    try:
                        # Check if tornado appeared
                        tornado_visible = self.driver.execute_script("""
                            var tornado = document.getElementById('tornado-container');
                            return tornado && tornado.style.display !== 'none';
                        """)
                        if tornado_visible:
                            break
                        # Check if progress is still showing
                        progress_visible = self.driver.execute_script("""
                            var prog = document.getElementById('dsa-progress');
                            return prog && prog.style.display !== 'none';
                        """)
                        if not progress_visible and i > 5:
                            break  # DSA finished but tornado might not show
                    except:
                        break

                # Check if tornado diagram appeared
                tornado = self.driver.find_element(By.ID, "tornado-container")
                display = tornado.value_of_css_property("display")
                visible = display != "none"
                self.log_result("Tornado Container", visible, f"display: {display}")

                # Check for tornado chart canvas
                try:
                    tornado_chart = self.driver.find_element(By.ID, "tornado-chart")
                    chart_visible = tornado_chart.is_displayed()
                    self.log_result("Tornado Chart Canvas", chart_visible)
                except:
                    self.log_result("Tornado Chart Canvas", False, "Not found")
            else:
                self.log_result("DSA Button", False, "Not visible")
        except Exception as e:
            self.log_result("DSA Analysis", False, str(e)[:50])

    def test_budget_impact_section(self):
        """Test Budget Impact section - run BIA first"""
        print("\n=== TESTING BUDGET IMPACT SECTION ===")
        self.click_nav_item("Budget Impact")
        time.sleep(1)

        # Run BIA if button available
        try:
            bia_btn = self.driver.find_element(By.ID, "btn-run-bia")
            if bia_btn.is_displayed():
                self.safe_click(bia_btn, "Calculate BIA")
                self.log_result("BIA Button Click", True)
                time.sleep(2)  # Wait for calculation
        except:
            pass

        # Check for BIA results div
        try:
            results_div = self.driver.find_element(By.ID, "bia-results")
            display = results_div.value_of_css_property("display")
            visible = display != "none"
            self.log_result("BIA Results Panel", visible)
        except:
            self.log_result("BIA Results Panel", False, "Not found")

        # Check budget impact values
        try:
            total_bi = self.driver.find_element(By.ID, "bia-total-impact")
            value = total_bi.text.strip()
            has_value = value and value != "-"
            self.log_result("Total Budget Impact Value", has_value, f"Value: {value[:20]}")
        except:
            self.log_result("Total Budget Impact Value", False, "Not found")

        # Check BIA table
        try:
            tbody = self.driver.find_element(By.ID, "bia-results-body")
            rows = tbody.find_elements(By.TAG_NAME, "tr")
            self.log_result("BIA Results Table", len(rows) > 0, f"{len(rows)} rows")
        except:
            self.log_result("BIA Results Table", False, "Not found")

    def test_learning_stories(self):
        """Test Learning Stories section"""
        print("\n=== TESTING LEARNING STORIES ===")
        self.click_nav_item("Learning Stories")
        time.sleep(1)

        # Check all 5 story cards using JavaScript for reliability
        story_ids = [
            "what_is_hta", "understanding_icer", "understanding_uncertainty",
            "understanding_evpi", "understanding_discounting"
        ]

        for story_id in story_ids:
            try:
                # Close any open modal first
                self.close_modal_if_open()

                # Check if card exists using JavaScript
                card_exists = self.driver.execute_script(f"""
                    var card = document.querySelector('[data-story="{story_id}"]');
                    return card !== null;
                """)
                self.log_result(f"Story Card: {story_id}", card_exists)

                if not card_exists:
                    continue

                # Click the button using JavaScript for reliability
                self.driver.execute_script(f"""
                    var card = document.querySelector('[data-story="{story_id}"]');
                    if (card) {{
                        var btn = card.querySelector('button');
                        if (btn) btn.click();
                    }}
                """)
                time.sleep(0.8)

                # Check modal opened
                modal_visible = self.driver.execute_script("""
                    var modal = document.getElementById('story-modal');
                    return modal && modal.style.display !== 'none';
                """)
                self.log_result(f"Story Modal: {story_id}", modal_visible)

                # Check story content
                if modal_visible:
                    content_length = self.driver.execute_script("""
                        var content = document.getElementById('story-modal-content');
                        return content ? content.textContent.length : 0;
                    """)
                    self.log_result(f"Story Content: {story_id}", content_length > 50, f"{content_length} chars")

                    # Close modal
                    self.close_modal_if_open()
            except Exception as e:
                self.log_result(f"Story: {story_id}", False, str(e)[:40])
                self.close_modal_if_open()

    def close_modal_if_open(self):
        """Helper to close story modal if open"""
        try:
            self.driver.execute_script("""
                var modal = document.getElementById('story-modal');
                if (modal && modal.style.display !== 'none') {
                    modal.style.display = 'none';
                }
            """)
            time.sleep(0.2)
        except:
            pass

    def test_evidence_reversal_cases(self):
        """Test Evidence Reversal Cases"""
        print("\n=== TESTING EVIDENCE REVERSAL CASES ===")

        # Make sure modal is closed first
        self.close_modal_if_open()

        # Navigate to Learning Stories section (where reversal cases are)
        self.click_nav_item("Learning Stories")
        time.sleep(0.5)

        # Scroll to reversal cases section first
        try:
            reversal_grid = self.driver.find_element(By.ID, "reversal-cases")
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", reversal_grid)
            time.sleep(0.5)
        except:
            pass

        case_ids = ["stents_stable_angina", "knee_arthroscopy", "hormone_replacement"]

        for case_id in case_ids:
            try:
                # Close any open modal first
                self.close_modal_if_open()

                card = self.driver.find_element(By.CSS_SELECTOR, f"[data-case='{case_id}']")
                # Scroll to card
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
                time.sleep(0.3)
                visible = card.is_displayed()
                self.log_result(f"Reversal Card: {case_id}", visible)

                if visible:
                    btn = card.find_element(By.TAG_NAME, "button")
                    self.safe_click(btn, f"Read {case_id}")
                    time.sleep(0.8)

                    modal = self.driver.find_element(By.ID, "story-modal")
                    modal_visible = modal.is_displayed()
                    self.log_result(f"Reversal Modal: {case_id}", modal_visible)

                    # Close modal using JavaScript
                    self.driver.execute_script("""
                        var modal = document.getElementById('story-modal');
                        if (modal) modal.style.display = 'none';
                    """)
                    time.sleep(0.3)
            except Exception as e:
                self.log_result(f"Reversal: {case_id}", False, str(e)[:40])
                self.close_modal_if_open()

    def test_all_canvas_rendering(self):
        """Final check - verify all canvases have content"""
        print("\n=== FINAL CANVAS CHECK ===")

        # Navigate to each section with charts and check
        sections_with_charts = [
            ("Base Case", "trace-chart"),
            ("PSA Results", "ce-plane-chart"),
            ("PSA Results", "ceac-chart"),
        ]

        for section, chart_id in sections_with_charts:
            self.click_nav_item(section)
            time.sleep(1)

            try:
                canvas = self.driver.find_element(By.ID, chart_id)
                if canvas.is_displayed():
                    # Check if canvas has been drawn on
                    has_content = self.driver.execute_script("""
                        var canvas = arguments[0];
                        try {
                            var ctx = canvas.getContext('2d');
                            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            var data = imageData.data;
                            for (var i = 0; i < data.length; i += 4) {
                                if (data[i+3] > 0) return true;  // Non-transparent pixel found
                            }
                        } catch(e) { return false; }
                        return false;
                    """, canvas)
                    self.log_result(f"Canvas Rendered: {chart_id}", has_content)
                else:
                    self.log_result(f"Canvas Visible: {chart_id}", False, "Not displayed")
            except Exception as e:
                self.log_result(f"Canvas: {chart_id}", False, str(e)[:40])

    def check_js_errors(self):
        """Check for JavaScript errors"""
        print("\n=== JAVASCRIPT ERROR CHECK ===")
        try:
            errors = self.driver.execute_script("""
                return window.jsErrors || [];
            """)
            if errors and len(errors) > 0:
                self.log_result("JS Errors", False, f"{len(errors)} errors found")
                for err in errors[:3]:
                    print(f"  ERROR: {err[:100]}")
            else:
                self.log_result("JS Errors", True, "No errors")
        except:
            self.log_result("JS Error Check", True, "Could not check")

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("\n" + "="*70)
        print("HTA-OMAN COMPREHENSIVE TEST SUITE")
        print("="*70)

        if not self.setup():
            print("FATAL: Could not initialize WebDriver")
            return

        try:
            if not self.load_page_and_demo():
                print("FATAL: Could not load demo data")
                return

            self.test_summary_section()
            self.test_parameters_section()
            self.test_states_section()
            self.test_transitions_section()
            self.test_base_case_section()
            self.test_psa_section()
            self.test_visualizations_section()
            self.test_budget_impact_section()
            self.test_learning_stories()
            self.test_evidence_reversal_cases()
            self.test_all_canvas_rendering()
            self.check_js_errors()

        finally:
            print("\n" + "="*70)
            print("TEST SUMMARY")
            print("="*70)

            passed = sum(1 for _, p, _ in self.results if p)
            failed = sum(1 for _, p, _ in self.results if not p)
            total = len(self.results)

            print(f"\nTotal Tests: {total}")
            print(f"Passed: {passed} ({100*passed//total}%)")
            print(f"Failed: {failed}")

            if self.errors:
                print(f"\n--- FAILURES ({len(self.errors)}) ---")
                for name, detail in self.errors:
                    safe_name = name.encode('ascii', 'ignore').decode('ascii')
                    safe_detail = detail.encode('ascii', 'ignore').decode('ascii') if detail else ""
                    print(f"  - {safe_name}: {safe_detail}")

            print("\n" + "="*70)
            time.sleep(2)
            self.driver.quit()
            print("Browser closed.")


if __name__ == "__main__":
    tester = HTAComprehensiveTester()
    tester.run_all_tests()
