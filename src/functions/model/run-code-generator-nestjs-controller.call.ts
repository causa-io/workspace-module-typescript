import type { WorkspaceContext } from '@causa/workspace';
import {
  ModelParseCodeGeneratorInputs,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import {
  generateCodeForSchemas,
  makeJsonSchemaInputDataFromSources,
} from '@causa/workspace-core/code-generation';
import { mkdir } from 'fs/promises';
import { basename, join, resolve } from 'path';
import type { JSONSchemaSourceData } from 'quicktype-core';
import {
  makeParametersSchemasForSpecification,
  parseOpenApiSpec,
  PrimitiveTypeTransformerRenderer,
  TypeScriptModelClassTargetLanguage,
  writeControllerFile,
} from '../../code-generation/index.js';
import {
  CausaValidatorRenderer,
  ClassValidatorTransformerPropertyDecoratorsRenderer,
} from '../../code-generation/renderers/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import type { ModelRunCodeGeneratorForTypeScriptNestjsController } from './run-code-generator-nestjs-controller.js';
import { TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR } from './run-code-generator-nestjs-controller.js';
import { LEADING_COMMENT } from './utils.js';

/**
 * Generates TypeScript classes for parameter schemas.
 *
 * @param self The instance of the generator function.
 * @param sources The JSON Schema sources for parameters.
 * @param modelFilePath The path to the model file to generate.
 * @param context The workspace context.
 * @returns The generated schemas.
 */
async function generateParameterSchemas(
  self: ModelRunCodeGeneratorForTypeScriptNestjsController,
  sources: JSONSchemaSourceData[],
  modelFilePath: string,
  context: WorkspaceContext,
): Promise<GeneratedSchemas> {
  if (sources.length === 0) {
    return {};
  }

  const inputData = await makeJsonSchemaInputDataFromSources(sources);

  const language = new TypeScriptModelClassTargetLanguage(
    modelFilePath,
    context,
    {
      decoratorRenderers: [
        CausaValidatorRenderer,
        ClassValidatorTransformerPropertyDecoratorsRenderer,
        PrimitiveTypeTransformerRenderer,
      ],
      leadingComment: LEADING_COMMENT,
      generatorOptions: self.configuration,
    },
  );

  await generateCodeForSchemas(language, inputData);

  return language.generatedSchemas;
}

export default async function call(
  this: ModelRunCodeGeneratorForTypeScriptNestjsController,
  context: WorkspaceContext,
): Promise<GeneratedSchemas> {
  const { configuration, previousGeneratorsOutput } = this;
  const projectPath = context.getProjectPathOrThrow();

  const { output } = configuration;
  if (!output || typeof output !== 'string') {
    throw new Error(
      `The 'output' configuration for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}' must be a string (directory path).`,
    );
  }
  const outputDir = resolve(projectPath, output);
  const modelFilePath = join(outputDir, 'model.ts');

  const modelClassSchemas =
    previousGeneratorsOutput[TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR];
  if (!modelClassSchemas) {
    throw new Error(
      `The '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}' generator requires the output of the '${TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR}' generator. Make sure it runs before this generator.`,
    );
  }

  const { files } = await context.call(ModelParseCodeGeneratorInputs, {
    configuration,
  });
  if (files.length === 0) {
    context.logger.warn(
      `No OpenAPI specification files found for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}'.`,
    );
    return {};
  }

  context.logger.debug(
    `Found ${files.length} OpenAPI specification file(s) to process.`,
  );

  const parsedSpecs = await Promise.all(files.map(parseOpenApiSpec));
  const specs = parsedSpecs.filter((spec) => spec.operations.length > 0);
  if (specs.length === 0) {
    context.logger.warn(
      `No operations found in the OpenAPI specification files for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}'.`,
    );
    return {};
  }

  await mkdir(outputDir, { recursive: true });

  const parametersJsonSchemas = specs.flatMap(
    makeParametersSchemasForSpecification,
  );
  const parameterSchemas = await generateParameterSchemas(
    this,
    parametersJsonSchemas,
    modelFilePath,
    context,
  );

  for (const spec of specs) {
    const controllerFileName = basename(spec.filePath)
      .replace(/\.\w+$/, '')
      .concat('.controller.ts');
    const controllerFilePath = join(outputDir, controllerFileName);

    await writeControllerFile(
      spec,
      modelClassSchemas,
      parameterSchemas,
      controllerFilePath,
      LEADING_COMMENT,
    );

    context.logger.debug(`Generated '${controllerFileName}'.`);
  }

  return parameterSchemas;
}
