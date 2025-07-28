import type {
  TypeScriptWithDecoratorsOptions,
  TypeScriptWithDecoratorsRenderer,
} from '../renderer.js';

/**
 * Options for the `TypeScriptModelClass` language and renderer.
 */
export type TypeScriptModelClassOptions = TypeScriptWithDecoratorsOptions & {
  /**
   * A list of decorators renderers that can add decorators to classes and their properties.
   */
  readonly decoratorRenderers?: {
    new (...args: any[]): TypeScriptWithDecoratorsRenderer;
  }[];

  /**
   * Whether to add non-null assertions (`!`) on class properties.
   * Defaults to `true`.
   */
  readonly nonNullAssertionOnProperties?: boolean;

  /**
   * Whether to add the `readonly` keyword to class properties.
   * Defaults to `true`.
   */
  readonly readonlyProperties?: boolean;

  /**
   * Whether to add an “assign” constructor to model classes.
   * Defaults to `true`.
   */
  readonly assignConstructor?: boolean;
};
