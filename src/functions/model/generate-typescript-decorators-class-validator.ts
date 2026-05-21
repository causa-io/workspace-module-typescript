import {
  makeClassValidatorDecorators,
  type TypeScriptDecorator,
} from '../../code-generation/model-class/index.js';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';

/**
 * Implements {@link ModelGenerateTypeScriptDecorators} to add `class-validator` and `class-transformer` decorators to
 * model class properties.
 */
export class ModelGenerateTypeScriptDecoratorsForClassValidator extends ModelGenerateTypeScriptDecorators {
  async _call(): Promise<TypeScriptDecorator[]> {
    return makeClassValidatorDecorators(
      this.schema,
      this.property,
      this.schemas,
    );
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_MODEL_CLASS_GENERATOR
    );
  }
}
