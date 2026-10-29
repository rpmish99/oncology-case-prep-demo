# Recording kit: five-minute demo

Written to be read in your own words. Change anything that does not sound like you.
A live run takes about 90 seconds, so start it early and talk while it works.
The live case is **case 3, the lung case**. Cases 1, 2 and 4 are on the agenda and are covered by the evaluation.

## Before you record (10 minutes)
1. Open the app, sign in, and click **Reset case** on case 3. Reload once so the first run is not a cold start.
2. Do one full dry run of case 3, including a change request and **Approve**. Then click **Reset case** again.
3. Have the change request ready to paste: `Add the safety checks to do before starting the first option.`
4. Open the deck in presenter view and the app in a second window of the same size.
5. Close other tabs and notifications. Use a microphone close to your mouth.
6. Record screen and camera (QuickTime, or any tool that records both). Keep your dry-run recording as a fallback.

## Timeline

| Time | Screen | What to do and say |
|---|---|---|
| 0:00 | Camera | Short hello and what you will show. |
| 0:15 | Slide 1 | Customer, who does the work, the problem. |
| 0:45 | Slide 2 | Before and after, and the product surface. At about 0:55, switch to the app, click **3. Lung** on the agenda, click **Prepare case**, return to the slides. |
| 1:10 | App | Show the agenda and the "Agents see P-xxxx" badge, then narrate the live feed. |
| 1:40 | Slide 3 | The agent graph in 20 seconds, then back to the app. |
| 2:00 | App, packet | Board summary and chips, then the ALK conflict box. |
| 2:20 | App | The similar past cases card. |
| 2:35 | App | Click a citation tag to show the source text. Open the molecular report and click **What the agents see**. Close it. |
| 2:55 | App | Click the follow-up chip **Is brain imaging needed before treatment?** |
| 3:10 | App | Paste the change request, click **Send back for changes**. While it works (about 15 seconds), say why the clinician stays in control. |
| 3:30 | App | Click **Approve**. Point out the audit trail and the run stats. |
| 3:45 | Slides 4 and 5 | Value, guardrails, next steps. |
| 4:50 | Camera | One-line close. |

If you are running behind, skip the source click, the follow-up and the change request, in that order.
If the run fails, switch to your fallback recording and say so.

## Script

**0:00. Hello**
"Hi, I'm [name]. In five minutes I'll show how the OpenAI API can help a cancer center get tumor board cases ready."

**0:15. Slide 1, customer and problem**
"The customer is Lakeview Cancer Institute, a fictional regional cancer center that runs weekly tumor boards for breast, lung and colon cancer. The people doing this work are oncologists and nurse navigators. For each case, someone reads pathology, imaging, molecular or genomic results, clinic notes and the problem list in separate places, then checks the institution's Oncology Care Guidelines, which is the written standard for how a case like this is handled. That takes an hour or more per case, and when two sources disagree it is easy to miss."

**0:45. Slide 2, before and after**
"Today it's manual. In the new workflow the oncologist picks a case from the agenda and asks for it to be prepared. Specialists read the record, the Oncology Care Guidelines, and past similar cases. A draft keeps facts and inference apart, a second check looks for problems, and the oncologist approves before anything is saved. This runs on the OpenAI Platform: the Responses API, the Agents SDK, File Search and MCP."
*(Click case 3, click Prepare case, return to the slides.)*

**1:10. App, while it runs**
"This is today's agenda: four cases across three tumor types. I picked the lung case. Notice the badge: the agents see this patient as a code. Names, record numbers and birth dates are masked before the model sees anything. Now the live run: four specialists started together. Two read the patient record through an MCP server that stands in for the hospital's record system. One searches the Oncology Care Guidelines with File Search, and one looks for similar past cases."

**1:40. Slide 3, agent graph**
"A case coordinator on the stronger model coordinates four specialists on a faster, cheaper model. A separate verifier checks the draft. Then the run pauses for the oncologist. It runs in the customer's own AWS account. Only model calls and the guideline search go to OpenAI."
*(Back to the app.)*

**2:00. Packet**
"Here is the draft. At the top, what the board should know first, and chips for what needs attention. The navigator's note says ALK-positive, but the molecular report says ALK not detected and an EGFR mutation. The draft keeps the lab result and flags the note for correction. It also flags that brain imaging hasn't been done, and that this patient has existing lung disease. The guidelines don't address that, so it says so and leaves it to the clinicians."

**2:20. Similar cases**
"This card shows similar past cases: how many matched and what the board decided. It's labeled as precedent, not a recommendation, because past decisions shouldn't anchor the board. In this demo the registry is synthetic."

**2:35. Source**
"Every statement has its source. If I click this tag I see the actual report. And this toggle shows what the agents actually received, with the identifiers masked."

**2:55. Follow-up question**
"A clinician can also ask questions. I'll click one: is brain imaging needed before treatment? It answers from the packet and the guidelines, and doesn't change the packet."

**3:10. Request changes**
"The oncologist stays in control. I'll ask for the safety checks to do before starting the first option."
*(Paste, send. Fifteen seconds later:)* "The agents revised the draft and sent it back for review."

**3:30. Approve**
"Nothing is saved until the oncologist approves. I'll approve, and the audit trail shows each step. This run took about a minute and a half and cost roughly ten cents in model calls."

**3:45. Slides 4 and 5**
"On value: agent time and cost are measured on these cases, and every check on the planted problems passed across twenty runs. The hours saved are my assumption, forty cases a month and preparation dropping from seventy-five minutes to twenty-five, so about thirty-three hours a month. A pilot would measure the real numbers. For safety, a clinician approves everything, nothing is written to the patient record, and before using real data we would confirm the contract terms. The next step is a four-week run on de-identified past cases."

**4:50. Close**
"Thanks for watching. Happy to take questions."

## If something goes wrong
- **Sign-in expired:** sign in again, then click Reset case.
- **Run is slow:** keep narrating the feed, or cut to your fallback recording.
- **Error banner:** click Reset case and run again.
