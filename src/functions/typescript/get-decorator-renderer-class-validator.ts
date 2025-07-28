import { WorkspaceContext } from '@causa/workspace';
import { TypeScriptWithDecoratorsRenderer } from '../../code-generation/index.js';
import { ClassValidatorTransformerPropertyDecoratorsRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from '../model/run-code-generator-model-class.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the
 * {@link ClassValidatorTransformerPropertyDecoratorsRenderer}.
 */
export class TypeScriptGetDecoratorRendererForClassValidator extends TypeScriptGetDecoratorRenderer {
  _call(): new (...args: any[]) => TypeScriptWithDecoratorsRenderer {
    return ClassValidatorTransformerPropertyDecoratorsRenderer;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR
    );
  }
}
