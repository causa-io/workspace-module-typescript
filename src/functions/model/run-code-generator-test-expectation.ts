import { callDeferred } from '@causa/workspace';
import {
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptTestExpectation}.
 */
export const TYPESCRIPT_TEST_EXPECTATION_GENERATOR =
  'typescriptTestExpectation';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript test expectation generator.
 */
export class ModelRunCodeGeneratorForTypeScriptTestExpectation extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_TEST_EXPECTATION_GENERATOR
    );
  }
}
