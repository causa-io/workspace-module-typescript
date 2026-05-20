import {
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  ModelSchemaParse,
  type GeneratedSchemas,
  type Schema,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { resolve } from 'path';
import {
  TypeScriptModelClassGenerator,
  type ModelClassSchemaDecorators,
  type TypeScriptDecorator,
} from '../../code-generation/index.js';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptModelClass}.
 */
export const TYPESCRIPT_MODEL_CLASS_GENERATOR = 'typescriptModelClass';

/**
 * Runs the TypeScript model class code generator: parses input schemas with {@link ModelSchemaParse}, pre-computes
 * decorators, and renders everything through {@link TypeScriptModelClassGenerator}.
 */
export class ModelRunCodeGeneratorForTypeScriptModelClass extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const { output, constraintSuffix } = this.configuration;
    if (!output || typeof output !== 'string') {
      throw new Error(
        `The 'output' configuration for generator '${TYPESCRIPT_MODEL_CLASS_GENERATOR}' must be a string.`,
      );
    }
    const outputPath = resolve(this._context.getProjectPathOrThrow(), output);

    let files: string[];
    try {
      ({ files } = await this._context.call(ModelParseCodeGeneratorInputs, {
        configuration: this.configuration,
      }));
    } catch (error) {
      if (error instanceof NoImplementationFoundError) {
        throw new Error(
          'Could not generate input data for code generation. Ensure the model schema format is supported.',
        );
      }
      throw error;
    }

    const { schemas, errors } = await this._context.call(ModelSchemaParse, {
      paths: files,
    });

    const errorEntries = Object.entries(errors);
    if (errorEntries.length > 0) {
      const details = errorEntries
        .map(([path, err]) => `${path}: ${err.message}`)
        .join('\n');
      throw new Error(`Failed to parse one or more schema files:\n${details}`);
    }

    const decorators = await this.computeTypeScriptDecorators(schemas);

    if (
      constraintSuffix !== undefined &&
      typeof constraintSuffix !== 'string'
    ) {
      throw new Error(
        `The 'constraintSuffix' configuration for generator '${TYPESCRIPT_MODEL_CLASS_GENERATOR}' must be a string.`,
      );
    }

    const codeGenerator = new TypeScriptModelClassGenerator(
      outputPath,
      schemas,
      { constraintSuffix, decorators },
    );
    await codeGenerator.generate();

    return codeGenerator.generatedSchemas;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_MODEL_CLASS_GENERATOR
    );
  }

  /**
   * Pre-computes decorators for every object schema (and its properties) in the given schema map by dispatching
   * {@link ModelGenerateTypeScriptDecorators} via `callAll`.
   *
   * @param schemas The schema map to compute decorators for.
   * @returns A record keyed by schema path with the decorators for the class and its properties.
   */
  async computeTypeScriptDecorators(
    schemas: Record<string, Schema>,
  ): Promise<Record<string, ModelClassSchemaDecorators>> {
    const result: Record<string, ModelClassSchemaDecorators> = {};

    for (const schema of Object.values(schemas)) {
      if (schema.kind !== 'object') {
        continue;
      }

      const objectContext = {
        generator: this.generator,
        configuration: this.configuration,
        schemas,
        schema,
      };
      const classResults = await Promise.all(
        this._context.callAll(ModelGenerateTypeScriptDecorators, objectContext),
      );

      const properties: Record<string, TypeScriptDecorator[]> = {};
      for (const property of schema.properties) {
        const propertyResults = await Promise.all(
          this._context.callAll(ModelGenerateTypeScriptDecorators, {
            ...objectContext,
            property,
          }),
        );
        properties[property.name] = propertyResults.flat();
      }

      result[schema.path] = { class: classResults.flat(), properties };
    }

    return result;
  }
}
