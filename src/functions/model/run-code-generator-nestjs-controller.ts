import {
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  type GeneratedSchemas,
  type Schema,
} from '@causa/workspace-core';
import { mkdir } from 'fs/promises';
import { basename, join, resolve } from 'path';
import {
  makeParametersSchemasForSpecification,
  parseOpenApiSpec,
  writeControllerFile,
} from '../../code-generation/index.js';
import {
  makeCausaValidatorDecorators,
  makeClassValidatorDecorators,
  makePrimitiveTypeTransformerDecorators,
  TypeScriptModelClassGenerator,
  type ModelClassSchemaDecorators,
} from '../../code-generation/model-class/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
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
 * 2. Extracts path and query parameters and builds {@link Schema}s for them.
 * 3. Feeds those schemas through {@link TypeScriptModelClassGenerator} to produce `model.ts`.
 * 4. Generates `*.api.controller.ts` files with TypeScript interfaces and decorator factories.
 */
export class ModelRunCodeGeneratorForTypeScriptNestjsController extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const { configuration, previousGeneratorsOutput } = this;
    const projectPath = this._context.getProjectPathOrThrow();

    const { output } = configuration;
    if (!output || typeof output !== 'string') {
      throw new Error(
        `The 'output' configuration for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}' must be a string (directory path).`,
      );
    }
    const outputDir = resolve(projectPath, output);
    const modelFilePath = join(outputDir, 'model.ts');

    const modelClassSchemas =
      previousGeneratorsOutput[TYPESCRIPT_MODEL_CLASS_GENERATOR];
    if (!modelClassSchemas) {
      throw new Error(
        `The '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}' generator requires the output of the '${TYPESCRIPT_MODEL_CLASS_GENERATOR}' generator. Make sure it runs before this generator.`,
      );
    }

    const { files } = await this._context.call(ModelParseCodeGeneratorInputs, {
      configuration,
    });
    if (files.length === 0) {
      this._context.logger.warn(
        `No OpenAPI specification files found for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}'.`,
      );
      return {};
    }

    this._context.logger.debug(
      `Found ${files.length} OpenAPI specification file(s) to process.`,
    );

    const parsedSpecs = await Promise.all(files.map(parseOpenApiSpec));
    const specs = parsedSpecs.filter((spec) => spec.operations.length > 0);
    if (specs.length === 0) {
      this._context.logger.warn(
        `No operations found in the OpenAPI specification files for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}'.`,
      );
      return {};
    }

    await mkdir(outputDir, { recursive: true });

    const parameterSchemas = await this.generateParameterSchemas(
      specs.reduce(
        (acc, spec) =>
          Object.assign(acc, makeParametersSchemasForSpecification(spec)),
        {} as Record<string, Schema>,
      ),
      modelFilePath,
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

      this._context.logger.debug(`Generated '${controllerFileName}'.`);
    }

    return parameterSchemas;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR
    );
  }

  /**
   * Generates TypeScript classes for parameter schemas using {@link TypeScriptModelClassGenerator}. The synthetic
   * schema paths (`${operationId}/${location}`) flow through to the {@link GeneratedSchemas} the controller renderer
   * relies on.
   *
   * @param schemas The parameter schemas to generate classes for.
   * @param modelFilePath The file path to generate the classes at.
   * @returns The generated schemas.
   */
  private async generateParameterSchemas(
    schemas: Record<string, Schema>,
    modelFilePath: string,
  ): Promise<GeneratedSchemas> {
    if (Object.keys(schemas).length === 0) {
      return {};
    }

    const decorators: Record<string, ModelClassSchemaDecorators> = {};
    for (const schema of Object.values(schemas)) {
      if (schema.kind !== 'object') {
        continue;
      }

      decorators[schema.path] = {
        class: [
          ...makeCausaValidatorDecorators(schema, undefined),
          ...makeClassValidatorDecorators(schema, undefined, schemas),
          ...makePrimitiveTypeTransformerDecorators(schema, undefined),
        ],
        properties: Object.fromEntries(
          schema.properties.map((property) => {
            const decorators = [
              ...makeCausaValidatorDecorators(schema, property),
              ...makeClassValidatorDecorators(schema, property, schemas),
              ...makePrimitiveTypeTransformerDecorators(schema, property),
            ];
            return [property.name, decorators];
          }),
        ),
      };
    }

    const generator = new TypeScriptModelClassGenerator(
      modelFilePath,
      schemas,
      { decorators },
    );
    await generator.generate();

    return generator.generatedSchemas;
  }
}
