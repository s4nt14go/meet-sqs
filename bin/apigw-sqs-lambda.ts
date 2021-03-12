#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ApigwSqsLambdaStack } from '../lib/apigw-sqs-lambda-stack';

const app = new cdk.App();
new ApigwSqsLambdaStack(app, 'ApigwSqsLambdaStack');
