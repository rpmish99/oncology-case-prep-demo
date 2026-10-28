# Recording kit: five-minute demo

Written to be read in your own words. Change anything that does not sound like you.
The live run takes about two and a half minutes, so start it early and talk while it works.

## Before you record (10 minutes)
1. Open the app, sign in, and click **Reset demo**. Reload the page once so the first run is not on a cold start.
2. Do one full dry run, including **Approve**. Then click **Reset demo** again.
3. Open the deck in presenter view. Open the app in a second window of the same size.
4. Close other tabs and notifications. Use a microphone close to your mouth.
5. Record with QuickTime (File, New Screen Recording, pick your microphone) and a separate camera clip, or use any tool that records screen and camera together.
6. Keep a finished recording of the dry run as a fallback if the live run is slow.

## Timeline

| Time | Screen | Camera | What to say |
|---|---|---|---|
| 0:00 | Camera, full frame | On | Short hello and what you will show. |
| 0:20 | Slide 1 | Small corner | The customer, the people who do this work, and the problem. |
| 0:50 | Slide 2 | Small corner | Before and after, and the product surface. **Before leaving this slide, switch to the app and click Prepare case, then return to the slide.** |
| 1:20 | App | Small corner | Narrate what the agents are doing while the run works. |
| 2:00 | Slide 3 | Small corner | Architecture in 20 seconds, then back to the app. |
| 2:30 | App | Small corner | Back to the live feed. |
| 3:20 | App, packet | Small corner | Walk through the packet: conflict, history, options, verifier. |
| 4:10 | App | Small corner | Click Approve. |
| 4:20 | Slides 4 and 5 | Small corner | Value, guardrails, next steps. |
| 4:55 | Camera | On | One-line close. |

If the run finishes later than 3:20, keep narrating the feed and shorten the packet walkthrough. If it
fails, switch to your fallback recording and say so.

## Script

**0:00. Hello**
"Hi, I'm [name]. In five minutes I'll show how the OpenAI API can help a breast cancer team get cases ready for tumor board."

**0:20. Slide 1, customer and problem**
"The customer is Lakeview Cancer Institute, a fictional regional cancer center. The people doing this work are breast oncologists and nurse navigators. Before each tumor board, someone reads pathology, imaging, genomics, clinic notes and the problem list in separate places, then checks the institution's treatment pathway. That takes an hour or more per case, and when two sources disagree it is easy to miss."

**0:50. Slide 2, before and after**
"Today it's manual: open each record, copy facts, look up the pathway, compare by eye. In the new workflow the oncologist asks for the case to be prepared. Specialists read each record and the pathway documents, a draft keeps facts and inference apart, a second check looks for problems, and the oncologist approves before anything is saved. This runs on the OpenAI Platform: the Responses API, the Agents SDK, File Search and MCP."
*(Switch to the app, click Prepare case, return to the slide.)*

**1:20. App, while it runs**
"This is the live run. A manager agent has asked a patient data specialist and a history specialist to read the record. They are reading pathology, imaging, genomics, the problem list and the clinic note through an MCP server that stands in for the hospital's record system. Now an evidence specialist is searching the institution's pathway documents with File Search, and PubMed for recent studies."

**2:00. Slide 3, architecture**
"The agents run in the customer's own AWS account. Only the model calls and the pathway search go to OpenAI. The patient record sits behind the MCP server, and every run and approval is logged."
*(Back to the app.)*

**3:20. Packet**
"Here is the draft. Patient facts, pathway text and the model's own inference are shown separately, and every statement has its source. This box is the important one: the navigator's note says HER2 positive, but the signed pathology report says HER2 negative. The draft keeps the pathology result and flags the mismatch for correction. It also found a past blood clot, which matters for one of the hormone therapy options, and noted that the bone density scan is two years old. These are options for the board, not a decision. Down here is what the verifier flagged, such as claims missing a source."

**4:10. Approve**
"Nothing is saved until the oncologist approves. I'll approve, and the draft note is saved and logged."

**4:20. Slides 4 and 5**
"On value, I assumed forty cases a month and preparation dropping from seventy-five minutes to twenty-five. That is about thirty-three hours a month. Those are assumptions, and a pilot would measure the real numbers. The bigger benefit is catching conflicts like the HER2 one before the meeting. For safety, a clinician approves everything, nothing is written to the patient record, and before using real data we would confirm the contract terms. The next step is a four-week run on de-identified past cases."

**4:55. Close**
"Thanks for watching. Happy to take questions."

## If something goes wrong
- **Sign-in expired:** sign in again, then click Reset demo.
- **Run is slow:** keep narrating the feed, or cut to your fallback recording.
- **Error banner:** click Reset demo and run again.
