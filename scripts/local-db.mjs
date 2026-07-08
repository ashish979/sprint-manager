/**
 * Create the sprint-manager table on DynamoDB Local and optionally seed the
 * admin allowlist.
 *
 *   docker compose up -d
 *   npm run db:local                       # create table
 *   ADMIN_SLACK_ID=U0123ABC npm run db:local   # + make that user an admin
 *
 * Matches the schema in sst.config.ts (pk/sk + GSI1).
 */
import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "sprint-manager-local";

const client = new DynamoDBClient({
  endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB || "http://localhost:8000",
  region: "local",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

try {
  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "gsi1pk", AttributeType: "S" },
        { AttributeName: "gsi1sk", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSI1",
          KeySchema: [
            { AttributeName: "gsi1pk", KeyType: "HASH" },
            { AttributeName: "gsi1sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }),
  );
  console.log(`✅ created table ${TABLE_NAME}`);
} catch (error) {
  if (error instanceof ResourceInUseException) {
    console.log(`table ${TABLE_NAME} already exists`);
  } else {
    throw error;
  }
}

const adminSlackId = process.env.ADMIN_SLACK_ID;
if (adminSlackId) {
  const doc = DynamoDBDocumentClient.from(client);
  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { pk: "TEAM", sk: "SETTINGS", adminSlackIds: [adminSlackId] },
    }),
  );
  console.log(`✅ seeded TEAM#SETTINGS with admin ${adminSlackId}`);
}
