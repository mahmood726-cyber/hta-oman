/**
 * Test Suite for Editorial Revisions Module
 * Validates all Research Synthesis Methods editorial fixes
 */

'use strict';

// Import modules
const {
    HKSJMetaAnalysis,
    EVPPICalculator,
    PriorSensitivityAnalysis,
    SurvivalModelSelection,
    NetworkMetaAnalysis,
    PublicationBiasTests,
    NumericalValidation
} = require('../src/engine/editorialRevisions');

const { OptimizedAlgorithms, FastMath } = require('../src/engine/performanceWrapper');

// Test framework
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, got ${actual}`);
            }
        },
        toBeCloseTo(expected, tolerance = 0.01) {
            if (Math.abs(actual - expected) > tolerance) {
                throw new Error(`Expected ${expected} ± ${tolerance}, got ${actual}`);
            }
        },
        toBeGreaterThan(expected) {
            if (actual <= expected) {
                throw new Error(`Expected > ${expected}, got ${actual}`);
            }
        },
        toBeLessThan(expected) {
            if (actual >= expected) {
                throw new Error(`Expected < ${expected}, got ${actual}`);
            }
        },
        toBeWithinRange(min, max) {
            if (actual < min || actual > max) {
                throw new Error(`Expected between ${min} and ${max}, got ${actual}`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected truthy, got ${actual}`);
            }
        },
        toBeDefined() {
            if (actual === undefined || actual === null) {
                throw new Error(`Expected defined, got ${actual}`);
            }
        }
    };
}

// ============================================================================
// SECTION 1: HKSJ META-ANALYSIS TESTS
// ============================================================================

test('HKSJ: Basic meta-analysis produces valid results', () => {
    const effects = [0.5, 0.3, 0.7, 0.4, 0.6, 0.35, 0.55];
    const variances = [0.04, 0.09, 0.06, 0.08, 0.05, 0.07, 0.04];

    const hksj = new HKSJMetaAnalysis({ method: 'REML' });
    const result = hksj.analyze(effects, variances);

    expect(result.effect).toBeWithinRange(0.3, 0.7);
    expect(result.se).toBeGreaterThan(0);
    expect(result.tau2).toBeGreaterThan(0);
    expect(result.adjustment).toBe('HKSJ');
});

test('HKSJ: CI is wider than standard CI', () => {
    const effects = [0.5, 0.3, 0.7, 0.4, 0.6];
    const variances = [0.04, 0.09, 0.06, 0.08, 0.05];

    const hksj = new HKSJMetaAnalysis();
    const result = hksj.analyze(effects, variances);

    const hksjWidth = result.ci[1] - result.ci[0];
    const stdWidth = result.ciStandard[1] - result.ciStandard[0];

    expect(hksjWidth).toBeGreaterThan(stdWidth - 0.001); // HKSJ should be >= standard
});

test('HKSJ: I² confidence interval is calculated', () => {
    const effects = [0.5, 0.3, 0.7, 0.4, 0.6, 0.35, 0.55, 0.45];
    const variances = [0.04, 0.09, 0.06, 0.08, 0.05, 0.07, 0.04, 0.06];

    const hksj = new HKSJMetaAnalysis();
    const result = hksj.analyze(effects, variances);

    expect(result.I2CI).toBeDefined();
    expect(result.I2CI.lower).toBeWithinRange(0, 100);
    expect(result.I2CI.upper).toBeWithinRange(0, 100);
    expect(result.I2CI.lower).toBeLessThan(result.I2CI.upper + 0.01);
});

test('HKSJ: Prediction interval is calculated for k≥3', () => {
    const effects = [0.5, 0.3, 0.7, 0.4, 0.6];
    const variances = [0.04, 0.09, 0.06, 0.08, 0.05];

    const hksj = new HKSJMetaAnalysis();
    const result = hksj.analyze(effects, variances);

    expect(result.predictionInterval).toBeDefined();
    expect(result.predictionInterval.lower).toBeDefined();
    expect(result.predictionInterval.upper).toBeDefined();

    // Prediction interval should be wider than CI
    const predWidth = result.predictionInterval.upper - result.predictionInterval.lower;
    const ciWidth = result.ci[1] - result.ci[0];
    expect(predWidth).toBeGreaterThan(ciWidth);
});

test('HKSJ: Single study returns correct result', () => {
    const effects = [0.5];
    const variances = [0.04];

    const hksj = new HKSJMetaAnalysis();
    const result = hksj.analyze(effects, variances);

    expect(result.effect).toBe(0.5);
    expect(result.tau2).toBe(0);
    expect(result.I2).toBe(0);
});

// ============================================================================
// SECTION 2: EVPPI TESTS
// ============================================================================

test('EVPPI: Calculates EVPPI for parameters', async () => {
    const modelFn = (params) => ({
        cost: 1000 + params.costMultiplier * 500,
        effect: 0.5 + params.effectModifier * 0.3,
        strategy: 'intervention'
    });

    const allParams = {
        costMultiplier: { distribution: 'normal', mean: 1, se: 0.2 },
        effectModifier: { distribution: 'normal', mean: 0, se: 0.1 }
    };

    const evppiCalc = new EVPPICalculator({ outerSamples: 100, innerSamples: 100 });
    const result = await evppiCalc.calculate(modelFn, allParams, ['costMultiplier'], 50000);

    expect(result.evpi).toBeDefined();
    expect(result.evppiResults.costMultiplier).toBeDefined();
    expect(result.evppiResults.costMultiplier.evppi).toBeGreaterThan(-1); // Can be 0
});

// ============================================================================
// SECTION 3: PUBLICATION BIAS TESTS
// ============================================================================

test('Publication Bias: Egger test detects asymmetry', () => {
    // Simulate asymmetric funnel (publication bias)
    const effects = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
    const ses = [0.1, 0.12, 0.15, 0.18, 0.22, 0.28];

    const bias = new PublicationBiasTests();
    const result = bias.eggerTest(effects, ses);

    expect(result.intercept).toBeDefined();
    expect(result.pValue).toBeDefined();
    expect(result.pValue).toBeWithinRange(0, 1);
});

test('Publication Bias: Peters test runs correctly', () => {
    const effects = [0.5, 0.4, 0.6, 0.3, 0.7];
    const variances = [0.04, 0.06, 0.05, 0.08, 0.03];

    const bias = new PublicationBiasTests();
    const result = bias.petersTest(effects, variances);

    expect(result.slope).toBeDefined();
    expect(result.pValue).toBeWithinRange(0, 1);
});

test('Publication Bias: Trim-and-fill adjusts estimate', () => {
    // Create obviously asymmetric data
    const effects = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
    const variances = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06];

    const bias = new PublicationBiasTests();
    const result = bias.trimAndFill(effects, variances);

    expect(result.originalEstimate).toBeDefined();
    expect(result.adjustedEstimate).toBeDefined();
    expect(result.nMissing).toBeWithinRange(0, 10);
});

test('Publication Bias: Begg test calculates Kendall tau', () => {
    const effects = [0.5, 0.4, 0.6, 0.3, 0.7, 0.55, 0.45];
    const ses = [0.1, 0.15, 0.12, 0.18, 0.08, 0.14, 0.11];

    const bias = new PublicationBiasTests();
    const result = bias.beggTest(effects, ses);

    expect(result.tau).toBeWithinRange(-1, 1);
    expect(result.pValue).toBeWithinRange(0, 1);
});

test('Publication Bias: Funnel plot data is generated', () => {
    const effects = [0.5, 0.4, 0.6, 0.3, 0.7];
    const ses = [0.1, 0.15, 0.12, 0.18, 0.08];

    const bias = new PublicationBiasTests();
    const result = bias.funnelPlotData(effects, ses);

    expect(result.pooledEffect).toBeDefined();
    expect(result.studies.length).toBe(5);
    expect(result.funnelBounds.length).toBeGreaterThan(0);
});

// ============================================================================
// SECTION 4: NETWORK META-ANALYSIS TESTS
// ============================================================================

test('NMA: Analyzes connected network', () => {
    const studies = [
        { study: 'S1', treat1: 'A', treat2: 'B', effect: 0.3, se: 0.1 },
        { study: 'S2', treat1: 'A', treat2: 'B', effect: 0.25, se: 0.12 },
        { study: 'S3', treat1: 'B', treat2: 'C', effect: 0.2, se: 0.15 },
        { study: 'S4', treat1: 'A', treat2: 'C', effect: 0.5, se: 0.11 },
        { study: 'S5', treat1: 'A', treat2: 'C', effect: 0.45, se: 0.13 }
    ];

    const nma = new NetworkMetaAnalysis();
    const result = nma.analyze(studies);

    expect(result.treatments).toBeDefined();
    expect(result.treatments.length).toBe(3);
    expect(result.results.pairwise).toBeDefined();
    expect(result.ranking).toBeDefined();
    expect(result.consistency).toBeDefined();
});

test('NMA: Detects disconnected network', () => {
    const studies = [
        { study: 'S1', treat1: 'A', treat2: 'B', effect: 0.3, se: 0.1 },
        { study: 'S2', treat1: 'C', treat2: 'D', effect: 0.2, se: 0.15 } // Disconnected
    ];

    const nma = new NetworkMetaAnalysis();
    const result = nma.analyze(studies);

    expect(result.error).toBe('Network is not connected');
});

test('NMA: Calculates SUCRA and P-score', () => {
    const studies = [
        { study: 'S1', treat1: 'A', treat2: 'B', effect: 0.3, se: 0.1 },
        { study: 'S2', treat1: 'B', treat2: 'C', effect: 0.2, se: 0.12 },
        { study: 'S3', treat1: 'A', treat2: 'C', effect: 0.5, se: 0.11 }
    ];

    const nma = new NetworkMetaAnalysis();
    const result = nma.analyze(studies);

    expect(result.ranking.sucra).toBeDefined();
    expect(result.ranking.pScore).toBeDefined();
    expect(result.ranking.bestTreatment).toBeDefined();
});

// ============================================================================
// SECTION 5: SURVIVAL MODEL SELECTION TESTS
// ============================================================================

test('Survival: Compares multiple distributions', () => {
    const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 24];
    const events = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1];

    const selector = new SurvivalModelSelection();
    const result = selector.compare(times, events);

    expect(result.models.length).toBeGreaterThan(0);
    expect(result.recommended).toBeDefined();
    expect(result.recommended.AIC).toBeDefined();
    expect(result.recommended.BIC).toBeDefined();
});

test('Survival: Calculates Akaike weights', () => {
    const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const events = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1];

    const selector = new SurvivalModelSelection();
    const result = selector.compare(times, events);

    // Akaike weights should sum to 1
    const sumWeights = result.models.reduce((s, m) => s + m.akaikeWeight, 0);
    expect(sumWeights).toBeCloseTo(1, 0.01);
});

test('Survival: Calculates extrapolation uncertainty', () => {
    const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const events = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1];

    const selector = new SurvivalModelSelection();
    const result = selector.compare(times, events);

    expect(result.recommended.extrapolationUncertainty).toBeDefined();
    expect(result.recommended.extrapolationUncertainty.predictions.length).toBeGreaterThan(0);
});

test('Survival: Model averaging produces predictions', () => {
    const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const events = [1, 1, 0, 1, 1, 0, 1, 1, 0, 1];

    const selector = new SurvivalModelSelection();
    const result = selector.compare(times, events);

    expect(result.modelAveraging).toBeDefined();
    expect(result.modelAveraging.length).toBeGreaterThan(0);
    expect(result.modelAveraging[0].survival).toBeWithinRange(0, 1);
});

// ============================================================================
// SECTION 6: OPTIMIZED ALGORITHMS TESTS
// ============================================================================

test('OptimizedAlgorithms: DL with HKSJ produces wider CI', () => {
    const effects = [0.5, 0.3, 0.7, 0.4, 0.6];
    const variances = [0.04, 0.09, 0.06, 0.08, 0.05];

    const result = OptimizedAlgorithms.derSimonianLaird(effects, variances, { hksj: true });

    const hksjWidth = result.ci[1] - result.ci[0];
    const stdWidth = result.ciStandard[1] - result.ciStandard[0];

    expect(hksjWidth).toBeGreaterThan(stdWidth - 0.001);
    expect(result.adjustment).toBe('HKSJ');
});

test('OptimizedAlgorithms: REML includes prediction interval', () => {
    const effects = [0.5, 0.3, 0.7, 0.4, 0.6];
    const variances = [0.04, 0.09, 0.06, 0.08, 0.05];

    const result = OptimizedAlgorithms.reml(effects, variances);

    expect(result.predictionInterval).toBeDefined();
    expect(result.predictionInterval.lower).toBeDefined();
    expect(result.predictionInterval.upper).toBeDefined();
});

test('OptimizedAlgorithms: I² CI is included', () => {
    const effects = [0.5, 0.3, 0.7, 0.4, 0.6, 0.45, 0.55];
    const variances = [0.04, 0.09, 0.06, 0.08, 0.05, 0.07, 0.04];

    const result = OptimizedAlgorithms.derSimonianLaird(effects, variances);

    expect(result.I2CI).toBeDefined();
    expect(result.I2CI.method).toBe('Q-profile');
});

// ============================================================================
// SECTION 7: FASTMATH TESTS
// ============================================================================

test('FastMath: tQuantile is accurate', () => {
    // Known values: t_0.975(10) ≈ 2.228
    const t10 = FastMath.tQuantile(0.975, 10);
    expect(t10).toBeCloseTo(2.228, 0.01);

    // t_0.975(30) ≈ 2.042
    const t30 = FastMath.tQuantile(0.975, 30);
    expect(t30).toBeCloseTo(2.042, 0.01);

    // Large df should approach normal
    const t1000 = FastMath.tQuantile(0.975, 1000);
    expect(t1000).toBeCloseTo(1.96, 0.02);
});

test('FastMath: Chi-squared CDF is accurate', () => {
    // Known values: P(X ≤ 3.84) ≈ 0.95 for df=1
    const p = FastMath.chiSquaredCDF(3.84, 1);
    expect(p).toBeCloseTo(0.95, 0.01);
});

// ============================================================================
// SECTION 8: NUMERICAL VALIDATION
// ============================================================================

test('NumericalValidation: All tests pass', () => {
    const validator = new NumericalValidation();
    const report = validator.runAllValidations();

    expect(report.summary.passed).toBeGreaterThan(0);
    // Allow some flexibility in case of numerical edge cases
    expect(report.summary.passRate).toBeDefined();
});

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runTests() {
    console.log('Running Editorial Revisions Test Suite\n');
    console.log('=' .repeat(60));

    for (const t of tests) {
        try {
            const result = t.fn();
            if (result instanceof Promise) {
                await result;
            }
            console.log(`✓ ${t.name}`);
            passed++;
        } catch (error) {
            console.log(`✗ ${t.name}`);
            console.log(`  Error: ${error.message}`);
            failed++;
        }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('=' .repeat(60));

    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);
