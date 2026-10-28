import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "node:path";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";

const root = path.resolve(import.meta.dirname, "../..");

export class CasePrepStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Created outside this stack so the key never appears in a template.
    const appSecret = secrets.Secret.fromSecretNameV2(this, "AppSecret", "case-prep-demo/secrets");

    const table = new dynamodb.Table(this, "Runs", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const pool = new cognito.UserPool(this, "Users", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const client = pool.addClient("Web", {
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
    });

    // Mock patient record, served as an MCP server behind a function URL (bearer token required).
    const ehr = new lambda.DockerImageFunction(this, "MockEhr", {
      architecture: lambda.Architecture.ARM_64,
      code: lambda.DockerImageCode.fromImageAsset(root, {
        file: "mcp-server/Dockerfile",
        platform: ecrAssets.Platform.LINUX_ARM64,
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        MCP_TOKEN: appSecret.secretValueFromJson("MCP_TOKEN").unsafeUnwrap(),
      },
    });
    const ehrUrl = ehr.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    const agentImage = new ecrAssets.DockerImageAsset(this, "AgentImage", {
      directory: path.join(root, "agent"),
      platform: ecrAssets.Platform.LINUX_ARM64,
    });

    const role = new iam.Role(this, "AgentRole", {
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com", {
        conditions: {
          StringEquals: { "aws:SourceAccount": this.account },
          ArnLike: { "aws:SourceArn": `arn:aws:bedrock-agentcore:${this.region}:${this.account}:*` },
        },
      }),
    });
    agentImage.repository.grantPull(role);
    table.grantReadWriteData(role);
    appSecret.grantRead(role);
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams", "logs:DescribeLogGroups"],
        resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:/aws/bedrock-agentcore/runtimes/*`, `arn:aws:logs:${this.region}:${this.account}:log-group:*`],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "cloudwatch:PutMetricData"],
        resources: ["*"],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock-agentcore:GetWorkloadAccessToken", "bedrock-agentcore:GetWorkloadAccessTokenForJWT", "bedrock-agentcore:GetWorkloadAccessTokenForUserId"],
        resources: [`arn:aws:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default`, `arn:aws:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/default/workload-identity/*`],
      }),
    );

    const runtime = new agentcore.CfnRuntime(this, "Agent", {
      agentRuntimeName: "case_prep_agent",
      description: "Tumor board case preparation agent",
      roleArn: role.roleArn,
      agentRuntimeArtifact: { containerConfiguration: { containerUri: agentImage.imageUri } },
      networkConfiguration: { networkMode: "PUBLIC" },
      protocolConfiguration: "HTTP",
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl: `https://cognito-idp.${this.region}.amazonaws.com/${pool.userPoolId}/.well-known/openid-configuration`,
          allowedClients: [client.userPoolClientId],
        },
      },
      environmentVariables: {
        OPENAI_SECRET_ID: "case-prep-demo/secrets",
        OPENAI_MODEL: this.node.tryGetContext("model") ?? "gpt-6.1-sol",
        SPECIALIST_MODEL: "gpt-6.1-terra",
        REASONING_EFFORT: "low",
        DAILY_RUN_LIMIT: "40",
        VECTOR_STORE_ID: this.node.tryGetContext("vectorStoreId") ?? "",
        MCP_URL: `${ehrUrl.url}mcp`,
        TABLE_NAME: table.tableName,
      },
    });
    runtime.node.addDependency(role);

    new cdk.CfnOutput(this, "UserPoolId", { value: pool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: client.userPoolClientId });
    new cdk.CfnOutput(this, "AgentRuntimeArn", { value: runtime.attrAgentRuntimeArn });
    new cdk.CfnOutput(this, "McpUrl", { value: `${ehrUrl.url}mcp` });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
  }
}
