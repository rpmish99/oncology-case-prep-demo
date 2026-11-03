// Builds the one-slide architecture artifact (docs/architecture.pptx).
// AWS service icons come from the AWS Architecture Icons package, which is not stored in this repo.
// Point ICON_DIR at a folder of PNGs named amplify, cognito, agentcore, lambda, dynamodb, secrets, ecr, cloudwatch,
// cdk, users and awscloud.
const pptxgen = require("pptxgenjs");
const path = require("path");

const ICON_DIR = process.env.ICON_DIR || "/tmp/awsicons/png";
const REPO_URL = "https://github.com/rpmish99/oncology-case-prep-demo";
const icon = (n) => path.join(ICON_DIR, `${n}.png`);

const INK = "17212B", MUTED = "5F6B76", TEAL = "0F766E", PURPLE = "534AB7", AMBER = "B45309", GRAY = "888780";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "Architecture: AI-augmented tumor board case prep";
pres.author = "Rupesh Mishra";
const s = pres.addSlide();
s.background = { color: "FFFFFF" };

const text = (t, o) => s.addText(t, { margin: 0, isTextBox: true, fontFace: "Calibri", color: INK, valign: "top", ...o });
const box = (x, y, w, h, o) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: o.fill || "FFFFFF" }, line: { color: o.line || GRAY, width: o.lw || 1, dashType: o.dash ? "dash" : "solid" }, objectName: o.name });
const line = (x1, y1, x2, y2, arrow = true) =>
  s.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: "4B5563", width: 1.5, endArrowType: arrow ? "triangle" : undefined },
  });
const badge = (n, cx, cy) => {
  s.addShape(pres.shapes.OVAL, { x: cx - 0.16, y: cy - 0.16, w: 0.32, h: 0.32, fill: { color: TEAL }, line: { color: "FFFFFF", width: 1.5 }, objectName: `Step ${n}` });
  text(String(n), { x: cx - 0.16, y: cy - 0.16, w: 0.32, h: 0.32, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", objectName: `Step ${n} number` });
};
// A service node: icon on the left, name and what it does on the right.
const node = (x, y, w, h, ic, name, sub, o = {}) => {
  box(x, y, w, h, { line: "C9CED6", name: `${name} node` });
  s.addImage({ path: icon(ic), x: x + 0.1, y: y + (h - 0.55) / 2, w: 0.55, h: 0.55, altText: `${name} icon`, objectName: `${name} icon` });
  text([
    { text: name, options: { bold: true, fontSize: 12, breakLine: true } },
    { text: sub, options: { fontSize: 11, color: MUTED } },
  ], { x: x + 0.75, y: y + 0.08, w: w - 0.82, h: h - 0.12, valign: "middle", objectName: `${name} text`, ...o });
};

// ---------- title ----------
text("Architecture: AI-augmented tumor board case prep", { x: 0.4, y: 0.25, w: 12.5, h: 0.5, fontSize: 28, bold: true, fontFace: "Cambria", objectName: "Title" });
text("People, AWS services and the OpenAI Platform. Numbers follow one request.", { x: 0.4, y: 0.78, w: 12.5, h: 0.3, fontSize: 14, color: MUTED, objectName: "Subtitle" });

// ---------- users ----------
s.addImage({ path: icon("users"), x: 0.75, y: 3.25, w: 0.7, h: 0.7, altText: "Users icon", objectName: "Users icon" });
text([
  { text: "Tumor board panel", options: { bold: true, fontSize: 12, breakLine: true } },
  { text: "Navigators and clinicians, in a browser", options: { fontSize: 11, color: MUTED } },
], { x: 0.2, y: 4.05, w: 1.8, h: 0.9, align: "center", objectName: "Users text" });

// ---------- AWS Cloud group ----------
box(2.45, 1.2, 7.55, 4.95, { line: "F59E0B", lw: 1.5, fill: "FFFFFF", name: "AWS Cloud group" });
s.addImage({ path: icon("awscloud"), x: 2.55, y: 1.27, w: 0.38, h: 0.38, altText: "AWS Cloud icon", objectName: "AWS Cloud icon" });
text("AWS Cloud: customer account, us-east-1", { x: 3.0, y: 1.3, w: 4.5, h: 0.3, fontSize: 12, bold: true, color: "7A4A08", objectName: "AWS Cloud label" });

// front door
box(2.65, 1.8, 4.1, 1.3, { line: GRAY, dash: true, fill: "FAFAF7", name: "Front door group" });
text("Front end and sign-in", { x: 2.75, y: 1.84, w: 3.0, h: 0.25, fontSize: 11, bold: true, color: MUTED, objectName: "Front door label" });
node(2.75, 2.12, 1.95, 0.9, "amplify", "AWS Amplify Hosting", "React app");
node(4.8, 2.12, 1.85, 0.9, "cognito", "Amazon Cognito", "Sign-in, JWT");

// build and operate group
box(7.0, 1.8, 2.85, 1.3, { line: GRAY, dash: true, fill: "FAFAF7", name: "Build group" });
text("Build and operate", { x: 7.1, y: 1.84, w: 2.5, h: 0.25, fontSize: 11, bold: true, color: MUTED, objectName: "Build label" });
[["ecr", "Amazon ECR", 7.1], ["cloudwatch", "Amazon CloudWatch", 7.95], ["cdk", "AWS CDK", 8.8]].forEach(([ic, name, x]) => {
  s.addImage({ path: icon(ic), x: x + 0.2, y: 2.12, w: 0.45, h: 0.45, altText: `${name} icon`, objectName: `${name} icon` });
  text(name, { x: x - 0.02, y: 2.62, w: 0.9, h: 0.42, fontSize: 10, align: "center", objectName: `${name} label` });
});

// AgentCore
box(2.65, 3.4, 7.2, 1.45, { line: PURPLE, lw: 1.5, fill: "F5F4FF", name: "AgentCore group" });
s.addImage({ path: icon("agentcore"), x: 2.75, y: 3.5, w: 0.55, h: 0.55, altText: "Amazon Bedrock AgentCore icon", objectName: "AgentCore icon" });
text([
  { text: "Amazon Bedrock AgentCore Runtime", options: { bold: true, fontSize: 13, breakLine: true } },
  { text: "OpenAI Agents SDK in a container. Six agents:", options: { fontSize: 11, color: MUTED } },
], { x: 3.4, y: 3.5, w: 6.3, h: 0.55, objectName: "AgentCore text" });
[["Case coordinator agent", 2.75, 4.12], ["Patient data agent", 4.5, 4.12], ["Clinical history agent", 6.25, 4.12], ["Evidence agent", 8.0, 4.12],
 ["Similar cases agent", 2.75, 4.48], ["Verifier agent", 4.5, 4.48]].forEach(([t, x, y]) => {
  box(x, y, 1.7, 0.3, { line: PURPLE, fill: "EEEDFE", name: t });
  text(t, { x, y, w: 1.7, h: 0.3, fontSize: 11, bold: true, color: "3C3489", align: "center", valign: "middle", objectName: `${t} text` });
});
text("The coordinator starts the four specialists together, then the verifier checks the draft.", { x: 6.25, y: 4.48, w: 3.5, h: 0.32, fontSize: 10, color: MUTED, objectName: "Agent note" });

// supporting services
node(2.65, 5.1, 2.3, 0.95, "lambda", "AWS Lambda", "MCP server: masked record and past cases");
node(5.1, 5.1, 2.3, 0.95, "dynamodb", "Amazon DynamoDB", "Run state, audit trail, daily run cap");
node(7.55, 5.1, 2.3, 0.95, "secrets", "AWS Secrets Manager", "OpenAI key and MCP token");

// ---------- OpenAI Platform ----------
box(10.35, 1.2, 2.65, 3.05, { line: PURPLE, lw: 1.5, fill: "FFFFFF", name: "OpenAI group" });
text("OpenAI Platform", { x: 10.45, y: 1.27, w: 2.4, h: 0.3, fontSize: 13, bold: true, color: "3C3489", objectName: "OpenAI label" });
[["Responses API", "gpt-6.1-sol: coordinator, verifier\ngpt-6.1-terra: specialists", 1.65, 0.95],
 ["File Search", "Oncology Care Guidelines, versioned", 2.7, 0.62],
 ["Tracing", "Run traces for review", 3.42, 0.62]].forEach(([n, sub, y, h]) => {
  box(10.45, y, 2.45, h, { line: "C9C6F0", fill: "F5F4FF", name: n });
  text([{ text: n, options: { bold: true, fontSize: 12, breakLine: true } }, { text: sub, options: { fontSize: 10, color: MUTED } }], { x: 10.52, y: y + 0.05, w: 2.3, h: h - 0.08, objectName: `${n} text` });
});

// ---------- public sources ----------
box(10.35, 4.55, 2.65, 1.6, { line: GRAY, dash: true, fill: "FAFAF7", name: "Public sources group" });
text("Public sources", { x: 10.45, y: 4.62, w: 2.4, h: 0.3, fontSize: 13, bold: true, color: MUTED, objectName: "Public label" });
[["PubMed", "Recent literature", 4.98], ["ClinicalTrials.gov", "Open trials, on request", 5.5]].forEach(([n, sub, y]) => {
  box(10.45, y, 2.45, 0.46, { line: "D6D3CB", fill: "FFFFFF", name: n });
  text([{ text: n, options: { bold: true, fontSize: 11 } }, { text: `  ${sub}`, options: { fontSize: 10, color: MUTED } }], { x: 10.52, y: y, w: 2.3, h: 0.46, valign: "middle", objectName: `${n} text` });
});

// ---------- arrows and numbers (no line crosses another) ----------
line(1.1, 3.25, 1.1, 2.45, false); line(1.1, 2.45, 2.65, 2.45); badge(1, 1.6, 2.45);          // 1 open app, sign in
line(1.45, 3.7, 2.65, 3.7); badge(2, 2.05, 3.7);                                             // 2 call agents with JWT
line(3.8, 4.85, 3.8, 5.1); badge(3, 3.8, 4.98);                                                 // 3 MCP server
line(6.25, 4.85, 6.25, 5.1); badge(4, 6.25, 4.98);                                              // 4 state and audit
line(8.7, 5.1, 8.7, 4.85); badge(5, 8.7, 4.98);                                                 // 5 secrets at start-up
line(9.85, 3.65, 10.35, 3.65); badge(6, 10.1, 3.65);                                            // 6 OpenAI
line(9.85, 4.7, 10.35, 4.7); badge(7, 10.1, 4.7);                                              // 7 public sources

// ---------- legend of numbers ----------
text([
  { text: "1 ", options: { bold: true, color: TEAL } }, { text: "Open the app and sign in.  " },
  { text: "2 ", options: { bold: true, color: TEAL } }, { text: "Call the agents with the sign-in token.  " },
  { text: "3 ", options: { bold: true, color: TEAL } }, { text: "Read the masked record and past cases by MCP.  " },
  { text: "4 ", options: { bold: true, color: TEAL } }, { text: "Save run state and audit trail.  " },
  { text: "5 ", options: { bold: true, color: TEAL } }, { text: "Fetch keys at start-up.  " },
  { text: "6 ", options: { bold: true, color: TEAL } }, { text: "Model calls and guideline search.  " },
  { text: "7 ", options: { bold: true, color: TEAL } }, { text: "Literature and trials." },
], { x: 0.4, y: 6.22, w: 12.5, h: 0.42, fontSize: 11, objectName: "Number legend" });

// ---------- safeguards and link ----------
box(0.4, 6.68, 12.6, 0.42, { line: "BFE3DC", fill: "E8F5F2", name: "Safeguards band" });
text([
  { text: "Safeguards: ", options: { bold: true, color: TEAL } },
  { text: "names, record numbers and birth dates masked before any model call. Sign-in required on every request. A clinician approves before anything is saved. No write-back to patient records. Every step is logged." },
], { x: 0.5, y: 6.68, w: 12.4, h: 0.42, fontSize: 11, valign: "middle", objectName: "Safeguards text" });
text([
  { text: "Source code and deployment: ", options: { color: MUTED } },
  { text: "github.com/rpmish99/oncology-case-prep-demo", options: { hyperlink: { url: REPO_URL }, color: "1F5FBF", underline: { style: "sng" }, bold: true } },
], { x: 0.4, y: 7.16, w: 12.5, h: 0.28, fontSize: 12, objectName: "Repository link" });

s.addNotes("One request, left to right. A panel member opens the React app (hosted on AWS Amplify) and signs in with Amazon Cognito. The app calls the agents on Amazon Bedrock AgentCore Runtime with the sign-in token. The agents read a masked record and past cases through an MCP server on AWS Lambda, call the OpenAI Platform for the models and for File Search over the Oncology Care Guidelines, and query PubMed. Run state and the audit trail go to Amazon DynamoDB. Keys come from AWS Secrets Manager. Images, logs and deployment use Amazon ECR, Amazon CloudWatch and the AWS CDK.");

pres.writeFile({ fileName: path.resolve(__dirname, "../docs/architecture.pptx") }).then((f) => console.log("wrote", f));
