import type { WorkspaceContext } from '@causa/workspace';
import {
  causaJsonSchemaAttributeProducer,
  generateCodeForSchemas,
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { mkdir } from 'fs/promises';
import { globby } from 'globby';
import { join, resolve } from 'path';
import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  type JSONSchemaSourceData,
} from 'quicktype-core';
import { TypeScriptModelClassTargetLanguage } from '../../code-generation/index.js';
import {
  buildControllerFileName,
  parseOpenApiSpec,
  renderControllerFile,
  synthesizeSchemasForOperations,
  writeControllerFile,
} from '../../code-generation/nestjs-controller/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
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

    const { output } = configuration;
    if (!output || typeof output !== 'string') {
      throw new Error(
        `The 'output' configuration for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}' must be a string (directory path).`,
      );
    }

    const modelClassSchemas =
      previousGeneratorsOutput[TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR];
    if (!modelClassSchemas) {
      throw new Error(
        `The '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}' generator requires the output of the '${TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR}' generator. Make sure it runs before this generator.`,
      );
    }

    // Parse the code generator inputs to get the list of OpenAPI files
    const { globs } = await context.call(ModelParseCodeGeneratorInputs, {
      configuration,
    });

    const projectPath = context.getProjectPathOrThrow();

    // Find all OpenAPI spec files matching the globs
    const openApiFiles = await globby(globs, {
      followSymbolicLinks: false,
      cwd: projectPath,
      absolute: true,
    });

    if (openApiFiles.length === 0) {
      context.logger.warn(
        `No OpenAPI specification files found for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}'.`,
      );
      return {};
    }

    context.logger.debug(
      `Found ${openApiFiles.length} OpenAPI specification file(s) to process.`,
    );

    // Parse all OpenAPI specs
    const parsedSpecs = await Promise.all(
      openApiFiles.map((file) => parseOpenApiSpec(file)),
    );

    // Synthesize JSON schemas for all parameters across all specs
    const allSynthesizedSchemas = parsedSpecs.flatMap((spec) =>
      synthesizeSchemasForOperations(spec.operations),
    );

    const outputDir = resolve(projectPath, output);
    await mkdir(outputDir, { recursive: true });

    const modelFilePath = join(outputDir, 'model.ts');
    const generatedSchemas: GeneratedSchemas = {};

    // Phase 1: Generate model.ts with parameter classes (if there are any)
    if (allSynthesizedSchemas.length > 0) {
      const sources: JSONSchemaSourceData[] = allSynthesizedSchemas.map(
        (synth) => ({
          name: synth.name,
          schema: synth.schema,
        }),
      );

      const inputData = await this.makeInputDataFromSources(sources);

      // Get decorator renderers (class-validator, causa-validator)
      // Use the model class generator name to get the same decorators as the model class generator.
      const decoratorRenderers = context
        .getFunctionImplementations(TypeScriptGetDecoratorRenderer, {
          generator: TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR,
          configuration,
        })
        .map((f) => f._call(context))
        .sort((r1, r2) => r1.name.localeCompare(r2.name));

      const language = new TypeScriptModelClassTargetLanguage(
        modelFilePath,
        context,
        {
          decoratorRenderers,
          leadingComment: LEADING_COMMENT,
          generatorOptions: configuration,
        },
      );

      await generateCodeForSchemas(language, inputData);

      // Record generated schemas
      for (const synth of allSynthesizedSchemas) {
        generatedSchemas[`synthetic:${synth.name}`] = {
          name: synth.name,
          file: modelFilePath,
        };
      }
    }

    // Phase 2: Generate controller files
    // Determine the path to external types (the output of typescriptModelClass)
    // This is typically something like '../model/generated.ts'
    const externalTypesFilePath =
      this.resolveExternalTypesPath(modelClassSchemas);

    for (const spec of parsedSpecs) {
      if (spec.operations.length === 0) {
        context.logger.debug(
          `Skipping ${spec.filePath} - no operations found.`,
        );
        continue;
      }

      const controllerFileName = buildControllerFileName(spec.resourceName);
      const controllerFilePath = join(outputDir, controllerFileName);

      const content = renderControllerFile(
        spec,
        modelClassSchemas,
        controllerFilePath,
        modelFilePath,
        externalTypesFilePath,
      );

      await writeControllerFile(content, controllerFilePath, LEADING_COMMENT);

      context.logger.debug(`Generated ${controllerFileName}`);
    }

    return generatedSchemas;
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
    const store = new FetchingJSONSchemaStore();
    const input = new JSONSchemaInput(store, [
      causaJsonSchemaAttributeProducer,
    ]);

    for (const source of sources) {
      await input.addSource(source);
    }

    const inputData = new InputData();
    inputData.addInput(input);
    return inputData;
  }

  /**
   * Resolves the path to the external types file from the model class generator output.
   *
   * @param modelClassSchemas The generated schemas from the model class generator.
   * @returns The path to the external types file.
   */
  private resolveExternalTypesPath(
    modelClassSchemas: GeneratedSchemas,
  ): string {
    // All schemas from the model class generator should point to the same file
    const firstSchema = Object.values(modelClassSchemas)[0];
    if (firstSchema) {
      return firstSchema.file;
    }

    // Fallback to a common pattern
    return '../model/generated.ts';
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR
    );
  }
}
