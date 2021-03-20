#!/usr/bin/env node
require('dotenv').config({ path: __dirname+'/../.env' });
import * as cdk from '@aws-cdk/core';
import { MeetSqsStack } from '../lib/meet-sqs-stack';

const app = new cdk.App();
new MeetSqsStack(app, 'MeetSqsStack');
