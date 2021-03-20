// export {};
import { SQSHandler } from 'aws-lambda';
const DynamoDB = require('aws-sdk/clients/dynamodb');
const DocumentClient = new DynamoDB.DocumentClient();
console.log('consumer root');

const { TableName } = process.env;

export const handler: SQSHandler = async (event) => {
  console.log('event', JSON.stringify(event, undefined, 2));

  const { Records } = event;

  for (const record of Records) {
    await DocumentClient.put({
      TableName,
      Item: {
        ...record,
        id: record.messageId,
      },
    }).promise();
    console.log(`Record ${record.messageId} put`);
  }

};
