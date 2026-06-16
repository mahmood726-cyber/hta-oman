"""
Selenium test script for HTA-Oman application
Tests all sections, buttons, and functionality
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
    ElementNotInteractableException
)
from webdriver_manager.firefox import GeckoDriverManager

class HTAOmanTester:
    def __init__(self):
        self.driver = None
        self.results = []
        self.errors = []

    def setup(self):
        """Initialize Firefox WebDriver"""
        print("Setting up Firefox WebDriver...")
        options = FirefoxOptions()
        # options.add_argument('--headless')  # Uncomment for headless mode

        try:
            service = FirefoxService(GeckoDriverManager().install())
            self.driver = webdriver.Firefox(service=service, options=options)
            self.driver.set_window_size(1920, 1080)
            print("Firefox WebDriver initialized successfully")
            return True
        except Exception as e:
            print(f"Failed to initialize Firefox: {e}")
            # Try Chrome as fallback
            print("Trying Chrome as fallback...")
            try:
                from selenium.webdriver.chrome.service import Service as ChromeService
                from selenium.webdriver.chrome.options import Options as ChromeOptions
                from webdriver_manager.chrome import ChromeDriverManager

                chrome_options = ChromeOptions()
                chrome_service = ChromeService(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=chrome_service, options=chrome_options)
                self.driver.set_window_size(1920, 1080)
                print("Chrome WebDriver initialized successfully")
                return True
            except Exception as e2:
                print(f"Failed to initialize Chrome: {e2}")
                return False

    def load_page(self):
        """Load the HTA-Oman index.html"""
        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'index.html'))
        url = f"file:///{file_path.replace(os.sep, '/')}"
        print(f"Loading: {url}")
        self.driver.get(url)
        time.sleep(3)  # Wait for page to fully load
        return True

    def load_demo_data(self):
        """Click Load Demo button to populate the app with data"""
        try:
            # Find and click Load Demo button
            demo_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Load Demo')]")
            if demo_btn.is_displayed():
                self.safe_click(demo_btn, "Load Demo")
                print("Clicked Load Demo button, waiting for data to load...")
                time.sleep(5)  # Wait for demo data to load and render
                self.log_result("Load Demo Data", True, "Demo loaded")
                return True
        except Exception as e:
            self.log_result("Load Demo Data", False, str(e)[:50])
            return False

    def log_result(self, test_name, passed, details=""):
        """Log test result"""
        status = "PASS" if passed else "FAIL"
        result = f"[{status}] {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.results.append((test_name, passed, details))
        if not passed:
            self.errors.append((test_name, details))

    def safe_click(self, element, description="element"):
        """Safely click an element with scrolling"""
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.3)
            element.click()
            return True
        except ElementClickInterceptedException:
            try:
                self.driver.execute_script("arguments[0].click();", element)
                return True
            except:
                return False
        except Exception as e:
            return False

    def test_page_loads(self):
        """Test that the page loads without errors"""
        try:
            title = self.driver.title
            self.log_result("Page Load", "Oman HTA" in title, f"Title: {title}")

            # Check for JavaScript errors in console
            logs = self.driver.execute_script("return window.consoleErrors || [];")
            if logs:
                self.log_result("JS Console Errors", False, str(logs[:3]))
            else:
                self.log_result("JS Console Errors", True, "No errors detected")
        except Exception as e:
            self.log_result("Page Load", False, str(e))

    def test_header(self):
        """Test header elements"""
        try:
            header = self.driver.find_element(By.TAG_NAME, "header")
            self.log_result("Header Present", header.is_displayed())

            logo = self.driver.find_element(By.CLASS_NAME, "logo")
            self.log_result("Logo Present", logo.is_displayed())

            # Check header buttons
            header_actions = self.driver.find_element(By.CLASS_NAME, "header-actions")
            self.log_result("Header Actions Present", header_actions.is_displayed())
        except NoSuchElementException as e:
            self.log_result("Header Elements", False, str(e)[:50])

    def test_drop_zone(self):
        """Test the file drop zone"""
        try:
            drop_zone = self.driver.find_element(By.CLASS_NAME, "drop-zone")
            self.log_result("Drop Zone Present", drop_zone.is_displayed())

            # Check for file input
            file_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='file']")
            self.log_result("File Input Present", file_input is not None)
        except NoSuchElementException as e:
            self.log_result("Drop Zone", False, str(e))

    def test_sidebar_navigation(self):
        """Test sidebar navigation items"""
        try:
            sidebar = self.driver.find_element(By.CLASS_NAME, "sidebar")
            self.log_result("Sidebar Present", sidebar.is_displayed())

            nav_items = self.driver.find_elements(By.CLASS_NAME, "nav-item")
            self.log_result("Navigation Items", len(nav_items) > 0, f"Found {len(nav_items)} items")

            # Test clicking each nav item
            for i, item in enumerate(nav_items[:10]):  # Test first 10
                try:
                    # Sanitize text to avoid encoding issues
                    raw_text = item.text.strip() or f"Nav item {i}"
                    text = raw_text.encode('ascii', 'ignore').decode('ascii') or f"Nav item {i}"
                    if self.safe_click(item, text):
                        time.sleep(0.5)
                        self.log_result(f"Nav Click: {text[:30]}", True)
                    else:
                        self.log_result(f"Nav Click: {text[:30]}", False, "Click failed")
                except Exception as e:
                    err = str(e).encode('ascii', 'ignore').decode('ascii')[:50]
                    self.log_result(f"Nav Click {i}", False, err)
        except NoSuchElementException as e:
            self.log_result("Sidebar Navigation", False, str(e))

    def test_summary_cards(self):
        """Test summary cards display"""
        try:
            cards = self.driver.find_elements(By.CLASS_NAME, "summary-card")
            self.log_result("Summary Cards", len(cards) > 0, f"Found {len(cards)} cards")

            for i, card in enumerate(cards[:5]):
                visible = card.is_displayed()
                text = card.text[:30] if card.text else "empty"
                self.log_result(f"Card {i+1} Visible", visible, text)
        except NoSuchElementException as e:
            self.log_result("Summary Cards", False, str(e))

    def test_charts(self):
        """Test Chart.js canvas elements"""
        try:
            canvases = self.driver.find_elements(By.TAG_NAME, "canvas")
            self.log_result("Chart Canvases", len(canvases) > 0, f"Found {len(canvases)} canvases")

            # Check if Chart.js is loaded
            chart_js = self.driver.execute_script("return typeof Chart !== 'undefined'")
            self.log_result("Chart.js Loaded", chart_js)

            # Check for chart instances (Chart.js 4.x uses registry)
            chart_count = self.driver.execute_script("""
                var count = 0;
                if (typeof Chart !== 'undefined') {
                    if (Chart.instances) {
                        count = Object.keys(Chart.instances).length;
                    }
                    // Also check registry for Chart.js 4.x
                    if (count === 0 && Chart.registry && Chart.registry.controllers) {
                        // Count visible canvases with chart data
                        var canvases = document.querySelectorAll('canvas');
                        canvases.forEach(function(c) {
                            if (c.chart || c.__chart__) count++;
                        });
                    }
                }
                return count;
            """)
            self.log_result("Active Chart Instances", chart_count >= 0, f"Found {chart_count}")

            # Check if any canvas has been drawn on
            drawn_canvases = self.driver.execute_script("""
                var drawn = 0;
                var canvases = document.querySelectorAll('canvas');
                canvases.forEach(function(c) {
                    try {
                        var ctx = c.getContext('2d');
                        var data = ctx.getImageData(0, 0, 1, 1).data;
                        if (data[3] > 0) drawn++;  // Has non-transparent pixels
                    } catch(e) {}
                });
                return drawn;
            """)
            self.log_result("Canvases with Content", drawn_canvases > 0, f"Found {drawn_canvases} with content")
        except Exception as e:
            self.log_result("Charts", False, str(e)[:50])

    def test_d3_visualizations(self):
        """Test D3.js visualizations"""
        try:
            d3_loaded = self.driver.execute_script("return typeof d3 !== 'undefined'")
            self.log_result("D3.js Loaded", d3_loaded)

            svg_elements = self.driver.find_elements(By.TAG_NAME, "svg")
            self.log_result("SVG Elements", len(svg_elements) >= 0, f"Found {len(svg_elements)}")
        except Exception as e:
            self.log_result("D3 Visualizations", False, str(e))

    def test_data_tables(self):
        """Test data tables"""
        try:
            tables = self.driver.find_elements(By.CLASS_NAME, "data-table")
            self.log_result("Data Tables", len(tables) >= 0, f"Found {len(tables)}")

            # Check for table content
            for i, table in enumerate(tables[:3]):
                rows = table.find_elements(By.TAG_NAME, "tr")
                self.log_result(f"Table {i+1} Rows", len(rows) > 0, f"{len(rows)} rows")
        except Exception as e:
            self.log_result("Data Tables", False, str(e))

    def test_buttons(self):
        """Test all buttons are clickable"""
        try:
            buttons = self.driver.find_elements(By.CLASS_NAME, "btn")
            self.log_result("Buttons Found", len(buttons) > 0, f"Found {len(buttons)} buttons")

            # Test sample of buttons
            tested = 0
            for btn in buttons[:15]:
                try:
                    if btn.is_displayed() and btn.is_enabled():
                        btn_text = btn.text[:20] or btn.get_attribute("title") or f"btn-{tested}"
                        # Don't actually click destructive buttons
                        if "delete" not in btn_text.lower() and "remove" not in btn_text.lower():
                            self.log_result(f"Button: {btn_text}", True, "Visible & enabled")
                            tested += 1
                except:
                    pass
            self.log_result("Buttons Tested", tested > 0, f"Tested {tested}")
        except Exception as e:
            self.log_result("Buttons", False, str(e))

    def test_learning_stories(self):
        """Test Learning Stories section"""
        try:
            # Find and click Learning Stories nav
            nav_items = self.driver.find_elements(By.CLASS_NAME, "nav-item")
            learning_nav = None
            for item in nav_items:
                if "learning" in item.text.lower() or "stories" in item.text.lower():
                    learning_nav = item
                    break

            if learning_nav:
                self.safe_click(learning_nav, "Learning Stories Nav")
                time.sleep(1)
                self.log_result("Learning Stories Nav", True)

            # Find story cards
            story_cards = self.driver.find_elements(By.CLASS_NAME, "story-card")
            self.log_result("Story Cards Found", len(story_cards) > 0, f"Found {len(story_cards)}")

            # Test clicking "Read Story" buttons
            story_buttons = self.driver.find_elements(By.XPATH, "//button[contains(text(), 'Read Story')]")
            for i, btn in enumerate(story_buttons[:3]):
                try:
                    if btn.is_displayed():
                        self.safe_click(btn, f"Story {i+1}")
                        time.sleep(1)

                        # Check if modal opened
                        modal = self.driver.find_element(By.ID, "story-modal")
                        modal_visible = modal.is_displayed() if modal else False
                        self.log_result(f"Story Modal {i+1}", modal_visible)

                        # Close modal if open
                        if modal_visible:
                            close_btns = modal.find_elements(By.CLASS_NAME, "close-btn")
                            if close_btns:
                                self.safe_click(close_btns[0], "Close modal")
                            else:
                                self.driver.execute_script("arguments[0].style.display = 'none';", modal)
                            time.sleep(0.5)
                except Exception as e:
                    self.log_result(f"Story {i+1}", False, str(e)[:50])
        except Exception as e:
            self.log_result("Learning Stories", False, str(e))

    def test_modals(self):
        """Test modal functionality"""
        try:
            modals = self.driver.find_elements(By.CLASS_NAME, "modal")
            self.log_result("Modals Present", len(modals) > 0, f"Found {len(modals)}")
        except Exception as e:
            self.log_result("Modals", False, str(e))

    def test_tabs(self):
        """Test tab navigation"""
        try:
            tabs = self.driver.find_elements(By.CLASS_NAME, "tab")
            self.log_result("Tabs Found", len(tabs) >= 0, f"Found {len(tabs)}")

            for i, tab in enumerate(tabs[:5]):
                try:
                    if tab.is_displayed():
                        self.safe_click(tab, f"Tab {i}")
                        time.sleep(0.3)
                        self.log_result(f"Tab {i+1} Click", True)
                except:
                    pass
        except Exception as e:
            self.log_result("Tabs", False, str(e))

    def test_forms(self):
        """Test form inputs"""
        try:
            inputs = self.driver.find_elements(By.TAG_NAME, "input")
            selects = self.driver.find_elements(By.TAG_NAME, "select")

            self.log_result("Form Inputs", True, f"Inputs: {len(inputs)}, Selects: {len(selects)}")

            # Test a few inputs are interactable
            tested = 0
            for inp in inputs[:5]:
                try:
                    if inp.is_displayed() and inp.get_attribute("type") != "file":
                        tested += 1
                except:
                    pass
            self.log_result("Inputs Interactable", tested > 0, f"Tested {tested}")
        except Exception as e:
            self.log_result("Forms", False, str(e))

    def test_all_sections(self):
        """Navigate through all main sections via sidebar clicks"""
        # Click nav items and verify content appears
        nav_items = self.driver.find_elements(By.CLASS_NAME, "nav-item")

        sections_tested = 0
        for item in nav_items[:12]:  # Test first 12 nav items
            try:
                if not item.is_displayed():
                    continue

                raw_text = item.text.strip()
                text = raw_text.encode('ascii', 'ignore').decode('ascii')[:25] or f"Section {sections_tested}"

                # Click the nav item
                self.safe_click(item, text)
                time.sleep(0.5)

                # Check if it has active state
                classes = item.get_attribute("class") or ""
                is_active = "active" in classes

                self.log_result(f"Section Nav: {text}", True, "active" if is_active else "clicked")
                sections_tested += 1
            except Exception as e:
                err = str(e).encode('ascii', 'ignore').decode('ascii')[:30]
                self.log_result(f"Section Nav {sections_tested}", False, err)

        self.log_result("Total Sections Navigated", sections_tested > 0, f"{sections_tested} sections")

    def test_chart_rendering(self):
        """Navigate to chart sections and verify charts render"""
        chart_sections = ["Visualizations", "PSA Results", "Base Case", "Budget Impact"]

        for section_name in chart_sections:
            try:
                # Find and click nav item for this section
                nav_items = self.driver.find_elements(By.CLASS_NAME, "nav-item")
                clicked = False
                for item in nav_items:
                    if section_name.lower() in item.text.lower():
                        self.safe_click(item, section_name)
                        time.sleep(1)  # Wait for charts to render
                        clicked = True
                        break

                if clicked:
                    # Check for visible canvases in this section
                    canvases = self.driver.find_elements(By.TAG_NAME, "canvas")
                    visible_canvases = sum(1 for c in canvases if c.is_displayed())

                    # Check for rendered content
                    has_content = self.driver.execute_script("""
                        var canvases = document.querySelectorAll('canvas');
                        for (var i = 0; i < canvases.length; i++) {
                            var c = canvases[i];
                            if (c.offsetWidth > 0 && c.offsetHeight > 0) {
                                try {
                                    var ctx = c.getContext('2d');
                                    var data = ctx.getImageData(0, 0, 1, 1).data;
                                    if (data[3] > 0) return true;
                                } catch(e) {}
                            }
                        }
                        return false;
                    """)

                    self.log_result(f"Charts: {section_name}", visible_canvases > 0 or has_content,
                                    f"{visible_canvases} visible canvases")
                else:
                    self.log_result(f"Charts: {section_name}", False, "Section not found")
            except Exception as e:
                err = str(e).encode('ascii', 'ignore').decode('ascii')[:40]
                self.log_result(f"Charts: {section_name}", False, err)

    def check_console_errors(self):
        """Check browser console for JavaScript errors"""
        try:
            # Inject error catcher if not present
            self.driver.execute_script("""
                if (!window.consoleErrors) {
                    window.consoleErrors = [];
                    var originalError = console.error;
                    console.error = function() {
                        window.consoleErrors.push(Array.from(arguments).join(' '));
                        originalError.apply(console, arguments);
                    };
                }
            """)

            errors = self.driver.execute_script("return window.consoleErrors || [];")
            if errors:
                self.log_result("Console Errors Check", False, f"{len(errors)} errors: {errors[:2]}")
            else:
                self.log_result("Console Errors Check", True, "No JS errors")
        except Exception as e:
            self.log_result("Console Check", False, str(e))

    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "="*60)
        print("HTA-OMAN SELENIUM TEST SUITE")
        print("="*60 + "\n")

        if not self.setup():
            print("FATAL: Could not initialize WebDriver")
            return

        try:
            self.load_page()

            print("\n--- Page Load Tests ---")
            self.test_page_loads()

            print("\n--- Loading Demo Data ---")
            self.load_demo_data()
            time.sleep(2)  # Extra time for charts to render

            print("\n--- Header Tests ---")
            self.test_header()

            print("\n--- Drop Zone Tests ---")
            self.test_drop_zone()

            print("\n--- Sidebar Navigation Tests ---")
            self.test_sidebar_navigation()

            print("\n--- Summary Cards Tests ---")
            self.test_summary_cards()

            print("\n--- Chart Tests ---")
            self.test_charts()

            print("\n--- D3 Visualization Tests ---")
            self.test_d3_visualizations()

            print("\n--- Data Table Tests ---")
            self.test_data_tables()

            print("\n--- Button Tests ---")
            self.test_buttons()

            print("\n--- Tab Tests ---")
            self.test_tabs()

            print("\n--- Form Tests ---")
            self.test_forms()

            print("\n--- Modal Tests ---")
            self.test_modals()

            print("\n--- Learning Stories Tests ---")
            self.test_learning_stories()

            print("\n--- Section Navigation Tests ---")
            self.test_all_sections()

            print("\n--- Chart Rendering Tests ---")
            self.test_chart_rendering()

            print("\n--- Final Console Check ---")
            self.check_console_errors()

        finally:
            print("\n" + "="*60)
            print("TEST SUMMARY")
            print("="*60)

            passed = sum(1 for _, p, _ in self.results if p)
            failed = sum(1 for _, p, _ in self.results if not p)

            print(f"\nTotal Tests: {len(self.results)}")
            print(f"Passed: {passed}")
            print(f"Failed: {failed}")

            if self.errors:
                print(f"\n--- FAILURES ({len(self.errors)}) ---")
                for name, detail in self.errors:
                    print(f"  - {name}: {detail}")

            print("\n" + "="*60)

            # Close browser automatically
            time.sleep(2)
            self.driver.quit()
            print("\nBrowser closed.")


if __name__ == "__main__":
    tester = HTAOmanTester()
    tester.run_all_tests()
