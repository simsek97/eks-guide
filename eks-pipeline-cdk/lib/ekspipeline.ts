import cdk = require('@aws-cdk/core');
import ecr = require('@aws-cdk/aws-ecr');
import eks = require('@aws-cdk/aws-eks');
import * as iam from '@aws-cdk/aws-iam';
import codebuild = require('@aws-cdk/aws-codebuild');
import codecommit = require('@aws-cdk/aws-codecommit');
import targets = require('@aws-cdk/aws-events-targets');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');

export interface eksPipelineProps {
    eksRepo: codecommit.IRepository,
};

export class ekspipeline extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string, props: eksPipelineProps) {
        super(scope, id);

        const ekscodebuildrole = new iam.Role(this, 'ekscodebuilrole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
          });
        ekscodebuildrole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"));
        new cdk.CfnOutput(this, 'ekscodebuildRoleoutput', {
            value: ekscodebuildrole.roleArn,
            description: 'eks codebuild role arn',
            exportName: 'eksCodebuildRoleArn',
          });

        const ekscodepipelinerole = new iam.Role(this, 'k8scodepipelinerole', {
            assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com')
          });
        ekscodepipelinerole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"));

        const projectEks = new codebuild.Project(this, 'EksProject', {
            projectName: 'eksProject',
            source: codebuild.Source.codeCommit({
                repository: props.eksRepo
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                privileged: true,
            },
            role: ekscodebuildrole,
            buildSpec: codebuild.BuildSpec.fromSourceFilename('eksBuild.yaml'),
        });

        const sourceOutput = new codepipeline.Artifact();

        const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
            actionName: 'Source',
            repository: props.eksRepo,
            output: sourceOutput,
          });
        
          const buildActionEks = new codepipeline_actions.CodeBuildAction({
            actionName: 'DeployEksCluster',
            project: projectEks,
            input: sourceOutput,
        });

        new codepipeline.Pipeline(this, 'EksPipeline', {
            role: ekscodepipelinerole,
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'BuildAndDeployEksCluster',
                    actions: [buildActionEks],
                },
            ],
        });

     //   props.k8sRepo.onCommit('OnCommit', {
     //       target: new targets.CodeBuildProject(projectK8s),
     //     });
    }
}