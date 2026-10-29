FROM --platform=linux/arm64 node:22-slim
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
WORKDIR /app/mcp-server
COPY mcp-server/package*.json ./
RUN npm ci
COPY mcp-server/tsconfig.json ./
COPY mcp-server/src ./src
RUN npx tsc
COPY data/cases /app/data/cases
COPY data/registry /app/data/registry
ENV PORT=8080 AWS_LWA_PORT=8080 DATA_DIR=/app/data
CMD ["node", "dist/server.js"]
