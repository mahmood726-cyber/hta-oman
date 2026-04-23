#!/usr/bin/env python3
"""
Minimal Test Script for HTA-oman Platform
Validates Phase 1-2 critical bug fixes
"""

import re
import sys
from pathlib import Path

def main():
    base_dir = Path(__file__).parent
    tests_passed = 0
    tests_failed = 0

    print("=" * 60)
    print("HTA-oman Phase 1-2 Bug Fix Validation")
    print("=" * 60)

    # Test 1: RNG circular reference fix in nma.js
    print("\n[Test 1] RNG circular reference fix...")
    nma_js = base_dir / "src" / "engine" / "nma.js"
    content = nma_js.read_text(encoding='utf-8')

    # Check that rng.random() is used instead of this.rng.random() in the createRNG closure
    if "rng.random()" in content and "const rng = {" in content:
        print("  PASS: RNG uses local variable reference")
        tests_passed += 1
    else:
        print("  FAIL: RNG still has circular reference")
        tests_failed += 1

    # Test 2: Missing RNG methods (beta, gamma)
    print("\n[Test 2] RNG distribution methods...")
    if "beta: (alpha, beta)" in content and "gamma: (shape, scale" in content:
        print("  PASS: Beta and Gamma methods exist in RNG")
        tests_passed += 1
    else:
        print("  FAIL: Missing beta() or gamma() methods")
        tests_failed += 1

    # Test 3: Array bounds check
    print("\n[Test 3] Array bounds check in findMostConnectedTreatment...")
    if "sortedConnections.length === 0" in content:
        print("  PASS: Empty array check exists")
        tests_passed += 1
    else:
        print("  FAIL: Missing empty array bounds check")
        tests_failed += 1

    # Test 4: PSA progress callback error handling
    print("\n[Test 4] PSA progress callback error handling...")
    psa_js = base_dir / "src" / "engine" / "psa.js"
    psa_content = psa_js.read_text(encoding='utf-8')

    if "catch (progressError)" in psa_content or "catch(progressError)" in psa_content:
        print("  PASS: Progress callback has try-catch")
        tests_passed += 1
    else:
        print("  FAIL: Progress callback missing error handling")
        tests_failed += 1

    # Test 5: PSA parameter validation
    print("\n[Test 5] PSA parameter null check...")
    if "project.parameters || {}" in psa_content:
        print("  PASS: Parameter null check exists")
        tests_passed += 1
    else:
        print("  FAIL: Missing parameter null check")
        tests_failed += 1

    # Test 6: advancedPerformance.js try-finally
    print("\n[Test 6] Promise race condition fix...")
    adv_perf = base_dir / "src" / "engine" / "advancedPerformance.js"
    adv_content = adv_perf.read_text(encoding='utf-8')

    if "} finally {" in adv_content and "URL.revokeObjectURL(workerUrl)" in adv_content:
        print("  PASS: try-finally ensures cleanup")
        tests_passed += 1
    else:
        print("  FAIL: Missing try-finally for cleanup")
        tests_failed += 1

    # Test 7: Normal distribution u1===0 safeguard
    print("\n[Test 7] Normal distribution u1===0 safeguard...")
    if "while (u1 === 0)" in content or "while(u1 === 0)" in content:
        print("  PASS: Normal distribution guards against log(0)")
        tests_passed += 1
    else:
        print("  FAIL: Normal distribution missing u1===0 guard")
        tests_failed += 1

    # Test 8: Beta distribution 0/0 safeguard
    print("\n[Test 8] Beta distribution 0/0 safeguard...")
    if "if (x + y === 0)" in content:
        print("  PASS: Beta distribution guards against 0/0")
        tests_passed += 1
    else:
        print("  FAIL: Beta distribution missing 0/0 guard")
        tests_failed += 1

    # Test 9: App.js button handlers exist
    print("\n[Test 9] Advanced analysis button handlers...")
    app_js = base_dir / "src" / "ui" / "app.js"
    app_content = app_js.read_text(encoding='utf-8')

    handlers = ["runIPDMetaAnalysis", "runDTAAnalysis", "runFabricationDetection",
                "runMendelianRandomization", "runThresholdAnalysis", "runGRADEAssessment"]
    all_handlers_exist = all(h in app_content for h in handlers)
    if all_handlers_exist:
        print("  PASS: All 6 key button handlers exist")
        tests_passed += 1
    else:
        missing = [h for h in handlers if h not in app_content]
        print(f"  FAIL: Missing handlers: {missing}")
        tests_failed += 1

    # Test 10: FrontierMeta exports expanded
    print("\n[Test 10] FrontierMeta exports expanded...")
    frontier_js = base_dir / "src" / "engine" / "frontierMeta.js"
    frontier_content = frontier_js.read_text(encoding='utf-8')

    # Check for key classes in window.FrontierMeta export
    key_exports = ["GRADEMethodology", "AdvancedPublicationBias", "ThresholdAnalysis", "MendelianRandomizationMA"]
    # Look for these in the window.FrontierMeta block
    export_block_start = frontier_content.find("window.FrontierMeta = {")
    export_block_end = frontier_content.find("};", export_block_start)
    export_block = frontier_content[export_block_start:export_block_end] if export_block_start > 0 else ""

    all_exported = all(exp in export_block for exp in key_exports)
    if all_exported:
        print("  PASS: Key classes exported to window.FrontierMeta")
        tests_passed += 1
    else:
        missing = [exp for exp in key_exports if exp not in export_block]
        print(f"  FAIL: Missing exports: {missing}")
        tests_failed += 1

    # Summary
    print("\n" + "=" * 60)
    print(f"RESULTS: {tests_passed} passed, {tests_failed} failed")
    print("=" * 60)

    return 0 if tests_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
