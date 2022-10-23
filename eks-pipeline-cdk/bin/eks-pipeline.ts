#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EksPipelineStack } from '../lib/eks-pipeline-stack';
import { K8sPipelineStack } from '../lib/k8s-pipeline-stack';

const app = new cdk.App();
const ekspipeline = new EksPipelineStack(app, 'EksPipelineStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
});

const k8spipeline = new K8sPipelineStack(app, 'K8sPipelineStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
});

k8spipeline.node.addDependency(ekspipeline);
