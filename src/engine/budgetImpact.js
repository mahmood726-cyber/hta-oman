/**
 * Budget Impact Analysis (BIA) calculator
 * Deterministic, rules-based implementation aligned with Oman HTA guidance.
 */

class BudgetImpactCalculator {
    calculate(input = {}) {
        const years = Math.max(1, Math.round(input.years ?? 4));
        const population = Number(input.population) || 0;
        const growthRate = Number(input.population_growth_rate) || 0;
        const uptakeRates = Array.isArray(input.uptake_rates) ? input.uptake_rates : [];
        const incrementalCost = Number(input.incremental_cost_per_patient) || 0;
        const fixedCost = Number(input.fixed_cost) || 0;
        const discountRate = Number(input.discount_rate) || 0;

        const resolvedUptake = [];
        for (let i = 0; i < years; i += 1) {
            const value = uptakeRates[i] !== undefined ? uptakeRates[i] : uptakeRates[uptakeRates.length - 1];
            resolvedUptake.push(Math.max(0, Math.min(1, Number(value) || 0)));
        }

        const rows = [];
        let cumulative = 0;

        for (let year = 1; year <= years; year += 1) {
            const growthMultiplier = Math.pow(1 + growthRate, year - 1);
            const populationYear = population * growthMultiplier;
            const uptake = resolvedUptake[year - 1];
            const treated = populationYear * uptake;
            let annualCost = treated * incrementalCost + (year === 1 ? fixedCost : 0);
            if (discountRate > 0) {
                annualCost = annualCost / Math.pow(1 + discountRate, year - 1);
            }
            cumulative += annualCost;

            rows.push({
                year,
                population: populationYear,
                uptake,
                treated,
                annualCost,
                cumulativeCost: cumulative
            });
        }

        return {
            years,
            population,
            growthRate,
            uptakeRates: resolvedUptake,
            incrementalCost,
            fixedCost,
            discountRate,
            rows,
            totalCost: cumulative
        };
    }
}

if (typeof window !== 'undefined') {
    window.BudgetImpactCalculator = BudgetImpactCalculator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BudgetImpactCalculator;
}
