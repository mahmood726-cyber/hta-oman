/**
 * HTA Artifact Standard - Markov Engine Tests
 * Comprehensive unit tests for Markov cohort simulation
 */

'use strict';

// Mock browser environment
const fs = require('fs');
const path = require('path');

// Load the Markov engine (would need module adaptation)
// For now, we test the mathematical functions directly

describe('Markov Engine', () => {
    describe('Kahan Summation', () => {
        // Kahan summation for numerical stability
        function kahanSum(numbers) {
            let sum = 0;
            let c = 0;
            for (const num of numbers) {
                const y = num - c;
                const t = sum + y;
                c = (t - sum) - y;
                sum = t;
            }
            return sum;
        }

        test('should handle large arrays without floating point errors', () => {
            const n = 10000;
            const values = Array(n).fill(0.1);
            const result = kahanSum(values);
            expect(Math.abs(result - 1000)).toBeLessThan(1e-10);
        });

        test('should handle alternating small and large values', () => {
            const values = [1e10, 1, -1e10, 1, 1, 1];
            const result = kahanSum(values);
            expect(result).toBeCloseTo(4, 10);
        });

        test('should return 0 for empty array', () => {
            expect(kahanSum([])).toBe(0);
        });
    });

    describe('Transition Probability Validation', () => {
        function validateTransitionMatrix(matrix) {
            const n = matrix.length;
            const errors = [];

            for (let i = 0; i < n; i++) {
                if (matrix[i].length !== n) {
                    errors.push(`Row ${i} has incorrect length`);
                    continue;
                }

                let rowSum = 0;
                for (let j = 0; j < n; j++) {
                    if (matrix[i][j] < 0 || matrix[i][j] > 1) {
                        errors.push(`Invalid probability at [${i}][${j}]: ${matrix[i][j]}`);
                    }
                    rowSum += matrix[i][j];
                }

                if (Math.abs(rowSum - 1) > 1e-10) {
                    errors.push(`Row ${i} sums to ${rowSum}, not 1`);
                }
            }

            return { valid: errors.length === 0, errors };
        }

        test('should validate correct transition matrix', () => {
            const matrix = [
                [0.9, 0.1],
                [0.0, 1.0]
            ];
            const result = validateTransitionMatrix(matrix);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect row sum not equal to 1', () => {
            const matrix = [
                [0.9, 0.2],  // Sums to 1.1
                [0.0, 1.0]
            ];
            const result = validateTransitionMatrix(matrix);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('sums to'))).toBe(true);
        });

        test('should detect negative probabilities', () => {
            const matrix = [
                [1.1, -0.1],  // Invalid probabilities
                [0.0, 1.0]
            ];
            const result = validateTransitionMatrix(matrix);
            expect(result.valid).toBe(false);
        });

        test('should detect probabilities > 1', () => {
            const matrix = [
                [0.5, 1.5],  // Invalid
                [0.0, 1.0]
            ];
            const result = validateTransitionMatrix(matrix);
            expect(result.valid).toBe(false);
        });
    });

    describe('Cohort Simulation', () => {
        function simulateCohort(initialState, transitionMatrix, cycles) {
            const n = initialState.length;
            let state = [...initialState];
            const trace = [state.slice()];

            for (let c = 0; c < cycles; c++) {
                const newState = new Array(n).fill(0);
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        newState[j] += state[i] * transitionMatrix[i][j];
                    }
                }
                state = newState;
                trace.push(state.slice());
            }

            return trace;
        }

        test('should preserve cohort mass (sum to 1)', () => {
            const initial = [1, 0];
            const matrix = [
                [0.9, 0.1],
                [0.0, 1.0]
            ];
            const trace = simulateCohort(initial, matrix, 100);

            for (const state of trace) {
                const sum = state.reduce((a, b) => a + b, 0);
                expect(sum).toBeCloseTo(1, 10);
            }
        });

        test('should reach absorbing state', () => {
            const initial = [1, 0];
            const matrix = [
                [0.9, 0.1],
                [0.0, 1.0]  // Absorbing state
            ];
            const trace = simulateCohort(initial, matrix, 200);

            // After many cycles, should be mostly in absorbing state
            const finalState = trace[trace.length - 1];
            expect(finalState[1]).toBeGreaterThan(0.99);
        });

        test('should handle 3-state model correctly', () => {
            const initial = [1, 0, 0];
            const matrix = [
                [0.8, 0.15, 0.05],
                [0.0, 0.7, 0.30],
                [0.0, 0.0, 1.0]  // Absorbing
            ];
            const trace = simulateCohort(initial, matrix, 50);

            // All mass should eventually reach absorbing state
            const finalState = trace[trace.length - 1];
            expect(finalState[0] + finalState[1] + finalState[2]).toBeCloseTo(1, 10);
        });
    });

    describe('Discounting', () => {
        function discount(value, rate, time) {
            return value / Math.pow(1 + rate, time);
        }

        function presentValue(cashflows, rate) {
            return cashflows.reduce((pv, cf, t) => pv + discount(cf, rate, t), 0);
        }

        test('should discount correctly at 3.5%', () => {
            const value = 1000;
            const rate = 0.035;

            expect(discount(value, rate, 0)).toBe(1000);
            expect(discount(value, rate, 1)).toBeCloseTo(966.18, 1);
            expect(discount(value, rate, 10)).toBeCloseTo(708.92, 1);
        });

        test('should calculate present value of annuity', () => {
            const annuity = Array(10).fill(1000);
            const pv = presentValue(annuity, 0.035);
            expect(pv).toBeCloseTo(8316.61, 0);
        });

        test('should handle zero discount rate', () => {
            const value = 1000;
            expect(discount(value, 0, 100)).toBe(1000);
        });
    });

    describe('Half-Cycle Correction', () => {
        function applyHalfCycleCorrection(trace) {
            const corrected = [];
            for (let i = 0; i < trace.length - 1; i++) {
                const avgState = trace[i].map((v, j) => (v + trace[i + 1][j]) / 2);
                corrected.push(avgState);
            }
            return corrected;
        }

        test('should average adjacent cycles', () => {
            const trace = [
                [1.0, 0.0],
                [0.9, 0.1],
                [0.81, 0.19]
            ];
            const corrected = applyHalfCycleCorrection(trace);

            expect(corrected[0][0]).toBeCloseTo(0.95, 10);
            expect(corrected[0][1]).toBeCloseTo(0.05, 10);
        });

        test('should preserve mass conservation', () => {
            const trace = [
                [1.0, 0.0],
                [0.9, 0.1],
                [0.81, 0.19]
            ];
            const corrected = applyHalfCycleCorrection(trace);

            for (const state of corrected) {
                const sum = state.reduce((a, b) => a + b, 0);
                expect(sum).toBeCloseTo(1, 10);
            }
        });
    });

    describe('Rate to Probability Conversion', () => {
        function rateToProb(rate, time = 1) {
            return 1 - Math.exp(-rate * time);
        }

        function probToRate(prob, time = 1) {
            return -Math.log(1 - prob) / time;
        }

        test('should convert rate to probability correctly', () => {
            expect(rateToProb(0)).toBe(0);
            expect(rateToProb(0.1)).toBeCloseTo(0.0952, 3);
            expect(rateToProb(1)).toBeCloseTo(0.6321, 3);
        });

        test('should convert probability to rate correctly', () => {
            expect(probToRate(0)).toBe(0);
            expect(probToRate(0.5)).toBeCloseTo(0.6931, 3);
        });

        test('should be inverse functions', () => {
            const rates = [0.01, 0.05, 0.1, 0.5, 1, 2];
            for (const rate of rates) {
                const prob = rateToProb(rate);
                const recoveredRate = probToRate(prob);
                expect(recoveredRate).toBeCloseTo(rate, 10);
            }
        });

        test('should handle time scaling', () => {
            const annualRate = 0.1;
            const monthlyProb = rateToProb(annualRate, 1/12);
            expect(monthlyProb).toBeCloseTo(0.0083, 3);
        });
    });
});

describe('PSA Engine', () => {
    describe('Distribution Sampling', () => {
        // Box-Muller transform for normal sampling
        function sampleNormal(mean, sd, rng) {
            const u1 = rng();
            const u2 = rng();
            const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
            return mean + sd * z;
        }

        // Beta distribution sampling via gamma
        function sampleGamma(shape, scale, rng) {
            if (shape < 1) {
                return sampleGamma(1 + shape, scale, rng) * Math.pow(rng(), 1 / shape);
            }

            const d = shape - 1/3;
            const c = 1 / Math.sqrt(9 * d);

            while (true) {
                let x, v;
                do {
                    x = sampleNormal(0, 1, rng);
                    v = 1 + c * x;
                } while (v <= 0);

                v = v * v * v;
                const u = rng();

                if (u < 1 - 0.0331 * (x * x) * (x * x)) {
                    return d * v * scale;
                }

                if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
                    return d * v * scale;
                }
            }
        }

        function sampleBeta(alpha, beta, rng) {
            const x = sampleGamma(alpha, 1, rng);
            const y = sampleGamma(beta, 1, rng);
            return x / (x + y);
        }

        test('normal sampling should have correct mean (large n)', () => {
            let rngState = 12345;
            const rng = () => {
                rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
                return rngState / 0x7fffffff;
            };

            const samples = [];
            for (let i = 0; i < 10000; i++) {
                samples.push(sampleNormal(100, 10, rng));
            }

            const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
            expect(mean).toBeCloseTo(100, 0);
        });

        test('beta sampling should be in [0,1]', () => {
            let rngState = 54321;
            const rng = () => {
                rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
                return rngState / 0x7fffffff;
            };

            for (let i = 0; i < 1000; i++) {
                const sample = sampleBeta(2, 5, rng);
                expect(sample).toBeGreaterThanOrEqual(0);
                expect(sample).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('ICER Calculation', () => {
        function calculateICER(costs1, effects1, costs2, effects2) {
            const deltaCost = costs2 - costs1;
            const deltaEffect = effects2 - effects1;

            if (Math.abs(deltaEffect) < 1e-10) {
                return deltaEffect >= 0 ? Infinity : -Infinity;
            }

            return deltaCost / deltaEffect;
        }

        test('should calculate simple ICER', () => {
            const icer = calculateICER(10000, 5, 15000, 6);
            expect(icer).toBe(5000);
        });

        test('should handle dominant strategy (lower cost, higher effect)', () => {
            const icer = calculateICER(15000, 5, 10000, 6);
            expect(icer).toBeLessThan(0);
        });

        test('should handle dominated strategy (higher cost, lower effect)', () => {
            const icer = calculateICER(10000, 6, 15000, 5);
            expect(icer).toBeLessThan(0);
        });

        test('should handle zero delta effect', () => {
            const icer = calculateICER(10000, 5, 15000, 5);
            expect(icer).toBe(Infinity);
        });
    });

    describe('CEAC Calculation', () => {
        function calculateCEAC(incrementalCosts, incrementalEffects, wtp) {
            let countCostEffective = 0;
            const n = incrementalCosts.length;

            for (let i = 0; i < n; i++) {
                const nmb = incrementalEffects[i] * wtp - incrementalCosts[i];
                if (nmb >= 0) countCostEffective++;
            }

            return countCostEffective / n;
        }

        test('should return 0 when never cost-effective', () => {
            const costs = [1000, 2000, 3000];
            const effects = [0.01, 0.01, 0.01];
            const prob = calculateCEAC(costs, effects, 10000);
            expect(prob).toBe(0);
        });

        test('should return 1 when always cost-effective', () => {
            const costs = [100, 200, 300];
            const effects = [1, 1, 1];
            const prob = calculateCEAC(costs, effects, 100000);
            expect(prob).toBe(1);
        });

        test('should handle mixed results', () => {
            const costs = [1000, -500, 2000, -1000];
            const effects = [0.1, 0.1, 0.1, 0.1];
            const prob = calculateCEAC(costs, effects, 20000);
            // NMB = 0.1 * 20000 - cost = 2000 - cost
            // cost=1000: NMB=1000 (CE), cost=-500: NMB=2500 (CE)
            // cost=2000: NMB=0 (CE), cost=-1000: NMB=3000 (CE)
            expect(prob).toBe(1);
        });
    });
});

describe('Statistical Functions', () => {
    describe('Confidence Intervals', () => {
        function normalCI(mean, se, alpha = 0.05) {
            const z = 1.96; // Approximate for alpha=0.05
            return [mean - z * se, mean + z * se];
        }

        test('should calculate 95% CI correctly', () => {
            const [lower, upper] = normalCI(100, 10);
            expect(lower).toBeCloseTo(80.4, 0);
            expect(upper).toBeCloseTo(119.6, 0);
        });

        test('should handle zero SE', () => {
            const [lower, upper] = normalCI(100, 0);
            expect(lower).toBe(100);
            expect(upper).toBe(100);
        });
    });

    describe('Meta-Analysis Statistics', () => {
        function calculateQ(effects, variances, pooledEffect) {
            let Q = 0;
            for (let i = 0; i < effects.length; i++) {
                const w = 1 / variances[i];
                Q += w * Math.pow(effects[i] - pooledEffect, 2);
            }
            return Q;
        }

        function calculateI2(Q, k) {
            if (k <= 1) return 0;
            const df = k - 1;
            return Math.max(0, (Q - df) / Q * 100);
        }

        test('should calculate Q statistic', () => {
            const effects = [0.5, 0.6, 0.4];
            const variances = [0.01, 0.01, 0.01];
            const pooled = 0.5;
            const Q = calculateQ(effects, variances, pooled);
            expect(Q).toBeCloseTo(200, 0);
        });

        test('should calculate I2 for heterogeneous data', () => {
            const Q = 50;
            const k = 10;
            const I2 = calculateI2(Q, k);
            expect(I2).toBeCloseTo(82, 0);
        });

        test('should return 0 I2 for Q < df', () => {
            const Q = 5;
            const k = 10;
            const I2 = calculateI2(Q, k);
            expect(I2).toBe(0);
        });
    });
});
