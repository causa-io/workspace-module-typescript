import type { ModuleRegistrationContext } from '@causa/workspace';
import { ModelRunCodeGeneratorForTypeScriptModelClass } from './model/run-code-generator-model-class.js';
import { ModelRunCodeGeneratorForTypeScriptTestObject } from './model/run-code-generator-test-object.js';
import { OpenApiGenerateSpecificationForJavaScriptServiceContainer } from './openapi-generate-specification-js-service-container.js';
import { ProjectBuildArtefactForTypeScriptPackage } from './project-build-artefact-ts-package.js';
import { ProjectBuildArtefactForTypeScriptServerlessFunctions } from './project-build-artefact-ts-serverless-functions.js';
import { ProjectBuildArtefactForTypeScriptServiceContainer } from './project-build-artefact-ts-service-container.js';
import { ProjectDependenciesCheckForJavaScript } from './project-dependencies-check-javascript.js';
import { ProjectDependenciesUpdateForJavaScript } from './project-dependencies-update-javascript.js';
import { ProjectGetArtefactDestinationForNpmPackage } from './project-get-artefact-destination-npm-package.js';
import { ProjectInitForJavaScript } from './project-init-javascript.js';
import { ProjectLintForJavaScript } from './project-lint-javascript.js';
import { ProjectPushArtefactForNpmPackage } from './project-push-artefact-npm-package.js';
import { ProjectReadVersionForJavaScript } from './project-read-version-javascript.js';
import { ProjectSecurityCheckForJavaScript } from './project-security-check.js';
import { ProjectTestForJavaScript } from './project-test-javascript.js';
import {
  TypeScriptGetDecoratorRendererForCausaValidator,
  TypeScriptGetDecoratorRendererForClassValidator,
  TypeScriptGetDecoratorRendererForOpenApi,
} from './typescript/index.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    ModelRunCodeGeneratorForTypeScriptModelClass,
    ModelRunCodeGeneratorForTypeScriptTestObject,
    OpenApiGenerateSpecificationForJavaScriptServiceContainer,
    ProjectBuildArtefactForTypeScriptPackage,
    ProjectBuildArtefactForTypeScriptServerlessFunctions,
    ProjectBuildArtefactForTypeScriptServiceContainer,
    ProjectDependenciesCheckForJavaScript,
    ProjectDependenciesUpdateForJavaScript,
    ProjectGetArtefactDestinationForNpmPackage,
    ProjectInitForJavaScript,
    ProjectLintForJavaScript,
    ProjectPushArtefactForNpmPackage,
    ProjectReadVersionForJavaScript,
    ProjectSecurityCheckForJavaScript,
    ProjectTestForJavaScript,
    TypeScriptGetDecoratorRendererForCausaValidator,
    TypeScriptGetDecoratorRendererForClassValidator,
    TypeScriptGetDecoratorRendererForOpenApi,
  );
}
