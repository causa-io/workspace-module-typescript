import {
  ModelRunCodeGenerator,
  type GeneratedSchemas,
  type Schema,
} from '@causa/workspace-core';
import {
  TypeScriptModelClassGenerator,
  type ModelClassSchemaDecorators,
  type TypeScriptDecorator,
} from '../../code-generation/index.js';
import type { TypeScriptModelConfiguration } from '../../configurations/index.js';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';
import { parseInputSchemas, resolveOutputPath } from './utils.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptModelClass}.
 */
export const TYPESCRIPT_MODEL_CLASS_GENERATOR = 'typescriptModelClass';

/**
 * Runs the TypeScript model class code generator: parses input schemas with {@link parseInputSchemas}, pre-computes
 * decorators, and renders everything through {@link TypeScriptModelClassGenerator}.
 */
export class ModelRunCodeGeneratorForTypeScriptModelClass extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const outputPath = resolveOutputPath(
      this._context,
      TYPESCRIPT_MODEL_CLASS_GENERATOR,
      this.configuration.output,
    );
    const constraintSuffix = this._context
      .asConfiguration<TypeScriptModelConfiguration>()
      .get('model.constraintSuffix');

    const schemas = await parseInputSchemas(this._context, this.configuration);
    const decorators = await this.computeTypeScriptDecorators(schemas);

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
