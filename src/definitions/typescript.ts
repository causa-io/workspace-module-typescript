import { WorkspaceFunction } from '@causa/workspace';
import { IsObject, IsString } from 'class-validator';
import type { TypeScriptWithDecoratorsRenderer } from '../code-generation/index.js';

/**
 * A constructor for a {@link TypeScriptWithDecoratorsRenderer}.
 */
export type TypeScriptWithDecoratorsRendererType = new (
  ...args: any[]
) => TypeScriptWithDecoratorsRenderer;

/**
 * Returns a {@link TypeScriptWithDecoratorsRenderer} that adds decorators to generated TypeScript code.
 * This should be implemented for each available {@link TypeScriptWithDecoratorsRenderer}.
 * Implementations of {@link WorkspaceFunction._supports} should return `true` if the
 * {@link TypeScriptGetDecoratorRenderer.generator} is a supported generator for the decorator, and if the
 * {@link TypeScriptGetDecoratorRenderer.configuration} is consistent with the decorator's usage.
 */
export abstract class TypeScriptGetDecoratorRenderer extends WorkspaceFunction<
  | TypeScriptWithDecoratorsRendererType
  | Promise<TypeScriptWithDecoratorsRendererType>
> {
  /**
   * The name of the code generator being run.
   */
  @IsString()
  readonly generator!: string;

  /**
   * The configuration for the code generator.
   */
  @IsObject()
  readonly configuration!: Record<string, unknown>;
}
