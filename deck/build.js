const pptxgen = require("pptxgenjs");
const path = require("path");
const { applyTheme } = require(
  "/Users/rupeshmishra/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/f7f26c42-0bcf-42bb-82c9-cefc9e4a4c4b/c49ac775-14da-419a-9e23-a2d67fb542e1/skills/pptx/scripts/apply_theme.js"
);

const THEME = {
  name: "Case prep",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "17212B", lt1: "FFFFFF", dk2: "0B3D3A", lt2: "EEF4F2",
    accent1: "0F766E", accent2: "C2410C", accent3: "534AB7",
    accent4: "5F6B76", accent5: "B45309", accent6: "2563EB",
    hlink: "0F766E", folHlink: "5F6B76",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Powering AI-Augmented Tumor Boards with OpenAI";
pres.author = "Rupesh Mishra";
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: "TITLE",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.5, w: 11.7, h: 2.1, fontSize: 44, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  slideNumber: { x: 12.4, y: 7.0, w: 0.5, h: 0.3, color: "A9C7C2", fontSize: 10 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.5, w: 12.1, h: 1.0, fontSize: 34, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "LIGHT",
  background: { color: C.background1 },
  slideNumber: { x: 12.4, y: 7.0, w: 0.5, h: 0.3, color: "5F6B76", fontSize: 10 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.45, w: 12.1, h: 0.9, fontSize: 32, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});


// Presenter notes are kept in a local, git-ignored file. Set WITH_NOTES=1 to include them.
let NOTES = {};
if (process.env.WITH_NOTES === "1") NOTES = require("./notes.local.js")(path, __dirname);
const addNotes = (slide, key) => { if (NOTES[key]) slide.addNotes(NOTES[key]()); };

const card = (slide, x, y, w, h, name, fill) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: fill || C.background2 }, line: { color: fill || C.background2 }, objectName: name,
  });
const text = (slide, t, o) => slide.addText(t, { margin: 0, isTextBox: true, valign: "top", ...o });

// ---------- 0. Title ----------
pres.addSection({ title: "Title" });
{
  const s = pres.addSlide({ masterName: "TITLE", sectionTitle: "Title" });
  s.addText("Powering AI-Augmented Tumor Boards with OpenAI", { placeholder: "title" });
  text(s, "From scattered records to a verified case brief, on demand, in about a minute and a half", { x: 0.8, y: 3.7, w: 11.0, h: 0.9, fontSize: 22, color: "9FD8CF", objectName: "Subtitle" });
  text(s, [
    { text: "Rupesh Mishra", options: { bold: true, fontSize: 22, color: C.background1, breakLine: true } },
    { text: "Take-home for the Applied AI Architect, Healthcare and Life Sciences role at OpenAI", options: { fontSize: 16, color: "CFE5E1" } },
  ], { x: 0.8, y: 5.3, w: 11.5, h: 1.0, objectName: "Presenter" });
  addNotes(s, "title");
}

// ---------- 1. Problem ----------
pres.addSection({ title: "Setup" });
{
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Setup" });
  s.addText("The problem: tumor board preparation does not scale", { placeholder: "title" });
  text(s, "Customer: Lakeview Cancer Institute (fictional), with weekly tumor boards for breast, lung and colon cancer.", { x: 0.6, y: 1.35, w: 7.2, h: 0.5, fontSize: 14, color: C.accent4, objectName: "Customer line" });

  const pains = [
    ["Every discipline prepares its own piece", "The coordinator (usually a nurse) gathers the records, and pathology, radiology and genomics each prepare a part. In one breast board study, nurse navigators averaged 36 minutes per case."],
    ["Very little time per case", "Discussion averaged about 5 to 7 minutes per case in that study, so what reaches the board has to be right."],
    ["Evidence moves faster than anyone can track", "Oncologists must follow current guidelines, new studies and open trials for each patient."],
    ["Records disagree and nobody has time to compare", "A note says one thing and the signed report another. Easy to miss by eye."],
  ];
  pains.forEach(([head, body], i) => {
    const y = 1.95 + i * 1.18;
    s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.03, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Pain badge ${i + 1}` });
    text(s, String(i + 1), { x: 0.6, y: y + 0.03, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", objectName: `Pain number ${i + 1}` });
    text(s, [
      { text: head, options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } },
      { text: body, options: { fontSize: 14, color: C.text1 } },
    ], { x: 1.2, y, w: 6.5, h: 1.1, objectName: `Pain ${i + 1}` });
  });

  const stats = [
    ["35 million", "new cancer cases a year by 2050, up 77% from 2022, mostly from population growth and aging"],
    ["1 in 4", "cancers in the EU is rare. Five-year survival is lower (48.5% versus 63.4%) and expertise is concentrated in few centers"],
    ["25 to 50%", "of cases see management change after board review in published single-center studies"],
  ];
  stats.forEach(([big, small], i) => {
    const y = 1.45 + i * 1.62;
    card(s, 8.1, y, 4.65, 1.5, `Stat card ${i + 1}`, C.text2);
    text(s, big, { x: 8.35, y: y + 0.1, w: 4.2, h: 0.55, fontSize: 28, bold: true, color: C.background1, valign: "middle", objectName: `Stat ${i + 1}` });
    text(s, small, { x: 8.35, y: y + 0.68, w: 4.2, h: 0.78, fontSize: 14, color: "CFE5E1", objectName: `Stat label ${i + 1}` });
  });
  text(s, "The opportunity: prepare every case on demand, and share expertise beyond a single institution.", { x: 0.6, y: 6.5, w: 12.1, h: 0.4, fontSize: 16, bold: true, color: C.accent1, objectName: "Opportunity" });
  text(s, "Sources: JONS 2019 (breast board preparation); GLOBOCAN 2022 (Bray et al., CA Cancer J Clin 2024); RARECAREnet (Lancet Oncol 2017); single-center board studies. Figures are from specific studies and years.", { x: 0.6, y: 6.95, w: 11.6, h: 0.4, fontSize: 10, color: C.accent4, objectName: "Sources" });
  addNotes(s, "problem");
}

// ---------- 2. Workflow ----------
{
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Setup" });
  s.addText("From manual case assembly to AI-prepared case briefs", { placeholder: "title" });

  const before = [
    "Coordinator pulls the case list and gathers the records",
    "Pathology, radiology and genomics each prepare their part",
    "Oncologists look up guidelines, studies and trials",
    "Someone compares the sources by eye and builds the slides",
    "The board has about 5 to 7 minutes per case",
  ];
  const after = [
    "Coordinator picks a case and asks for it to be prepared",
    "Agents read the masked record, the Oncology Care Guidelines, PubMed and similar past cases",
    "A verifier agent checks the draft against its sources",
    "The panel reviews one brief, asks follow-up questions and requests changes",
    "A clinician approves. The note and audit trail are saved",
  ];
  [["Today", before, 0.6, C.text1], ["With AI-augmented preparation", after, 6.85, C.accent1]].forEach(([head, items, x, col]) => {
    card(s, x, 1.5, 5.9, 4.3, `${head} card`);
    text(s, head, { x: x + 0.3, y: 1.65, w: 5.3, h: 0.5, fontSize: 20, bold: true, color: col, objectName: `${head} heading` });
    text(s,
      items.map((t, i) => ({ text: t, options: { bullet: { type: "number", numberStartAt: i + 1 }, breakLine: i < items.length - 1, paraSpaceAfter: 10 } })),
      { x: x + 0.3, y: 2.25, w: 5.3, h: 3.4, fontSize: 16, color: C.text1, objectName: `${head} steps` });
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 6.0, w: 12.15, h: 1.0, rectRadius: 0.12, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: "Surface banner" });
  text(s, [
    { text: "Built on the OpenAI Platform: ", options: { bold: true } },
    { text: "Responses API (models), Agents SDK (agents), File Search (guidelines), MCP (record and past cases) and tracing. The agents run in the customer's AWS account and call OpenAI over its API." },
  ], { x: 0.85, y: 6.05, w: 11.65, h: 0.9, fontSize: 16, color: C.background1, valign: "middle", objectName: "Surface text" });
  addNotes(s, "workflow");
}

// ---------- 3. How it works ----------
pres.addSection({ title: "Demo" });
{
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Demo" });
  s.addText("How it works: people, agents and data", { placeholder: "title" });
  s.addImage({ path: path.resolve(__dirname, "../docs/agent-graph.png"), x: 0.5, y: 1.35, w: 8.3, h: 5.63, altText: "Diagram: the tumor board panel (coordinator, medical, surgical and radiation oncology, pathology, radiology) sends a request (1) to a case coordinator agent. The coordinator starts four specialist agents in parallel (2): patient data, clinical history, evidence and similar cases. They read the masked patient record and past cases registry through MCP servers, the Oncology Care Guidelines through File Search, and PubMed and ClinicalTrials.gov (3). The coordinator hands its draft to a verifier agent (4), and the result returns to the panel for review and approval (5).", objectName: "How it works diagram" });

  const steps = [
    ["1", "A coordinator or oncologist picks a case and asks for it to be prepared."],
    ["2", "The case coordinator agent starts four specialist agents at the same time."],
    ["3", "They read the masked record and past cases by MCP, search the Oncology Care Guidelines with File Search, and query PubMed."],
    ["4", "The coordinator drafts one brief. A verifier agent checks every claim against its source."],
    ["5", "The panel reviews, asks follow-up questions, requests changes and approves. Only then is the note saved, with an audit trail."],
  ];
  const ys = [1.4, 2.35, 3.2, 4.6, 5.75];
  steps.forEach(([n, d], i) => {
    const y = ys[i];
    s.addShape(pres.shapes.OVAL, { x: 9.05, y, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `Step badge ${n}` });
    text(s, n, { x: 9.05, y, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", objectName: `Step number ${n}` });
    text(s, d, { x: 9.65, y: y - 0.04, w: 3.1, h: 1.3, fontSize: 14, color: C.text1, objectName: `Step text ${n}` });
  });
  addNotes(s, "how");
}

// ---------- 5. Value ----------
pres.addSection({ title: "Value" });
{
  const s = pres.addSlide({ masterName: "LIGHT", sectionTitle: "Value" });
  s.addText("Value: more cases, fewer misses, current evidence", { placeholder: "title" });

  const cards = [
    ["More cases, same effort", "Preparation falls from about 75 to about 25 minutes a case (assumed), so the same prep hours cover about 3 times the cases.", "Agents work in parallel: about 85 seconds per case (measured)."],
    ["Fewer misses before the meeting", "Every planted record conflict and gap was caught across 20 runs (170 of 170 checks). Boards change management in 25 to 50% of cases, so what reaches them matters.", "A separate verifier agent, structured outputs and traces."],
    ["Current evidence on every case", "Each case is checked against versioned guidelines, PubMed and past cases. Superseded documents are left out.", "File Search over guideline versions, plus PubMed calls."],
    ["Expertise beyond one institution", "The same agents serve every tumor type and site: add guidelines and past cases, not code. Rare cancers, about 1 in 4 in the EU, gain the most from pooled expertise.", "General reasoning and MCP links to each site's data."],
  ];
  cards.forEach(([head, impact, how], i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 1.45 + Math.floor(i / 2) * 2.45;
    card(s, x, y, 6.0, 2.33, `Value card ${i + 1}`);
    text(s, head, { x: x + 0.25, y: y + 0.12, w: 5.5, h: 0.4, fontSize: 18, bold: true, color: C.accent1, objectName: `Value head ${i + 1}` });
    text(s, impact, { x: x + 0.25, y: y + 0.52, w: 5.5, h: 0.85, fontSize: 14, color: C.text1, objectName: `Value impact ${i + 1}` });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.25, y: y + 1.42, w: 5.5, h: 0.8, rectRadius: 0.08, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: `Value OpenAI band ${i + 1}` });
    text(s, [{ text: "OpenAI: ", options: { bold: true } }, { text: how }], { x: x + 0.4, y: y + 1.44, w: 5.2, h: 0.76, fontSize: 14, color: C.background1, valign: "middle", objectName: `Value OpenAI ${i + 1}` });
  });

  text(s, [
    { text: "Measured: ", options: { bold: true } },
    { text: "about 85 seconds and about 10 cents of model cost per case. " },
    { text: "Assumed: ", options: { bold: true } },
    { text: "40 cases a month and 75 down to 25 minutes, about 33 hours a month. " },
    { text: "Next: ", options: { bold: true } },
    { text: "a 4-week pilot on 50 de-identified past cases, compared with board notes." },
  ], { x: 0.6, y: 6.4, w: 12.1, h: 0.6, fontSize: 14, color: C.text1, objectName: "Value footer" });
  addNotes(s, "value");
}

(async () => {
  const out = process.env.OUT || path.resolve(__dirname, "case-prep-deck.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
})();
