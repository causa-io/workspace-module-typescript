import {
  makeOpenApiDecorators,
  type TypeScriptDecorator,
} from '../../code-generation/model-class/index.js';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';

/**
 * Implements {@link ModelGenerateTypeScriptDecorators} to add NestJS OpenAPI decorators to model classes opted in via
 * the `tsOpenApi` causa extension.
 */
export class ModelGenerateTypeScriptDecoratorsForOpenApi extends ModelGenerateTypeScriptDecorators {
  async _call(): Promise<TypeScriptDecorator[]> {
    return makeOpenApiDecorators(this.schema, this.property, this.schemas);
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_MODEL_CLASS_GENERATOR
    );
  }
}
