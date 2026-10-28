# Evaluation results

Synthetic case 001, 10 runs (10 completed), run 2026-10-28.
Checks are text tests on the structured packet. They show how often each planted problem was caught.

| Check | Passed |
|---|---|
| Flags the note that says HER2-positive against the pathology result | 10 of 10 |
| Connects the prior DVT to tamoxifen | 10 of 10 |
| Does not rely on the superseded 2022 pathway | 10 of 10 |
| Notes the bone density scan is old or needs updating | 10 of 10 |
| Offers at least two options rather than one decision | 10 of 10 |
| Every option has patient facts and pathway statements | 10 of 10 |

Observed, not scored:

- Mentions that genetic testing was not done (optional for this patient): 5 of 10

The genetic testing line is not scored. The pathway only asks for genetic counseling when risk criteria are met, and this patient does not meet them, so mentioning it is optional. An earlier version of this check scored it as required and passed 3 of 8 runs. It was reclassified after looking at the pathway text, not to improve the number.

Average time to the review step: 88 seconds (runs were 5 at a time).
Average model cost per case at list prices: $0.097.
