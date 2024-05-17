import 'quicktype-core';
import { removeNullFromType } from 'quicktype-core/dist/TypeUtils.js';
import { TypeScriptDecorator } from '../decorator.js';
import {
  ClassPropertyContext,
  TypeScriptDecoratorsRenderer,
} from '../ts-decorators-renderer.js';

/**
 * The name of the Causa module for the TypeScript runtime.
 */
const CAUSA_MODULE = '@causa/runtime';

/**
 * A {@link TypeScriptDecoratorsRenderer} that adds validation decorators from the Causa runtime.
 * Those validators bring additional features to `class-validator`.
 *
 * The added decorators are:
 * - `@IsNullable()`, if the property type is a union with the `null` type.
 * - `@AllowMissing()`, if the property is optional.
 */
export class CausaValidatorRenderer extends TypeScriptDecoratorsRenderer {
  decoratorsForClass(): TypeScriptDecorator[] {
    return [];
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    const decorators: TypeScriptDecorator[] = [];

    const [nullType] = removeNullFromType(context.property.type);
    if (nullType) {
      this.addDecoratorToList(
        decorators,
        context,
        'IsNullable',
        CAUSA_MODULE,
        '@IsNullable()',
      );
    }

    if (context.property.isOptional) {
      this.addDecoratorToList(
        decorators,
        context,
        'AllowMissing',
        CAUSA_MODULE,
        '@AllowMissing()',
      );
    }

    return decorators;
  }
}
