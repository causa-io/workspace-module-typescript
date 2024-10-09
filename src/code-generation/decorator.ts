import type { Sourcelike } from 'quicktype-core';

/**
 * A decorator that can be added to a class or property.
 */
export type TypeScriptDecorator = {
  /**
   * The source code for the decorator.
   */
  source: Sourcelike;

  /**
   * The imports that are required for the decorator.
   * Keys are modules or paths, values are the names of the imports.
   */
  imports: Record<string, string[]>;
};
