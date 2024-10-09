import { WorkspaceContext } from '@causa/workspace';
import { TypeScriptDecoratorsRenderer } from '../../code-generation/index.js';
import { CausaValidatorRenderer } from '../../code-generation/renderers/index.js';
import type { TypeScriptConfiguration } from '../../configurations/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the {@link CausaValidatorRenderer}.
 * The configuration name for the renderer is `causaValidator`.
 */
export class TypeScriptGetDecoratorRendererForCausaValidator extends TypeScriptGetDecoratorRenderer {
  _call(): new (...args: any[]) => TypeScriptDecoratorsRenderer {
    return CausaValidatorRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    if (context.get('project.language') !== 'typescript') {
      return false;
    }

    const decoratorRenderers =
      context
        .asConfiguration<TypeScriptConfiguration>()
        .get('typescript.codeGeneration.decoratorRenderers') ?? [];
    return (
      decoratorRenderers.length === 0 ||
      decoratorRenderers.includes('causaValidator')
    );
  }
}
