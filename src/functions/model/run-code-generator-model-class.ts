import { callDeferred } from '@causa/workspace';
import {
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptModelClass}.
 */
export const TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR =
  'typescriptModelClass';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript JSON Schema model class generator.
 */
export class ModelRunCodeGeneratorForTypeScriptModelClass extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR
    );
  }
}
