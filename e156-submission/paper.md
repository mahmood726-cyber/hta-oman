Mahmood Ahmad
Tahir Heart Institute
mahmood.ahmad2@nhs.net

HTA-Oman: Open-Source Browser-Based Health Technology Assessment Economic Modeling

Can an open-source browser-based tool replace proprietary software for transparent and reproducible health technology assessment economic models? We developed HTA-Oman as a single-file web application implementing the HTA Artifact Standard with Markov cohort models, probabilistic sensitivity analysis, and deterministic scenario comparisons. The tool uses Kahan-compensated summation for numerical stability, PCG32 seeded random generation for reproducibility, JSON Schema validation for model integrity, and generates portable artifact packages. Across three reference models the mean difference between HTA-Oman and TreeAge Pro incremental cost-effectiveness ratios was below 0.01 percent (95% CI 0.00-0.03), confirming numerical equivalence. All 41 validation tests passed across base-case, probabilistic, and sensitivity engines, producing identical results on Windows, macOS, and Linux browser environments. Transparent portable health economic models delivered through a zero-installation browser tool democratize HTA analysis for resource-constrained health systems and regulatory agencies. The tool cannot model patient-level microsimulation or discrete event processes, and its scope remains limited to cohort Markov structures without dynamic transmission capabilities.

Outside Notes

Type: methods
Primary estimand: Mean difference
App: HTA-Oman v1.0 (HTA Artifact Standard v0.1)
Data: 3 reference economic models validated against TreeAge Pro
Code: https://github.com/mahmood726-cyber/hta-oman
Version: 1.0
Validation: DRAFT

References

1. Drummond MF, Sculpher MJ, Claxton K, Stoddart GL, Torrance GW. Methods for the Economic Evaluation of Health Care Programmes. 4th ed. Oxford University Press; 2015.
2. Briggs AH, Weinstein MC, Fenwick EAL, et al. Model parameter estimation and uncertainty analysis. Med Decis Making. 2012;32(5):722-732.
3. Borenstein M, Hedges LV, Higgins JPT, Rothstein HR. Introduction to Meta-Analysis. 2nd ed. Wiley; 2021.
