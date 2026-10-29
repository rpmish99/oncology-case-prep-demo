"""Builds the synthetic registry of past tumor board cases used by the similar-cases tool.

Everything here is invented. Decisions and outcomes follow simple made-up patterns so the demo has something to
search. Nothing in it describes real patients or real results. Run: python3 scripts/make-registry.py
"""
import json, random

rng = random.Random(42)
cases = []

def pick(options):
    r, acc = rng.random(), 0.0
    for weight, value in options:
        acc += weight
        if r <= acc:
            return value
    return options[-1][1]

def add(site, stage, biomarkers, factors, age_band, decision_opts, outcome_opts):
    cases.append(dict(
        tumor_type=site, stage=stage, biomarkers=biomarkers, factors=factors, age_band=age_band,
        decision=pick(decision_opts), outcome_24mo=pick(outcome_opts), board_year=rng.choice([2023, 2024, 2025]),
    ))

NED = [(0.93, "no evidence of disease"), (1.0, "recurrence")]
for _ in range(9):  # postmenopausal, node-negative, intermediate score
    f = rng.choice([[], ["osteopenia"], ["prior_vte"], ["prior_vte", "osteopenia"]])
    f = ["postmenopausal"] + f
    dec = [(0.9, "Endocrine therapy alone (aromatase inhibitor)"), (1.0, "Chemotherapy then endocrine therapy")]
    if "prior_vte" in f:
        dec = [(0.95, "Endocrine therapy alone (aromatase inhibitor, tamoxifen avoided)"), (1.0, "Chemotherapy then endocrine therapy")]
    add("breast", "I", ["ER+", "PR+", "HER2-", "RS_intermediate"], f, rng.choice(["50-59", "60-69"]), dec, NED)
for _ in range(7):  # premenopausal, node-positive
    f = ["premenopausal", "node_positive"] + rng.choice([[], ["family_history_young"], ["family_history_young"]])
    dec = [(0.8, "Chemotherapy, then endocrine therapy with ovarian suppression"), (1.0, "Endocrine therapy with ovarian suppression")]
    if "family_history_young" in f:
        dec = [(0.85, "Chemotherapy, then endocrine therapy; referred for genetic counseling"), (1.0, "Genetic counseling first, then chemotherapy")]
    add("breast", "II", ["ER+", "PR+", "HER2-", rng.choice(["RS_high", "RS_high", "RS_intermediate"])], f, rng.choice(["40-49", "40-49", "30-39"]), dec,
        [(0.85, "no evidence of disease"), (1.0, "recurrence")])
for _ in range(4):  # HER2-positive, for contrast
    add("breast", "II", ["ER-", "HER2+"], ["premenopausal"], "40-49", [(1.0, "Chemotherapy with HER2-directed therapy")], NED)

for _ in range(8):  # EGFR-mutated stage IV
    f = rng.choice([[], [], ["ild"], ["ild"], ["smoker"]])
    dec = [(0.9, "EGFR-targeted therapy (osimertinib)"), (1.0, "EGFR-targeted therapy plus chemotherapy")]
    if "ild" in f:
        dec = [(0.7, "EGFR-targeted therapy with pulmonology co-management and CT surveillance"), (1.0, "Chemotherapy first, targeted therapy deferred")]
    add("lung", "IV", rng.choice([["EGFR_exon19", "PD-L1_low"], ["EGFR_exon19"], ["EGFR_L858R", "PD-L1_low"]]), f, rng.choice(["60-69", "70-79"]), dec,
        [(0.55, "alive on treatment, disease controlled"), (0.8, "progression"), (1.0, "deceased")])
for _ in range(4):
    add("lung", "IV", ["PD-L1_high"], ["smoker"], "60-69", [(1.0, "Immunotherapy alone")], [(0.5, "alive on treatment, disease controlled"), (0.8, "progression"), (1.0, "deceased")])
for _ in range(3):
    add("lung", "IIIA", ["PD-L1_low"], ["smoker"], "60-69", [(0.7, "Chemoradiation"), (1.0, "Surgery with adjuvant therapy")], [(0.6, "no evidence of disease"), (1.0, "recurrence")])

for _ in range(8):  # stage III low risk
    f = rng.choice([[], [], ["neuropathy", "diabetes"], ["neuropathy", "diabetes"], ["diabetes"]])
    dec = [(0.75, "CAPOX for 3 months"), (0.9, "FOLFOX for 3 to 6 months"), (1.0, "CAPOX for 6 months")]
    if "neuropathy" in f:
        dec = [(0.55, "CAPOX for 3 months with a dose-reduction plan for neuropathy"), (0.85, "FOLFOX for 3 months, early stop if neuropathy worsens"), (1.0, "Capecitabine alone")]
    add("colon", "IIIB", ["MSS", "pT3", "pN1"], f, rng.choice(["60-69", "50-59"]), dec, [(0.88, "no evidence of disease"), (1.0, "recurrence")])
for _ in range(4):
    add("colon", "IIIC", ["MSS", "pT4", "pN2"], [], "60-69", [(1.0, "CAPOX or FOLFOX for 6 months")], [(0.75, "no evidence of disease"), (1.0, "recurrence")])
for _ in range(3):
    add("colon", "II", ["MSI-H"], [], "70-79", [(1.0, "Surveillance without chemotherapy")], [(0.95, "no evidence of disease"), (1.0, "recurrence")])

for i, c in enumerate(cases, 1):
    c["id"] = f"PC-{i:04d}"
json.dump({"note": "Entirely synthetic. Invented decisions and outcomes. Not real patients or results.", "cases": cases}, open("data/registry/past-cases.json", "w"), indent=1)
print(len(cases), "cases")
