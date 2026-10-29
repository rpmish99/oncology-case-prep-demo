# Evaluation results

4 synthetic cases, 5 runs each (20 of 20 completed), run 2026-10-29.
Checks are text tests on the structured packet. They show how often each planted problem was caught.
Overall: 168 of 170 checks passed.

Note: this is the last complete run (20 of 20). Two small changes were made after it and have not yet been re-run
because the OpenAI account ran out of credits: a fix to one scoring check (it wrongly counted "not superseded" as
superseded) and a hint in the similar-cases search for unrecognized tokens. Both misses in this run were in the lung
case. Re-run with `cd agent && npm run eval` once credits are available.

## case-001: Breast, early, ER-positive

| Check | Passed |
|---|---|
| Flags the note that says HER2-positive against the pathology result | 5 of 5 |
| Connects the prior DVT to tamoxifen | 5 of 5 |
| Notes the bone density scan is old or needs updating | 5 of 5 |
| Does not use the superseded 2022 guidelines | 5 of 5 |
| Offers at least two options rather than one decision | 5 of 5 |
| Every option has patient facts and guideline statements | 5 of 5 |
| Reports similar past cases with a caution | 5 of 5 |
| Does not use a superseded document | 5 of 5 |

Observed, not scored:

- Mentions genetic testing (optional for this patient): 3 of 5

## case-002: Breast, premenopausal, node-positive

| Check | Passed |
|---|---|
| Flags left versus right breast between the note and pathology | 5 of 5 |
| Flags that genetic counseling or testing is indicated | 5 of 5 |
| Includes chemotherapy as an option to discuss | 5 of 5 |
| Mentions ovarian suppression | 5 of 5 |
| Raises fertility | 5 of 5 |
| Offers at least two options rather than one decision | 5 of 5 |
| Every option has patient facts and guideline statements | 5 of 5 |
| Reports similar past cases with a caution | 5 of 5 |
| Does not use a superseded document | 5 of 5 |

## case-003: Lung, EGFR-mutated

| Check | Passed |
|---|---|
| Flags the note that says ALK-positive against the molecular report | 5 of 5 |
| Flags that brain MRI has not been done | 5 of 5 |
| Flags the existing interstitial lung disease | 5 of 5 |
| Offers EGFR-targeted therapy as first-line | 5 of 5 |
| Offers at least two options rather than one decision | 5 of 5 |
| Every option has patient facts and guideline statements | 5 of 5 |
| Reports similar past cases with a caution | 4 of 5 |
| Does not use a superseded document | 4 of 5 |

Observed, not scored:

- States that the guidelines do not address the lung disease: 4 of 5

## case-004: Colon, stage III

| Check | Passed |
|---|---|
| Flags the note that says stage II against the pathology result | 5 of 5 |
| Connects the existing neuropathy to oxaliplatin | 5 of 5 |
| Uses the current three-month duration for low-risk stage III | 5 of 5 |
| Does not use the superseded 2020 guidelines | 5 of 5 |
| Notes the post-operative CEA has not been drawn | 5 of 5 |
| Offers at least two options rather than one decision | 5 of 5 |
| Every option has patient facts and guideline statements | 5 of 5 |
| Reports similar past cases with a caution | 5 of 5 |
| Does not use a superseded document | 5 of 5 |

Observed, not scored:

- Mentions DPYD testing: 5 of 5

Average time to the review step: 87 seconds (runs were 5 at a time).
Average model cost per case at list prices: $0.099.

