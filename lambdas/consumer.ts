import { SQSHandler } from 'aws-lambda';
const DynamoDB = require('aws-sdk/clients/dynamodb');
const DocumentClient = new DynamoDB.DocumentClient();
console.log('consumer root');

const { TableName } = process.env;

export const handler: SQSHandler = async (event) => {
  console.log('event', JSON.stringify(event, undefined, 2));

  const { Records } = event;
  const length = Records.length;
  console.log('Records.length', length);
  const max = 5;
  if (length > max) {
    // throw Error(`Records length greater than ${max}: ${Records.length}`);
  }

  for (let i = 0; i < length; i++) {
    const record = Records[i];
    console.log(`Records[${i}]`, record);
    const body = JSON.parse(record.body);
    console.log(body)

    if (i === 0 && body.unprocessable) {
      const { Item } = await DocumentClient.get({
        TableName,
        Key: {
          id: 'unprocessable'
        }
      }).promise();

      console.log('unprocessable Item got', Item);
      if (Item) {
        const { messageId } = Item;
        const messageIds = Records.map(r => r.messageId);
        if (messageIds.includes(messageId)) {
          throw Error(`The unprocessable message ${messageId} is in this chunk!`);
        }
      } else {
        await DocumentClient.put({
          TableName,
          Item: {
            id: 'unprocessable',
            messageId: record.messageId,
          },
        }).promise();
        throw Error(`unprocessable messageId ${record.messageId} put!`);
      }
    }
  }

  const delay = 10;
  await new Promise(resolve => setTimeout(() => {
    console.log(`Lambda finished processing after ${delay}s`);
    resolve();
  }, delay*1000));

  console.log('Ended without throwing error');

};
