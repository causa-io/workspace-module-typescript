import type { ModuleRegistrationContext } from '@causa/workspace';
import {
  ModelRunCodeGeneratorForTypeScriptModelClass,
  ModelRunCodeGeneratorForTypeScriptNestjsController,
  ModelRunCodeGeneratorForTypeScriptTestExpectation,
  ModelRunCodeGeneratorForTypeScriptTestObject,
} from './model/index.js';
import { OpenApiGenerateSpecificationForJavaScriptServiceContainer } from './openapi/index.js';
import {
  ProjectBuildArtefactForJavaScriptPackage,
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
} from './project/index.js';
import {
  TypeScriptGetDecoratorRendererForCausaValidator,
  TypeScriptGetDecoratorRendererForClassValidator,
  TypeScriptGetDecoratorRendererForOpenApi,
} from './typescript/index.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    ModelRunCodeGeneratorForTypeScriptModelClass,
    ModelRunCodeGeneratorForTypeScriptNestjsController,
    ModelRunCodeGeneratorForTypeScriptTestExpectation,
    ModelRunCodeGeneratorForTypeScriptTestObject,
    OpenApiGenerateSpecificationForJavaScriptServiceContainer,
    ProjectBuildArtefactForJavaScriptPackage,
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
