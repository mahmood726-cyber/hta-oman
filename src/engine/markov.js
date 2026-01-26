/**
 * Deterministic Markov Cohort Engine
 * Implements cohort-level Markov state-transition simulation
 *
 * Reference: RFC-005 Determinism Contract
 *
 * Features:
 * - Kahan summation for numerical stability
 * - Half-cycle correction (multiple methods)
 * - Discounting (costs and QALYs)
 * - Expression evaluation per cycle
 * - State trace recording
 */

class MarkovEngine {
    constructor(options = {}) {
        this.options = {
            tolerance: 1e-9,  // Mass conservation tolerance
            maxCycles: 10000, // Safety limit
            ...options
        };
    }

    /**
     * Run a deterministic Markov cohort simulation
     * @param {Object} project - The HTA project definition
     * @param {Object} overrides - Parameter overrides (for scenarios/strategies)
     * @returns {Object} Simulation results
     */
    run(project, overrides = {}) {
        const startTime = performance.now();

        // Extract model components
        const settings = this.getSettings(project);
        const parameters = this.resolveParameters(project.parameters, overrides);
        const states = project.states;
        const transitions = project.transitions;

        // Determine number of cycles
        const cycles = Math.min(
            Math.ceil(settings.time_horizon / settings.cycle_length),
            this.options.maxCycles
        );

        // Initialize state occupancy (cohort distribution)
        const stateIds = Object.keys(states);
        let distribution = this.initializeDistribution(states);

        // Initialize accumulators (Kahan summation)
        const costAccum = new KahanSum();
        const qalyAccum = new KahanSum();
        const lyAccum = new KahanSum();

        // Store trace
        const trace = {
            cycles: [],
            states: {}
        };
        for (const stateId of stateIds) {
            trace.states[stateId] = [];
        }

        // Run simulation
        for (let cycle = 0; cycle <= cycles; cycle++) {
            // Build evaluation context
            const context = this.buildContext(parameters, settings, cycle);

            // Record trace
            trace.cycles.push(cycle);
            for (const stateId of stateIds) {
                trace.states[stateId].push(distribution[stateId]);
            }

            // Compute cycle outcomes (costs and QALYs)
            const { cycleCost, cycleQaly, cycleLY } = this.computeCycleOutcomes(
                states, distribution, context, cycle, cycles, settings
            );

            // Apply discounting
            const discountFactor = this.getDiscountFactor(cycle, settings.cycle_length, settings.discount_rate_costs);
            const discountFactorQaly = this.getDiscountFactor(cycle, settings.cycle_length, settings.discount_rate_qalys);

            costAccum.add(cycleCost * discountFactor);
            qalyAccum.add(cycleQaly * discountFactorQaly);
            lyAccum.add(cycleLY * discountFactorQaly);

            // Update state distribution (except last cycle)
            if (cycle < cycles) {
                const transMatrix = this.buildTransitionMatrix(transitions, stateIds, context);
                distribution = this.applyTransitions(distribution, transMatrix, stateIds);
            }
        }

        const computationTime = Math.round(performance.now() - startTime);

        return {
            total_costs: costAccum.total(),
            total_qalys: qalyAccum.total(),
            life_years: lyAccum.total(),
            cycles: cycles,
            trace: trace,
            computation_time_ms: computationTime,
            final_distribution: distribution
        };
    }

    /**
     * Get model settings with defaults
     */
    getSettings(project) {
        const s = project.settings || {};
        return {
            time_horizon: s.time_horizon || 40,
            cycle_length: s.cycle_length || 1,
            discount_rate_costs: s.discount_rate_costs || 0.035,
            discount_rate_qalys: s.discount_rate_qalys || 0.035,
            half_cycle_correction: s.half_cycle_correction || 'trapezoidal',
            currency: s.currency || 'GBP',
            starting_age: s.starting_age || 50
        };
    }

    /**
     * Resolve parameters with overrides
     */
    resolveParameters(parameters, overrides) {
        const resolved = {};

        for (const [id, param] of Object.entries(parameters || {})) {
            if (id in overrides) {
                resolved[id] = overrides[id];
            } else if (typeof param.value === 'number') {
                resolved[id] = param.value;
            } else if (typeof param.value === 'string') {
                // Expression - will be evaluated in context
                resolved[id] = param.value;
            } else {
                resolved[id] = 0;
            }
        }

        return resolved;
    }

    /**
     * Initialize state distribution based on initial probabilities
     */
    initializeDistribution(states) {
        const dist = {};
        let total = 0;

        for (const [stateId, state] of Object.entries(states)) {
            const initProb = state.initial_probability || 0;
            dist[stateId] = initProb;
            total += initProb;
        }

        // Normalize if not exactly 1
        if (Math.abs(total - 1) > 1e-9 && total > 0) {
            for (const stateId of Object.keys(dist)) {
                dist[stateId] /= total;
            }
        }

        // If no initial specified, start in first state
        if (total === 0) {
            const firstState = Object.keys(states)[0];
            dist[firstState] = 1.0;
        }

        return dist;
    }

    /**
     * Build evaluation context for expressions
     */
    buildContext(parameters, settings, cycle) {
        const context = {
            cycle: cycle,
            time: cycle * settings.cycle_length,
            age: (settings.starting_age || 50) + cycle * settings.cycle_length
        };

        // Add parameters
        for (const [id, value] of Object.entries(parameters)) {
            if (typeof value === 'number') {
                context[id] = value;
            }
        }

        // Resolve expression parameters
        for (const [id, value] of Object.entries(parameters)) {
            if (typeof value === 'string') {
                try {
                    context[id] = ExpressionParser.evaluate(value, context);
                } catch (e) {
                    console.warn(`Failed to evaluate parameter ${id}: ${e.message}`);
                    context[id] = 0;
                }
            }
        }

        return context;
    }

    /**
     * Compute costs, QALYs and life-years for a cycle
     */
    computeCycleOutcomes(states, distribution, context, cycle, totalCycles, settings) {
        let cycleCost = 0;
        let cycleQaly = 0;
        let cycleLY = 0;

        const hccMethod = settings.half_cycle_correction;

        for (const [stateId, state] of Object.entries(states)) {
            const occupancy = distribution[stateId];
            if (occupancy <= 0) continue;

            // Get cost for this state
            let cost = 0;
            if (typeof state.cost === 'number') {
                cost = state.cost;
            } else if (typeof state.cost === 'string') {
                try {
                    cost = ExpressionParser.evaluate(state.cost, context);
                } catch (e) {
                    console.warn(`Failed to evaluate cost for ${stateId}: ${e.message}`);
                }
            }

            // Get utility for this state
            let utility = 1;
            if (typeof state.utility === 'number') {
                utility = state.utility;
            } else if (typeof state.utility === 'string') {
                try {
                    utility = ExpressionParser.evaluate(state.utility, context);
                } catch (e) {
                    console.warn(`Failed to evaluate utility for ${stateId}: ${e.message}`);
                }
            }

            // Apply half-cycle correction
            let hccFactor = 1.0;
            if (hccMethod === 'trapezoidal') {
                if (cycle === 0 || cycle === totalCycles) {
                    hccFactor = 0.5;
                }
            } else if (hccMethod === 'start') {
                if (cycle === 0) {
                    hccFactor = 0.5;
                }
            } else if (hccMethod === 'end') {
                if (cycle === totalCycles) {
                    hccFactor = 0.5;
                }
            }
            // 'none' = no adjustment

            cycleCost += occupancy * cost * settings.cycle_length * hccFactor;
            cycleQaly += occupancy * utility * settings.cycle_length * hccFactor;
            cycleLY += occupancy * settings.cycle_length * hccFactor;
        }

        return { cycleCost, cycleQaly, cycleLY };
    }

    /**
     * Build transition probability matrix
     */
    buildTransitionMatrix(transitions, stateIds, context) {
        const n = stateIds.length;
        const matrix = {};

        // Initialize empty matrix
        for (const fromId of stateIds) {
            matrix[fromId] = {};
            for (const toId of stateIds) {
                matrix[fromId][toId] = 0;
            }
        }

        // Fill in transitions
        for (const [transId, trans] of Object.entries(transitions || {})) {
            let prob = 0;

            if (typeof trans.probability === 'number') {
                prob = trans.probability;
            } else if (typeof trans.probability === 'string') {
                try {
                    prob = ExpressionParser.evaluate(trans.probability, context);
                } catch (e) {
                    console.warn(`Failed to evaluate transition ${transId}: ${e.message}`);
                }
            }

            // Clamp probability to [0, 1]
            prob = Math.max(0, Math.min(1, prob));

            if (trans.from in matrix && trans.to in matrix[trans.from]) {
                matrix[trans.from][trans.to] = prob;
            }
        }

        return matrix;
    }

    /**
     * Apply transitions to update state distribution
     */
    applyTransitions(distribution, matrix, stateIds) {
        const newDist = {};

        for (const toId of stateIds) {
            const accum = new KahanSum();
            for (const fromId of stateIds) {
                accum.add(distribution[fromId] * matrix[fromId][toId]);
            }
            newDist[toId] = accum.total();
        }

        return newDist;
    }

    /**
     * Calculate discount factor
     */
    getDiscountFactor(cycle, cycleLength, rate) {
        if (rate <= 0) return 1;
        const time = cycle * cycleLength;
        return Math.pow(1 + rate, -time);
    }

    /**
     * Run incremental analysis (intervention vs comparator)
     */
    runIncremental(project, interventionOverrides = {}, comparatorOverrides = {}) {
        // Run intervention
        const intResults = this.run(project, interventionOverrides);

        // Run comparator
        const compResults = this.run(project, comparatorOverrides);

        // Calculate incremental values
        const incCosts = intResults.total_costs - compResults.total_costs;
        const incQalys = intResults.total_qalys - compResults.total_qalys;

        // Calculate ICER
        let icer = null;
        let dominance = 'none';

        if (incQalys > 0) {
            if (incCosts > 0) {
                icer = incCosts / incQalys;
            } else {
                dominance = 'dominant';
                icer = 'Dominant';
            }
        } else if (incQalys < 0) {
            if (incCosts > 0) {
                dominance = 'dominated';
                icer = 'Dominated';
            } else {
                icer = incCosts / incQalys; // SW quadrant
            }
        } else {
            // No QALY difference
            icer = incCosts > 0 ? Infinity : (incCosts < 0 ? -Infinity : 0);
        }

        // Calculate NMB at different WTP thresholds
        const wtpThresholds = [20000, 30000, 50000];
        const nmb = {};
        for (const wtp of wtpThresholds) {
            nmb[wtp] = incQalys * wtp - incCosts;
        }

        return {
            intervention: intResults,
            comparator: compResults,
            incremental: {
                costs: incCosts,
                qalys: incQalys,
                life_years: intResults.life_years - compResults.life_years,
                icer: icer,
                dominance: dominance,
                nmb: nmb
            }
        };
    }

    /**
     * Run all strategies defined in the project
     */
    runAllStrategies(project) {
        const strategies = project.strategies || {};
        const results = {
            strategies: {},
            incremental: null
        };

        // Find comparator
        let comparatorId = null;
        for (const [stratId, strat] of Object.entries(strategies)) {
            if (strat.is_comparator) {
                comparatorId = stratId;
                break;
            }
        }

        // Run each strategy
        for (const [stratId, strat] of Object.entries(strategies)) {
            const overrides = strat.parameter_overrides || {};
            const stratResults = this.run(project, overrides);
            results.strategies[stratId] = {
                label: strat.label,
                ...stratResults
            };
        }

        // Calculate incremental results vs comparator
        if (comparatorId) {
            const comparisons = [];
            const compResults = results.strategies[comparatorId];

            for (const [stratId, stratResults] of Object.entries(results.strategies)) {
                if (stratId === comparatorId) continue;

                const incCosts = stratResults.total_costs - compResults.total_costs;
                const incQalys = stratResults.total_qalys - compResults.total_qalys;

                let icer = null;
                let dominance = 'none';

                if (incQalys > 0) {
                    if (incCosts > 0) {
                        icer = incCosts / incQalys;
                    } else {
                        dominance = 'dominant';
                    }
                } else if (incQalys < 0) {
                    if (incCosts > 0) {
                        dominance = 'dominated';
                    } else {
                        icer = incCosts / incQalys;
                    }
                }

                comparisons.push({
                    strategy: stratId,
                    label: stratResults.label,
                    incremental_costs: incCosts,
                    incremental_qalys: incQalys,
                    icer: icer,
                    dominance: dominance,
                    nmb_30k: incQalys * 30000 - incCosts
                });
            }

            results.incremental = {
                comparator: comparatorId,
                comparisons: comparisons
            };
        }

        return results;
    }
}

// Export
if (typeof window !== 'undefined') {
    window.MarkovEngine = MarkovEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MarkovEngine };
}
