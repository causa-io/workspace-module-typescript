import type { TypeScriptDecorator } from '../decorator.js';
import {
  type ClassPropertyContext,
  TypeScriptWithDecoratorsRenderer,
} from '../renderer.js';
import { getSingleType } from '../utilities.js';

/**
 * The name of the Causa module for the TypeScript runtime.
 */
const CAUSA_MODULE = '@causa/runtime';

/**
 * A {@link TypeScriptWithDecoratorsRenderer} that adds validation decorators from the Causa runtime.
 * Those validators bring additional features to `class-validator`.
 *
 * The added decorators are:
 * - `@IsNullable()`, if the property type is a union with the `null` type.
 * - `@AllowMissing()`, if the property is optional.
 */
export class CausaValidatorRenderer extends TypeScriptWithDecoratorsRenderer {
  decoratorsForClass(): TypeScriptDecorator[] {
    return [];
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    const decorators: TypeScriptDecorator[] = [];

    const { isNullable } = getSingleType(context.property.type);
    if (isNullable) {
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
