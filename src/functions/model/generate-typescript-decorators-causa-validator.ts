import {
  makeCausaValidatorDecorators,
  type TypeScriptDecorator,
} from '../../code-generation/model-class/index.js';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';

/**
 * Implements {@link ModelGenerateTypeScriptDecorators} to add `@IsNullable()` and `@AllowMissing()` decorators from
 * `@causa/runtime` to model class properties.
 */
export class ModelGenerateTypeScriptDecoratorsForCausaValidator extends ModelGenerateTypeScriptDecorators {
  async _call(): Promise<TypeScriptDecorator[]> {
    return makeCausaValidatorDecorators(this.schema, this.property);
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_MODEL_CLASS_GENERATOR
    );
  }
}
