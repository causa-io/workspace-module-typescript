import { callDeferred, type WorkspaceContext } from '@causa/workspace';
import {
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptTestObject}.
 */
export const TYPESCRIPT_TEST_OBJECT_GENERATOR = 'typescriptTestObject';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript test object generator.
 */
export class ModelRunCodeGeneratorForTypeScriptTestObject extends ModelRunCodeGenerator {
  async _call(context: WorkspaceContext): Promise<GeneratedSchemas> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_TEST_OBJECT_GENERATOR
    );
  }
}
