import type { ObjectSchema, Property } from '@causa/workspace-core';
import type { TypeScriptDecorator } from './generator.js';
import { addDecoratorToList } from './utilities.js';

/**
 * The module that exports the `Type` decorator.
 */
const CLASS_TRANSFORMER_MODULE = 'class-transformer';

/**
 * Maps non-string primitive types to the JavaScript constructor used by `class-transformer` to convert their string
 * representation.
 */
const PRIMITIVE_TO_CONSTRUCTOR: Record<string, string> = {
  integer: 'Number',
  number: 'Number',
  boolean: 'Boolean',
};

/**
 * Returns the `@Type(() => Number | Boolean)` decorator for non-string primitive properties used as NestJS controller
 * parameters (path / query values arrive as strings and need conversion).
 *
 * @param schema The class the decorators are being generated for.
 * @param property The property within {@link schema} the decorators are being generated for, or `undefined` when the
 *   target is the class itself.
 * @returns The decorators to add to the property, or an empty array when no conversion is needed.
 */
export function makePrimitiveTypeTransformerDecorators(
  schema: ObjectSchema,
  property: Property | undefined,
): TypeScriptDecorator[] {
  if (!property) {
    return [];
  }

  const type =
    property.type.kind === 'array' ? property.type.items : property.type;
  if (type.kind !== 'primitive') {
    return [];
  }

  const constructor = PRIMITIVE_TO_CONSTRUCTOR[type.type];
  if (!constructor) {
    return [];
  }

  const decorators: TypeScriptDecorator[] = [];
  addDecoratorToList(
    decorators,
    { schema, property },
    'Type',
    CLASS_TRANSFORMER_MODULE,
    (alias) => `@${alias}(() => ${constructor})`,
  );
  return decorators;
}
