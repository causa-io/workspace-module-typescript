import type { WorkspaceContext } from '@causa/workspace';
import {
  TypeScriptGetDecoratorRenderer,
  type TypeScriptWithDecoratorsRendererType,
} from '../../definitions/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from '../model/run-code-generator-model-class.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the
 * {@link ClassValidatorTransformerPropertyDecoratorsRenderer}.
 */
export class TypeScriptGetDecoratorRendererForClassValidator extends TypeScriptGetDecoratorRenderer {
  async _call(): Promise<TypeScriptWithDecoratorsRendererType> {
    const { ClassValidatorTransformerPropertyDecoratorsRenderer } =
      await import('../../code-generation/renderers/index.js');
    return ClassValidatorTransformerPropertyDecoratorsRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR
    );
  }
}
