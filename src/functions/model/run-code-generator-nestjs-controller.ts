import type { WorkspaceContext } from '@causa/workspace';
import {
  causaJsonSchemaAttributeProducer,
  generateCodeForSchemas,
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { mkdir } from 'fs/promises';
import { basename, join, resolve } from 'path';
import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  type JSONSchemaSourceData,
} from 'quicktype-core';
import { TypeScriptModelClassTargetLanguage } from '../../code-generation/index.js';
import {
  parseOpenApiSpec,
  renderControllerFile,
  synthesizeSchemasForOperations,
  writeControllerFile,
} from '../../code-generation/nestjs-controller/index.js';
import {
  CausaValidatorRenderer,
  ClassValidatorTransformerPropertyDecoratorsRenderer,
} from '../../code-generation/renderers/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import { LEADING_COMMENT } from './utils.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptNestjsController}.
 */
export const TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR =
  'typescriptNestjsController';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript NestJS controller generator.
 *
 * This generator:
 * 1. Parses OpenAPI YAML specification files.
 * 2. Extracts path and query parameters to synthesize JSON Schema objects.
 * 3. Feeds those schemas through the existing model-class pipeline to produce `model.ts`.
 * 4. Generates `*.api.controller.ts` files with TypeScript interfaces and decorator factories.
 */
export class ModelRunCodeGeneratorForTypeScriptNestjsController extends ModelRunCodeGenerator {
  async _call(context: WorkspaceContext): Promise<GeneratedSchemas> {
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
    const synthesizedSchemas = specs.flatMap(({ operations }) =>
      synthesizeSchemasForOperations(operations),
    );

    await mkdir(outputDir, { recursive: true });

    let parameterSchemas: GeneratedSchemas = {};
    if (synthesizedSchemas.length > 0) {
      const inputData = await this.makeInputDataFromSources(synthesizedSchemas);

      const language = new TypeScriptModelClassTargetLanguage(
        modelFilePath,
        context,
        {
          decoratorRenderers: [
            CausaValidatorRenderer,
            ClassValidatorTransformerPropertyDecoratorsRenderer,
          ],
          leadingComment: LEADING_COMMENT,
          generatorOptions: configuration,
        },
      );

      await generateCodeForSchemas(language, inputData);

      parameterSchemas = language.generatedSchemas;
    }

    for (const spec of specs) {
      const controllerFileName = basename(spec.filePath)
        .replace(/\.\w+$/, '')
        .concat('.controller.ts');
      const controllerFilePath = join(outputDir, controllerFileName);

      const content = renderControllerFile(
        spec,
        modelClassSchemas,
        parameterSchemas,
        controllerFilePath,
      );

      await writeControllerFile(content, controllerFilePath, LEADING_COMMENT);

      context.logger.debug(`Generated ${controllerFileName}`);
    }

    return parameterSchemas;
  }

  /**
   * Creates quicktype InputData from in-memory JSON Schema sources.
   *
   * @param sources The JSON Schema sources.
   * @returns The InputData for quicktype.
   */
  private async makeInputDataFromSources(
    sources: JSONSchemaSourceData[],
  ): Promise<InputData> {
    const input = new JSONSchemaInput(new FetchingJSONSchemaStore(), [
      causaJsonSchemaAttributeProducer,
    ]);
    for (const source of sources) {
      await input.addSource(source);
    }
    const inputData = new InputData();
    inputData.addInput(input);
    return inputData;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR
    );
  }
}
