import { WorkspaceFunction } from '@causa/workspace';
import { TypeScriptDecoratorsRenderer } from '../code-generation/index.js';

/**
 * Returns a {@link TypeScriptDecoratorsRenderer} that adds decorators to generated TypeScript code.
 * This should be implemented for each available {@link TypeScriptDecoratorsRenderer}.
 * Implementations of {@link WorkspaceFunction._supports} should return `true` if the
 * `typescript.codeGeneration.decoratorRenderers` configuration is undefined or contains the name of the renderer.
 */
export abstract class TypeScriptGetDecoratorRenderer extends WorkspaceFunction<{
  new (...args: any[]): TypeScriptDecoratorsRenderer;
}> {}
