import type { TypeKind } from 'quicktype-core';
import type { TypeScriptDecorator } from '../decorator.js';
import {
  type ClassPropertyContext,
  TypeScriptWithDecoratorsRenderer,
} from '../renderer.js';
import { getSingleType } from '../utilities.js';

/**
 * The name of the class transformer module, used to import the `Type` decorator.
 */
const CLASS_TRANSFORMER_MODULE = 'class-transformer';

/**
 * Maps type kinds to the JavaScript constructor function to use for transformation.
 * Only non-string primitive types are included here.
 */
const TYPE_KIND_TO_CONSTRUCTOR: Partial<Record<TypeKind, string>> = {
  integer: 'Number',
  double: 'Number',
  bool: 'Boolean',
};

/**
 * A {@link TypeScriptWithDecoratorsRenderer} that adds `@Type(() => ...)` decorators from `class-transformer` to
 * convert non-string primitive types (numbers, booleans) from their string representation.
 *
 * This is useful for path and query parameters in NestJS controllers, which are received as strings and need to be
 * converted to their proper JavaScript types.
 */
export class PrimitiveTypeTransformerRenderer extends TypeScriptWithDecoratorsRenderer {
  decoratorsForClass(): TypeScriptDecorator[] {
    return [];
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    const { type } = getSingleType(context.property.type);
    if (!type) {
      return [];
    }

    const constructor = TYPE_KIND_TO_CONSTRUCTOR[type.kind];
    if (!constructor) {
      return [];
    }

    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'Type',
      CLASS_TRANSFORMER_MODULE,
      `@Type(() => ${constructor})`,
    );

    return decorators;
  }
}
