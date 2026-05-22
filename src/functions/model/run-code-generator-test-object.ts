import {
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { TypeScriptTestObjectGenerator } from '../../code-generation/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import {
  parseInputSchemas,
  requirePreviousGeneratorOutput,
  resolveOutputPath,
} from './utils.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptTestObject}.
 */
export const TYPESCRIPT_TEST_OBJECT_GENERATOR = 'typescriptTestObject';

/**
 * Runs the TypeScript test object code generator: parses input schemas with {@link parseInputSchemas} and renders
 * `make<X>` factory functions through {@link TypeScriptTestObjectGenerator}.
 */
export class ModelRunCodeGeneratorForTypeScriptTestObject extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const outputPath = resolveOutputPath(
      this._context,
      TYPESCRIPT_TEST_OBJECT_GENERATOR,
      this.configuration.output,
    );
    const modelClassSchemas = requirePreviousGeneratorOutput(
      this.previousGeneratorsOutput,
      TYPESCRIPT_TEST_OBJECT_GENERATOR,
      TYPESCRIPT_MODEL_CLASS_GENERATOR,
    );
    const schemas = await parseInputSchemas(this._context, this.configuration);

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
