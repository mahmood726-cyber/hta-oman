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

var OmanGuidanceRef = (function resolveOmanGuidance() {
    if (typeof globalThis !== 'undefined' && globalThis.OmanHTAGuidance) {
        return globalThis.OmanHTAGuidance;
    }
    if (typeof require === 'function') {
        try {
            return require('../utils/omanGuidance');
        } catch (err) {
            return null;
        }
    }
    return null;
})();

var guidanceDefaults = OmanGuidanceRef?.defaults || {
    discount_rate_costs: 0.03,
    discount_rate_qalys: 0.03,
    currency: 'OMR'
};

function resolveWtpThresholds(settings) {
    if (OmanGuidanceRef?.resolveWtpThresholds) {
        return OmanGuidanceRef.resolveWtpThresholds(settings).thresholds;
    }
    const explicit = Array.isArray(settings?.wtp_thresholds) ? settings.wtp_thresholds : null;
    if (explicit && explicit.length) return explicit;
    return [20000, 30000, 50000];
}

function resolvePrimaryWtp(settings) {
    const thresholds = resolveWtpThresholds(settings);
    return thresholds[0];
}

class MarkovEngine {
    constructor(options = {}) {
        this.options = {
            tolerance: 1e-9,  // Mass conservation tolerance
            maxCycles: 10000, // Safety limit
            ...options
        };
        this.warnedParameters = new Set();
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
        const { baseValues, overrideExpressions } = this.resolveParameters(project.parameters, overrides);
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
            // Build evaluation context with base values first, then apply overrides
            const context = this.buildContext(baseValues, overrideExpressions, settings, cycle);

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
            time_horizon: s.time_horizon ?? 40,
            cycle_length: s.cycle_length ?? 1,
            discount_rate_costs: s.discount_rate_costs ?? guidanceDefaults.discount_rate_costs,
            discount_rate_qalys: s.discount_rate_qalys ?? guidanceDefaults.discount_rate_qalys,
            half_cycle_correction: s.half_cycle_correction || 'trapezoidal',
            currency: s.currency || guidanceDefaults.currency,
            starting_age: s.starting_age ?? 50,
            gdp_per_capita_omr: s.gdp_per_capita_omr,
            wtp_thresholds: s.wtp_thresholds,
            wtp_multipliers: s.wtp_multipliers,
            // Background mortality settings
            use_background_mortality: s.use_background_mortality ?? false,
            background_mortality_sex: s.background_mortality_sex || 'mixed',
            // Tunnel state settings
            tunnel_states: s.tunnel_states || {}
        };
    }

    /**
     * Get background mortality rate for given age and sex
     * Uses life tables when available, otherwise returns 0
     */
    getBackgroundMortality(age, sex, settings) {
        if (!settings.use_background_mortality) return 0;

        // Check if LifeTable is available
        if (typeof LifeTable === 'undefined') return 0;

        try {
            const lifeTable = new LifeTable();
            const effectiveSex = settings.background_mortality_sex === 'mixed' ?
                (Math.random() < 0.5 ? 'male' : 'female') : settings.background_mortality_sex;
            return lifeTable.getMortalityRate(Math.floor(age), effectiveSex);
        } catch (e) {
            return 0;
        }
    }

    /**
     * Resolve parameters with overrides
     * Returns { baseValues, overrideExpressions } to handle strategy differentiation
     */
    resolveParameters(parameters, overrides) {
        const baseValues = {};
        const overrideExpressions = {};

        for (const [id, param] of Object.entries(parameters || {})) {
            // Always store the base value first
            if (typeof param.value === 'number') {
                baseValues[id] = param.value;
            } else if (typeof param.value === 'string') {
                // Expression - will be evaluated in context
                baseValues[id] = param.value;
            } else {
                baseValues[id] = 0;
            }

            // If there's an override, store it separately
            if (id in overrides) {
                overrideExpressions[id] = overrides[id];
            }
        }

        return { baseValues, overrideExpressions };
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
     * Handles strategy differentiation by evaluating overrides AFTER base values are established
     */
    buildContext(baseValues, overrideExpressions, settings, cycle) {
        const context = {
            cycle: cycle,
            time: cycle * settings.cycle_length,
            age: (settings.starting_age || 50) + cycle * settings.cycle_length
        };

        // STEP 1: Add all numeric base parameters to context first
        for (const [id, value] of Object.entries(baseValues)) {
            if (typeof value === 'number') {
                context[id] = value;
            }
        }

        // STEP 2: Resolve base expression parameters (not overridden)
        for (const [id, value] of Object.entries(baseValues)) {
            if (typeof value === 'string' && !(id in overrideExpressions)) {
                const trimmed = value.trim();
                const isSimpleIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed);
                if (isSimpleIdentifier) {
                    if (Object.hasOwn(context, trimmed)) {
                        context[id] = context[trimmed];
                    } else {
                        context[id] = 0;
                    }
                    continue;
                }
                try {
                    context[id] = ExpressionParser.evaluate(value, context);
                } catch (e) {
                    if (!this.warnedParameters.has(id)) {
                        console.warn(`Failed to evaluate parameter ${id}: ${e.message}`);
                        this.warnedParameters.add(id);
                    }
                    context[id] = 0;
                }
            }
        }

        // STEP 3: Now apply override expressions using the established base context
        // This allows expressions like 'p_mi_standard * hr_mi_sglt2' to work correctly
        // because p_mi_standard is already in the context with its base value
        for (const [id, overrideExpr] of Object.entries(overrideExpressions)) {
            if (typeof overrideExpr === 'number') {
                context[id] = overrideExpr;
            } else if (typeof overrideExpr === 'string') {
                const trimmed = overrideExpr.trim();
                const isSimpleIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed);
                if (isSimpleIdentifier) {
                    // Simple reference to another parameter
                    if (Object.hasOwn(context, trimmed)) {
                        context[id] = context[trimmed];
                    } else {
                        context[id] = 0;
                    }
                } else {
                    // Expression evaluation - base values are already in context
                    try {
                        context[id] = ExpressionParser.evaluate(overrideExpr, context);
                    } catch (e) {
                        if (!this.warnedParameters.has(id + '_override')) {
                            console.warn(`Failed to evaluate override ${id}: ${e.message}`);
                            this.warnedParameters.add(id + '_override');
                        }
                        // Fall back to base value if override fails
                        if (!(id in context)) {
                            context[id] = 0;
                        }
                    }
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
     * Validates row sums and handles complement transitions
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

        // Track which transitions are explicitly defined (for complement handling)
        const explicitTransitions = new Set();

        // Fill in transitions
        for (const [transId, trans] of Object.entries(transitions || {})) {
            let prob = 0;

            if (typeof trans.probability === 'number') {
                prob = trans.probability;
            } else if (typeof trans.probability === 'string') {
                // Check for complement keyword
                if (trans.probability.toLowerCase() === 'complement' || trans.probability === 'C') {
                    continue; // Handle complements after all explicit transitions
                }
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
                explicitTransitions.add(`${trans.from}->${trans.to}`);
            }
        }

        // Handle complement transitions
        for (const [transId, trans] of Object.entries(transitions || {})) {
            if (typeof trans.probability === 'string' &&
                (trans.probability.toLowerCase() === 'complement' || trans.probability === 'C')) {
                if (trans.from in matrix && trans.to in matrix[trans.from]) {
                    // Calculate complement probability
                    let rowSum = 0;
                    for (const toId of stateIds) {
                        if (`${trans.from}->${toId}` !== `${trans.from}->${trans.to}`) {
                            rowSum += matrix[trans.from][toId];
                        }
                    }
                    matrix[trans.from][trans.to] = Math.max(0, 1 - rowSum);
                }
            }
        }

        // Validate row sums and warn if they don't equal 1.0
        const tolerance = 1e-6;
        for (const fromId of stateIds) {
            let rowSum = 0;
            for (const toId of stateIds) {
                rowSum += matrix[fromId][toId];
            }

            if (rowSum < tolerance) {
                // No transitions defined - assume stay in same state
                matrix[fromId][fromId] = 1.0;
            } else if (Math.abs(rowSum - 1.0) > tolerance) {
                if (rowSum > 1.0) {
                    // Row sum exceeds 1 - normalize
                    console.warn(`Transition probabilities from state "${fromId}" sum to ${rowSum.toFixed(4)} (>1.0). Normalizing.`);
                    for (const toId of stateIds) {
                        matrix[fromId][toId] /= rowSum;
                    }
                } else {
                    // Row sum less than 1 - assign remainder to self-transition
                    const remainder = 1.0 - rowSum;
                    matrix[fromId][fromId] += remainder;
                }
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
        const settings = this.getSettings(project);
        // Run intervention
        const intResults = this.run(project, interventionOverrides);

        // Run comparator
        const compResults = this.run(project, comparatorOverrides);

        // Calculate incremental values
        const incCosts = intResults.total_costs - compResults.total_costs;
        const incQalys = intResults.total_qalys - compResults.total_qalys;

        // Calculate ICER with proper handling of all quadrants and edge cases
        let icer = null;
        let dominance = 'none';

        if (Math.abs(incQalys) < 1e-10) {
            // Incremental QALYs essentially zero - ICER undefined
            if (incCosts > 0) {
                dominance = 'more_costly_equal_effect';
                icer = 'Undefined (no QALY difference)';
            } else if (incCosts < 0) {
                dominance = 'less_costly_equal_effect';
                icer = 'Undefined (no QALY difference)';
            } else {
                dominance = 'equivalent';
                icer = 'Equivalent';
            }
        } else if (incQalys > 0) {
            if (incCosts > 0) {
                icer = incCosts / incQalys;
            } else {
                dominance = 'dominant';
                icer = 'Dominant';
            }
        } else {
            if (incCosts > 0) {
                dominance = 'dominated';
                icer = 'Dominated';
            } else {
                icer = incCosts / incQalys; // SW quadrant - trade-off
            }
        }

        // Calculate NMB at different WTP thresholds
        const wtpThresholds = resolveWtpThresholds(settings);
        const primaryWtp = resolvePrimaryWtp(settings);
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
                nmb: nmb,
                wtp_thresholds: wtpThresholds,
                primary_wtp: primaryWtp,
                nmb_primary: incQalys * primaryWtp - incCosts
            }
        };
    }

    /**
     * Run all strategies defined in the project
     */
    runAllStrategies(project) {
        const strategies = project.strategies || {};
        const settings = this.getSettings(project);
        const wtpThresholds = resolveWtpThresholds(settings);
        const primaryWtp = resolvePrimaryWtp(settings);
        const results = {
            strategies: {},
            incremental: null,
            wtp_thresholds: wtpThresholds,
            primary_wtp: primaryWtp
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

                // Handle ICER calculation for all four quadrants of the CE plane
                // Plus edge case when incremental QALYs is zero
                if (Math.abs(incQalys) < 1e-10) {
                    // Incremental QALYs essentially zero - ICER undefined
                    icer = null;
                    if (incCosts > 0) {
                        dominance = 'more_costly_equal_effect';
                    } else if (incCosts < 0) {
                        dominance = 'less_costly_equal_effect';
                    } else {
                        dominance = 'equivalent';
                    }
                } else if (incQalys > 0) {
                    // Northeast or Northwest quadrant
                    if (incCosts > 0) {
                        icer = incCosts / incQalys;
                    } else {
                        dominance = 'dominant';
                    }
                } else {
                    // Southeast or Southwest quadrant
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
                    nmb_30k: incQalys * primaryWtp - incCosts,
                    nmb_primary: incQalys * primaryWtp - incCosts,
                    wtp_used: primaryWtp
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
    window.MarkovModel = MarkovEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MarkovEngine };
}
