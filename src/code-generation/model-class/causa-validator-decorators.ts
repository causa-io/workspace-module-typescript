import type { ObjectSchema, Property } from '@causa/workspace-core';
import type { TypeScriptDecorator } from './generator.js';
import { addDecoratorToList } from './utilities.js';

/**
 * The name of the Causa runtime module the decorators are imported from.
 */
const CAUSA_MODULE = '@causa/runtime';

/**
 * Returns the `@IsNullable()` and `@AllowMissing()` decorators from `@causa/runtime` that apply to the given property.
 *
 * @param schema The class the decorators are being generated for.
 * @param property The property within {@link schema} the decorators are being generated for, or `undefined` when the
 *   target is the class itself.
 * @returns The decorators to add to the property, or an empty array when the target is a class.
 */
export function makeCausaValidatorDecorators(
  schema: ObjectSchema,
  property: Property | undefined,
): TypeScriptDecorator[] {
  if (!property) {
    return [];
  }

  const target = { schema, property };
  const decorators: TypeScriptDecorator[] = [];

  if (property.nullable) {
    addDecoratorToList(
      decorators,
      target,
      'IsNullable',
      CAUSA_MODULE,
      '@IsNullable()',
    );
  }

  if (!property.required) {
    addDecoratorToList(
      decorators,
      target,
      'AllowMissing',
      CAUSA_MODULE,
      '@AllowMissing()',
    );
  }

  return decorators;
}
