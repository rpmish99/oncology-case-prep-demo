import * as cdk from "aws-cdk-lib";
import { CasePrepStack } from "../lib/stack.js";

const app = new cdk.App();
new CasePrepStack(app, "CasePrepDemo", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
});
