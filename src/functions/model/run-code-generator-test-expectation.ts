import { callDeferred, type WorkspaceContext } from '@causa/workspace';
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
  async _call(context: WorkspaceContext): Promise<GeneratedSchemas> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_TEST_EXPECTATION_GENERATOR
    );
  }
}
