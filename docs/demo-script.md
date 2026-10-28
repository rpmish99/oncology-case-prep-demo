# Recording kit: five-minute demo

Written to be read in your own words. Change anything that does not sound like you.
A live run takes about 90 seconds, so start it early and talk while it works.

## Before you record (10 minutes)
1. Open the app, sign in, and click **Reset demo**. Reload once so the first run is not a cold start.
2. Do one full dry run, including a change request and **Approve**. Then click **Reset demo** again.
3. Have the change request text ready to paste: `Add a short bone density plan to the aromatase inhibitor option.`
4. Open the deck in presenter view and the app in a second window of the same size.
5. Close other tabs and notifications. Use a microphone close to your mouth.
6. Record screen and camera (QuickTime, or any tool that records both). Keep your dry-run recording as a fallback.

## Timeline

| Time | Screen | What to do and say |
|---|---|---|
| 0:00 | Camera | Short hello and what you will show. |
| 0:15 | Slide 1 | Customer, who does the work, the problem. |
| 0:45 | Slide 2 | Before and after, and the product surface. At about 0:55, switch to the app, click **Prepare case**, return to the slides. |
| 1:10 | App | Narrate the live feed: specialists reading the record and searching the pathway documents. |
| 1:40 | Slide 3 | The agent graph in 20 seconds, then back to the app. |
| 2:00 | App, packet | The board summary and attention chips. Then the conflict box. |
| 2:25 | App | Click a citation tag to show the source text. Close it. |
| 2:40 | App | The verifier findings in the activity panel. |
| 2:55 | App | Click the follow-up chip **What does the pathway say about extending endocrine therapy?** (about 5 seconds). |
| 3:10 | App | Paste the change request, click **Send back for changes**. While it works (about 15 seconds), say why the clinician stays in control. |
| 3:35 | App | Click **Approve**. Point out the audit trail. |
| 3:45 | App | Point at the run stats (time, tokens, cost) and click **View the trace in OpenAI**. |
| 4:00 | Slides 4 and 5 | Value, guardrails, next steps. |
| 4:50 | Camera | One-line close. |

If you are running behind, skip the trace and the change request. The "what if HER2-positive" follow-up chip takes about 30 seconds, so avoid it on camera. If the run fails, switch to your fallback recording and say so.

## Script

**0:00. Hello**
"Hi, I'm [name]. In five minutes I'll show how the OpenAI API can help a breast cancer team get cases ready for tumor board."

**0:15. Slide 1, customer and problem**
"The customer is Lakeview Cancer Institute, a fictional regional cancer center. The people doing this work are breast oncologists and nurse navigators. Before each tumor board, someone reads pathology, imaging, genomics, clinic notes and the problem list in separate places, then checks the institution's treatment pathway. That takes an hour or more per case, and when two sources disagree it is easy to miss."

**0:45. Slide 2, before and after**
"Today it's manual. In the new workflow the oncologist asks for the case to be prepared. Specialists read each record and the pathway documents, a draft keeps facts and inference apart, a second check looks for problems, and the oncologist approves before anything is saved. This runs on the OpenAI Platform: the Responses API, the Agents SDK, File Search and MCP."
*(Click Prepare case, return to the slides.)*

**1:10. App, while it runs**
"This is the live run. Three specialists started together. Two of them read the patient record through an MCP server that stands in for the hospital's record system. The third is searching the institution's pathway documents with File Search, and PubMed for recent studies."

**1:40. Slide 3, agent graph**
"A case coordinator agent on the stronger model coordinates three specialists on a faster, cheaper model. A separate verifier checks the draft. Then the run pauses for the oncologist. All of it runs in the customer's own AWS account. Only model calls and the pathway search go to OpenAI."
*(Back to the app.)*

**2:00. Packet**
"Here is the draft. At the top, three points the board should know first, and chips for what needs attention. This box is the important one: the navigator's note says HER2 positive, but the signed pathology report says HER2 negative. The draft keeps the pathology result and flags the mismatch for correction. It also found a past blood clot, which matters for one hormone therapy option, and an older bone density scan."

**2:25. Source**
"Every statement has its source. If I click this tag, I see the actual pathology report behind it."

**2:40. Verifier**
"On the left, the verifier's findings, such as claims that were missing a source. The draft was fixed before I saw it."

**2:55. Follow-up question**
"A clinician can also ask questions. I'll click one: what does the pathway say about extending endocrine therapy? It answers from the packet and the pathway, says which source each statement comes from, and keeps its own inference separate. It doesn't change the packet."

**3:10. Request changes**
"The oncologist stays in control. I'll ask for a bone density plan on the aromatase inhibitor option."
*(Paste, send. Fifteen seconds later:)* "The agents revised the draft and sent it back for review."

**3:35. Approve**
"Nothing is saved until the oncologist approves. I'll approve, and the audit trail shows each step: started, awaiting review, changes requested, approved."

**3:45. Stats and trace**
"This run took about a minute and a half and cost roughly ten cents in model calls. And here is the full trace in OpenAI, so anyone can see what each agent did."

**4:00. Slides 4 and 5**
"On value: agent time and cost are measured on this case, and the checks for the planted problems passed in all ten test runs. The hours saved are my assumption, forty cases a month and preparation dropping from seventy-five minutes to twenty-five, so about thirty-three hours a month. A pilot would measure the real numbers. For safety, a clinician approves everything, nothing is written to the patient record, and before using real data we would confirm the contract terms. The next step is a four-week run on de-identified past cases."

**4:50. Close**
"Thanks for watching. Happy to take questions."

## If something goes wrong
- **Sign-in expired:** sign in again, then click Reset demo.
- **Run is slow:** keep narrating the feed, or cut to your fallback recording.
- **Error banner:** click Reset demo and run again.
