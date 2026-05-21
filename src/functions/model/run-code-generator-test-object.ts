import {
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  ModelSchemaParse,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { resolve } from 'path';
import { TypeScriptTestObjectGenerator } from '../../code-generation/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptTestObject}.
 */
export const TYPESCRIPT_TEST_OBJECT_GENERATOR = 'typescriptTestObject';

/**
 * Runs the TypeScript test object code generator: parses input schemas with {@link ModelSchemaParse} and renders
 * `make<X>` factory functions through {@link TypeScriptTestObjectGenerator}.
 */
export class ModelRunCodeGeneratorForTypeScriptTestObject extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const { configuration, previousGeneratorsOutput } = this;

    const { output } = configuration;
    if (!output || typeof output !== 'string') {
      throw new Error(
        `The 'output' configuration for generator '${TYPESCRIPT_TEST_OBJECT_GENERATOR}' must be a string.`,
      );
    }

    const modelClassSchemas =
      previousGeneratorsOutput[TYPESCRIPT_MODEL_CLASS_GENERATOR];
    if (!modelClassSchemas) {
      throw new Error(
        `The '${TYPESCRIPT_TEST_OBJECT_GENERATOR}' generator requires the output of the '${TYPESCRIPT_MODEL_CLASS_GENERATOR}' generator. Make sure it runs before this generator.`,
      );
    }

    let files: string[];
    try {
      ({ files } = await this._context.call(ModelParseCodeGeneratorInputs, {
        configuration,
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

    const outputPath = resolve(this._context.getProjectPathOrThrow(), output);

    const generator = new TypeScriptTestObjectGenerator(
      outputPath,
      schemas,
      modelClassSchemas,
    );
    await generator.generate();

    return generator.generatedSchemas;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_TEST_OBJECT_GENERATOR
    );
  }
}
