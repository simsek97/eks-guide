import cdk = require('@aws-cdk/core');
import ecr = require('@aws-cdk/aws-ecr');
import eks = require('@aws-cdk/aws-eks');
import * as iam from '@aws-cdk/aws-iam';
import codebuild = require('@aws-cdk/aws-codebuild');
import codecommit = require('@aws-cdk/aws-codecommit');
import targets = require('@aws-cdk/aws-events-targets');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');

export interface k8sPipelineProps {
    eksRepo: codecommit.IRepository,
};

export class k8spipeline extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: k8sPipelineProps) {
        super(scope, id);

        const k8scodebuildrole = cdk.Fn.importValue('eksCodebuildRoleArn');

        const k8scodepipelinerole = new iam.Role(this, 'k8scodepipelinerole', {
            assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com')
          });
        k8scodepipelinerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"));

        const k8sEcr = new ecr.Repository(this, 'K8sEcr', {
            repositoryName: 'demo1',
        });

        const projectK8s = new codebuild.Project(this, 'K8sProject', {
            projectName: 'k8sProject',
            source: codebuild.Source.codeCommit({
                repository: props.eksRepo
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                privileged: true,
                environmentVariables: {
                    MyEcr: {
                        value: k8sEcr.repositoryUri
                    },
                    MyRole: {
                        value: k8scodebuildrole
                    },
                    AccID: {
                        value: cdk.Aws.ACCOUNT_ID
                    },
                    AccRegion: {
                        value: cdk.Aws.REGION
                    },
                    AlbSubnet1: {
                        value: this.node.tryGetContext('alb-subnet1')
                    },
                    AlbSubnet2: {
                        value: this.node.tryGetContext('alb-subnet2')
                    },
                    AlbSg: {
                        value: this.node.tryGetContext('alb-sg')
                    },
                },
            },
            role: iam.Role.fromRoleArn(this, 'k8scodebuildrole1', k8scodebuildrole),
            buildSpec: codebuild.BuildSpec.fromSourceFilename('k8sBuild.yaml'),
        });

        const projectSwap = new codebuild.Project(this, 'swapProject', {
            projectName: 'swapProject',
            source: codebuild.Source.codeCommit({
                repository: props.eksRepo
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                privileged: true,
                environmentVariables: {
                    MyRole: {
                        value: k8scodebuildrole
                    },
                },
            },
            role: iam.Role.fromRoleArn(this, 'k8scodebuildrole2', k8scodebuildrole),
            buildSpec: codebuild.BuildSpec.fromSourceFilename('swapBuild.yaml'),
        });

        const sourceOutput = new codepipeline.Artifact();

        const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
            actionName: 'Source',
            repository: props.eksRepo,
            output: sourceOutput,
          });

        const buildActionK8s = new codepipeline_actions.CodeBuildAction({
            actionName: 'DeployK8sApp',
            project: projectK8s,
            input: sourceOutput,
        });

        const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
            actionName: 'ApproveToSwitch',
          });

        const buildActionSwap = new codepipeline_actions.CodeBuildAction({
            actionName: 'BlueGreeSwap',
            project: projectSwap,
            input: sourceOutput,
        });

        new codepipeline.Pipeline(this, 'EksPipeline', {
            role: k8scodepipelinerole,
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'BuildAndDeployK8sApp',
                    actions: [buildActionK8s],
                },
                {
                    stageName: 'ApproveSwitch',
                    actions: [manualApprovalAction],
                },
                {
                    stageName: 'BlueGreenSwap',
                    actions: [buildActionSwap],
                },
            ],
        });

     //   props.k8sRepo.onCommit('OnCommit', {
     //       target: new targets.CodeBuildProject(projectK8s),
     //     });
    }
}