#!/usr/bin/env bash
# Creates the single demo sign-in user in the Cognito pool and prints a random password once.
# Run it yourself, then keep the password for your submission notes. It is not stored anywhere else.
set -euo pipefail

PROFILE="${AWS_PROFILE:-default}"
REGION="us-east-1"
EMAIL="${1:-reviewer@example.com}"
POOL_ID="$(aws cloudformation describe-stacks --stack-name CasePrepDemo --profile "$PROFILE" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)"

# Random password that satisfies the default pool policy (upper, lower, digit, symbol, 14+ chars).
PASSWORD="$(python3 -I -c 'import secrets,string; a=string.ascii_letters+string.digits; p="".join(secrets.choice(a) for _ in range(16)); print(p+"Aa1!")')"

if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$EMAIL" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "User $EMAIL already exists. Resetting the password."
else
  aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS --profile "$PROFILE" --region "$REGION" >/dev/null
fi
aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" --username "$EMAIL" --password "$PASSWORD" --permanent \
  --profile "$PROFILE" --region "$REGION"

echo "Demo user: $EMAIL"
echo "Password:  $PASSWORD"
