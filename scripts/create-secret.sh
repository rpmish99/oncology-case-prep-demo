#!/usr/bin/env bash
# Creates (or updates) the Secrets Manager secret the deployed agent reads.
# Reads OPENAI_API_KEY from agent/.env and generates a random MCP token. Prints neither.
set -euo pipefail

PROFILE="${AWS_PROFILE:-default}"
REGION="us-east-1"
NAME="case-prep-demo/secrets"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
chmod 600 "$TMP"

ROOT="$ROOT" python3 -I - >"$TMP" <<'PY'
import json, os, secrets
key = ""
for line in open(os.path.join(os.environ["ROOT"], "agent", ".env")):
    if line.startswith("OPENAI_API_KEY="):
        key = line.split("=", 1)[1].strip()
assert key.startswith("sk-"), "OPENAI_API_KEY is missing in agent/.env"
print(json.dumps({"OPENAI_API_KEY": key, "MCP_TOKEN": secrets.token_urlsafe(32)}))
PY

if aws secretsmanager describe-secret --secret-id "$NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "$NAME" --secret-string "file://$TMP" \
    --profile "$PROFILE" --region "$REGION" --query Name --output text
else
  aws secretsmanager create-secret --name "$NAME" --secret-string "file://$TMP" \
    --profile "$PROFILE" --region "$REGION" --query Name --output text
fi
echo "Secret ready."
