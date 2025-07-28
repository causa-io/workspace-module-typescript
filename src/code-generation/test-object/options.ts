import type { GeneratedSchemas } from '@causa/workspace-core';
import type { TypeScriptWithDecoratorsOptions } from '../renderer.js';

/**
 * Options for the `TypeScriptTestObject` language and renderer.
 */
export type TypeScriptTestObjectOptions = TypeScriptWithDecoratorsOptions & {
  /**
   * The output of the model class generator, used to reference classes when instantiating test objects.
   */
  readonly modelClassSchemas: GeneratedSchemas;
};
