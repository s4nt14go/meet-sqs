#!/usr/bin/env node
require('dotenv').config({ path: __dirname+'/../.env' });
import * as cdk from '@aws-cdk/core';
import { ApigwSqsLambdaStack } from '../lib/apigw-sqs-lambda-stack';

const app = new cdk.App();
new ApigwSqsLambdaStack(app, 'ApigwSqsLambdaStack');
