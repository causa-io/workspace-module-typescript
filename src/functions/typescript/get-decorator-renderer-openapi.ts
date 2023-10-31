import { WorkspaceContext } from '@causa/workspace';
import { TypeScriptDecoratorsRenderer } from '../../code-generation/index.js';
import { OpenApiRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the {@link OpenApiRenderer}.
 * The configuration name for the renderer is `openapi`.
 */
export class TypeScriptGetDecoratorRendererForOpenApi extends TypeScriptGetDecoratorRenderer {
  _call(): new (...args: any[]) => TypeScriptDecoratorsRenderer {
    return OpenApiRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    if (context.get('project.language') !== 'typescript') {
      return false;
    }

    const decoratorRenderers =
      context
        .asConfiguration<any>()
        .get('typescript.codeGeneration.decoratorRenderers') ?? [];
    return (
      decoratorRenderers.length === 0 || decoratorRenderers.includes('openapi')
    );
  }
}
