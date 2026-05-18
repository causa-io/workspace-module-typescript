import {
  TypeScriptGetDecoratorRenderer,
  type TypeScriptWithDecoratorsRendererType,
} from '../../definitions/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from '../model/run-code-generator-model-class.js';

/**
 * Implements {@link TypeScriptGetDecoratorRenderer} for the {@link OpenApiRenderer}.
 */
export class TypeScriptGetDecoratorRendererForOpenApi extends TypeScriptGetDecoratorRenderer {
  async _call(): Promise<TypeScriptWithDecoratorsRendererType> {
    const { OpenApiRenderer } =
      await import('../../code-generation/renderers/index.js');
    return OpenApiRenderer;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR
    );
  }
}
