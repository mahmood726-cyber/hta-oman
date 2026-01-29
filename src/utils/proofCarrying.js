// Proof-carrying outputs for deterministic HTA results (rules-based).
(function initProofCarrying(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.ProofCarrying = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function createProofCarrying() {
    const DEFAULT_TOLERANCE = 1e-6;

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function nearlyEqual(a, b, tolerance = DEFAULT_TOLERANCE) {
        if (!isFiniteNumber(a) || !isFiniteNumber(b)) return false;
        return Math.abs(a - b) <= tolerance;
    }

    function addCheck(report, check) {
        report.checks.push(check);
        if (check.status === 'pass') {
            report.summary.passed += 1;
        } else if (check.status === 'fail') {
            report.summary.failed += 1;
            report.issues.push({
                severity: 'error',
                message: check.message,
                details: check
            });
        } else if (check.status === 'warn') {
            report.summary.warnings += 1;
            report.issues.push({
                severity: 'warning',
                message: check.message,
                details: check
            });
        }
    }

    function checkIncremental(report, comparison, compResults, stratResults) {
        const incCostsExpected = stratResults.total_costs - compResults.total_costs;
        const incQalysExpected = stratResults.total_qalys - compResults.total_qalys;

        addCheck(report, {
            id: `inc_costs_${comparison.strategy}`,
            label: 'Incremental costs',
            expected: incCostsExpected,
            actual: comparison.incremental_costs,
            status: nearlyEqual(incCostsExpected, comparison.incremental_costs)
                ? 'pass'
                : 'fail',
            message: 'Incremental costs should equal intervention minus comparator.'
        });

        addCheck(report, {
            id: `inc_qalys_${comparison.strategy}`,
            label: 'Incremental QALYs',
            expected: incQalysExpected,
            actual: comparison.incremental_qalys,
            status: nearlyEqual(incQalysExpected, comparison.incremental_qalys)
                ? 'pass'
                : 'fail',
            message: 'Incremental QALYs should equal intervention minus comparator.'
        });

        if (isFiniteNumber(incQalysExpected) && Math.abs(incQalysExpected) > 0) {
            const expectedIcer = incCostsExpected / incQalysExpected;
            const actualIcer = comparison.icer;
            const status = isFiniteNumber(actualIcer)
                ? (nearlyEqual(expectedIcer, actualIcer, 1e-4) ? 'pass' : 'fail')
                : 'warn';
            addCheck(report, {
                id: `icer_${comparison.strategy}`,
                label: 'ICER consistency',
                expected: expectedIcer,
                actual: actualIcer,
                status,
                message: 'ICER should equal incremental costs divided by incremental QALYs.'
            });
        }

        if (isFiniteNumber(comparison.wtp_used)) {
            const expectedNmb = incQalysExpected * comparison.wtp_used - incCostsExpected;
            const actualNmb = isFiniteNumber(comparison.nmb_primary) ? comparison.nmb_primary : comparison.nmb_30k;
            const status = isFiniteNumber(actualNmb)
                ? (nearlyEqual(expectedNmb, actualNmb, 1e-4) ? 'pass' : 'fail')
                : 'warn';
            addCheck(report, {
                id: `nmb_${comparison.strategy}`,
                label: 'NMB consistency',
                expected: expectedNmb,
                actual: actualNmb,
                status,
                message: 'NMB should equal incremental QALYs * WTP minus incremental costs.'
            });
        }
    }

    function checkTrace(report, strategyId, trace) {
        if (!trace || !trace.states) {
            return;
        }
        const stateIds = Object.keys(trace.states);
        if (!stateIds.length) return;

        const cycles = trace.cycles || [];
        let maxDeviation = 0;
        let outOfBounds = 0;

        for (let i = 0; i < cycles.length; i += 1) {
            let sum = 0;
            for (const stateId of stateIds) {
                const value = trace.states[stateId][i];
                if (!isFiniteNumber(value)) continue;
                if (value < -DEFAULT_TOLERANCE || value > 1 + DEFAULT_TOLERANCE) {
                    outOfBounds += 1;
                }
                sum += value;
            }
            maxDeviation = Math.max(maxDeviation, Math.abs(sum - 1));
        }

        addCheck(report, {
            id: `trace_mass_${strategyId}`,
            label: 'Trace mass balance',
            expected: 1,
            actual: 1 - maxDeviation,
            status: maxDeviation <= 1e-4 ? 'pass' : 'fail',
            message: `State occupancy should sum to 1 across cycles (max deviation ${maxDeviation.toExponential(2)}).`
        });

        if (outOfBounds > 0) {
            addCheck(report, {
                id: `trace_bounds_${strategyId}`,
                label: 'Trace bounds',
                expected: 0,
                actual: outOfBounds,
                status: 'fail',
                message: `${outOfBounds} state occupancy values fall outside [0,1].`
            });
        }
    }

    function checkNonNegative(report, label, value, id) {
        if (!isFiniteNumber(value)) return;
        addCheck(report, {
            id,
            label,
            expected: '>= 0',
            actual: value,
            status: value >= -DEFAULT_TOLERANCE ? 'pass' : 'warn',
            message: `${label} should not be negative in the base case.`
        });
    }

    function verifyDeterministicResults(results, project, settings) {
        const report = {
            verified: true,
            summary: {
                passed: 0,
                failed: 0,
                warnings: 0
            },
            checks: [],
            issues: [],
            timestamp: new Date().toISOString()
        };

        if (!results || !results.strategies) {
            report.verified = false;
            report.summary.failed += 1;
            report.issues.push({
                severity: 'error',
                message: 'No deterministic results available for proof checks.'
            });
            return report;
        }

        const strategies = results.strategies;
        for (const [strategyId, stratResults] of Object.entries(strategies)) {
            checkNonNegative(report, 'Total costs', stratResults.total_costs, `costs_${strategyId}`);
            checkNonNegative(report, 'Total QALYs', stratResults.total_qalys, `qalys_${strategyId}`);
            checkTrace(report, strategyId, stratResults.trace);
        }

        const comparisons = results.incremental?.comparisons || [];
        const comparatorId = results.incremental?.comparator;
        if (comparisons.length && comparatorId && strategies[comparatorId]) {
            const compResults = strategies[comparatorId];
            for (const comparison of comparisons) {
                const stratResults = strategies[comparison.strategy];
                if (!stratResults) continue;
                checkIncremental(report, comparison, compResults, stratResults);
            }
        } else {
            addCheck(report, {
                id: 'incremental_missing',
                label: 'Incremental analysis',
                expected: 'Available',
                actual: 'Missing',
                status: 'warn',
                message: 'Incremental results not found. Define a comparator to enable incremental checks.'
            });
        }

        report.verified = report.summary.failed === 0;
        return report;
    }

    return {
        verifyDeterministicResults
    };
});
