import * as Sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as apigateway  from '@aws-cdk/aws-apigateway';
import lambda = require('@aws-cdk/aws-lambda');
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import cloudwatch = require('@aws-cdk/aws-cloudwatch');
import { SnsAction } from '@aws-cdk/aws-cloudwatch-actions';
import * as sns from '@aws-cdk/aws-sns';
import * as snsSubscriptions from '@aws-cdk/aws-sns-subscriptions';

export class MeetSqsStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // region ---------------------------------------------------------------- dead letter queue & its consumer
    const dlq = new Sqs.Queue(this, 'dlq', {
      visibilityTimeout: cdk.Duration.seconds(300)
    });

    const dlqConsumer = new lambda.Function(this, 'dlqConsumer', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambdas'),
      handler: 'dlqConsumer.handler',
      environment: {
        TableName: table.tableName
      },
    });
    dlqConsumer.addEventSource(new SqsEventSource(dlq));
    table.grantReadWriteData(dlqConsumer);
    // endregion

    // region ---------------------------------------------------------------- main queue & its consumer
    const queue = new Sqs.Queue(this, 'queue', {
      visibilityTimeout: cdk.Duration.seconds(120),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    const { EMAIL } = process.env;  // If you add a .env file with your email and confirm the subscription clicking on the link sent to you => you will receive an email when the alarm goes off
    console.log('EMAIL', EMAIL);
    if (EMAIL) {
      const alarmTopic = new sns.Topic(this, 'errorTopic');
      alarmTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(
          EMAIL,
        ),
      );
      new cloudwatch.Alarm(this, 'Age of oldest msg > 200s', {
        metric: queue.metricApproximateAgeOfOldestMessage(),
        threshold: 200,
        period: cdk.Duration.minutes(1),
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
      }).addAlarmAction(new SnsAction(alarmTopic));
    }

    const consumer = new lambda.Function(this, 'consumer', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambdas'),
      handler: 'consumer.handler',
      timeout: cdk.Duration.seconds(15),  // Greater than the 10s it takes to the consumer to do the simulated processing
      reservedConcurrentExecutions: 5,
      environment: {
        TableName: table.tableName
      },
    });
    consumer.addEventSource(new SqsEventSource(queue));
    table.grantReadWriteData(consumer);
    // endregion

    // region ---------------------------------------------------------------- API Gateway to SQS integration
    const credentialsRole = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    credentialsRole.attachInlinePolicy(
      new iam.Policy(this, "SendMessagePolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["sqs:SendMessage"],
            effect: iam.Effect.ALLOW,
            resources: [queue.queueArn],
          }),
        ],
      })
    );

    const api = new apigateway.RestApi(this, id+"-RestApi", {
      deployOptions: {
        stageName: "run",
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
    });

    const sqs = api.root.addResource("sqs");
    sqs.addMethod(
      "POST",
      new apigateway.AwsIntegration({
        service: "sqs",
        path: `${cdk.Aws.ACCOUNT_ID}/${queue.queueName}`,
        integrationHttpMethod: "POST",
        options: {
          credentialsRole,
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          requestParameters: {
            "integration.request.header.Content-Type": `'application/x-www-form-urlencoded'`,
          },
          requestTemplates: {
            // "application/json": `Action=SendMessage&MessageBody=$util.urlEncode("$method.request.querystring.message")`,
            "application/json": `Action=SendMessage&MessageBody=$input.body`,
          },
          integrationResponses: [
            {
              statusCode: "200",
              responseTemplates: {
                // "application/json": `{"done": true}`,
                'application/json': JSON.stringify({ message: '$util.escapeJavaScript($input.body)'}),
              },
            },
          ],
        },
      }),
      { methodResponses: [{ statusCode: "200" }] }
    );
    // endregion

  }
}
