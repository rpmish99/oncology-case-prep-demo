import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/**
 * In the deployed container the OpenAI key and MCP token come from Secrets Manager rather than from
 * environment variables, so they never appear in the runtime configuration.
 */
const id = process.env.OPENAI_SECRET_ID;
if (id) {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const out = await client.send(new GetSecretValueCommand({ SecretId: id }));
  const values = JSON.parse(out.SecretString ?? "{}") as Record<string, string>;
  process.env.OPENAI_API_KEY ??= values.OPENAI_API_KEY;
  process.env.MCP_TOKEN ??= values.MCP_TOKEN;
}
