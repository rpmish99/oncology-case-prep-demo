# Oncology case prep demo

A demo of how the OpenAI Platform (Responses API, Agents SDK, File Search, MCP) can help a breast
oncology team prepare a case for tumor board. All patient data and guideline documents are synthetic.
This is a demonstration, not a medical device, and it does not give treatment advice.

## What it does
A manager agent asks three specialists (patient data, clinical history, evidence) for sourced findings,
drafts a structured packet, has a separate verifier agent check it, then pauses for a clinician to approve
or request changes. Nothing is written to a patient record.

## Layout
- `agent/` agent code (TypeScript, OpenAI Agents SDK) and an HTTP server
- `mcp-server/` mock patient record exposed as an MCP server
- `data/` synthetic case files and synthetic institutional pathway documents
- `docs/` architecture and demo notes

## Run locally
1. `cp agent/.env.example agent/.env` and fill in `OPENAI_API_KEY`.
2. `cd mcp-server && npm i && MCP_TOKEN=local-dev-token npm run dev`
3. `cd agent && npm i && npm run seed` (copy the printed `VECTOR_STORE_ID` into `.env`), then `npm run cli`.
