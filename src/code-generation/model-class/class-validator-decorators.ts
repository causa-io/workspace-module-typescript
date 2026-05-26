import type {
  ConstPropertyType,
  EnumSchema,
  ObjectSchema,
  Property,
  PropertyType,
  Schema,
} from '@causa/workspace-core';
import type { TypeScriptDecorator } from './generator.js';
import { addDecoratorToList } from './utilities.js';

/**
 * The module the `class-validator` decorators are imported from.
 */
const CLASS_VALIDATOR_MODULE = 'class-validator';

/**
 * The module the `class-transformer` decorators are imported from.
 */
const CLASS_TRANSFORMER_MODULE = 'class-transformer';

/**
 * The definition for a `class-validator` decorator that depends on the resolved single type of a property.
 *
 * When {@link DecoratorDefinition.source} is not provided, the decorator is rendered as `@<name>(<arrayOptions>)`.
 */
type DecoratorDefinition = {
  /**
   * The decorator name.
   */
  name: string;

  /**
   * The source generator for the decorator.
   */
  source?: (singleType: PropertyType | Schema, arrayOptions: string) => string;
};

/**
 * Maps the resolved single-type kind of a property to the `class-validator` decorators that apply.
 *
 * The key is either a primitive type name (e.g. `'string'`, `'uuid'`) or a non-primitive {@link PropertyType.kind} /
 * {@link Schema.kind} (e.g. `'enum'`, `'object'`, `'map'`).
 */
const KIND_TO_DECORATORS: Record<string, DecoratorDefinition[]> = {
  string: [{ name: 'IsString' }],
  integer: [{ name: 'IsInt' }],
  number: [{ name: 'IsNumber' }],
  boolean: [{ name: 'IsBoolean' }],
  uuid: [
    {
      name: 'IsUUID',
      // The first argument is the UUID version, which is not specified in the schema.
      source: (_, opts) => appendCall('@IsUUID', 'undefined', opts),
    },
  ],
  datetime: [{ name: 'IsDate' }],
  null: [
    {
      name: 'Equals',
      source: (_, opts) => appendCall('@Equals', 'null', opts),
    },
  ],
  const: [
    {
      name: 'Equals',
      source: (t, opts) =>
        appendCall(
          '@Equals',
          JSON.stringify((t as ConstPropertyType).value),
          opts,
        ),
    },
  ],
  enum: [
    {
      name: 'IsIn',
      source: (t, opts) =>
        appendCall('@IsIn', JSON.stringify((t as EnumSchema).values), opts),
    },
  ],
  object: [
    { name: 'IsObject' },
    { name: 'ValidateNested', source: () => '@ValidateNested()' },
  ],
  map: [{ name: 'IsObject' }],
  // Nested arrays: combined with the outer `@IsArray()`, this `@IsArray({ each: true })` checks that every item of
  // the outer array is itself an array. Inner-item types are not validated.
  array: [{ name: 'IsArray' }],
};

/**
 * Returns the `class-validator` (and supporting `class-transformer`) decorators for the given property.
 *
 * @param schema The class the decorators are being generated for.
 * @param property The property within {@link schema} the decorators are being generated for, or `undefined` when the
 *   target is the class itself.
 * @param schemas The full schema map, used to resolve `ref` types.
 * @returns The decorators to add to the property, or an empty array when the target is a class.
 */
export function makeClassValidatorDecorators(
  schema: ObjectSchema,
  property: Property | undefined,
  schemas: Record<string, Schema>,
): TypeScriptDecorator[] {
  if (!property) {
    return [];
  }

  if (typeof property.extensions.tsType === 'string') {
    return [];
  }

  const target = { schema, property };
  const decorators: TypeScriptDecorator[] = [];
  buildValidators(decorators, target, schemas);

  // Ensure the property carries at least one `class-validator` decorator so it isn't rejected under whitelist
  // validation. Only applied to required, non-nullable properties, otherwise the Causa `@IsNullable` / `@AllowMissing`
  // decorators already cover the property and `@Allow` would override their behavior.
  if (decorators.length === 0 && property.required && !property.nullable) {
    addDecoratorToList(
      decorators,
      target,
      'Allow',
      CLASS_VALIDATOR_MODULE,
      '@Allow()',
    );
  }

  return decorators;
}

/**
 * Populates {@link decorators} with the `class-validator` / `class-transformer` decorators that apply to the given
 * property's type. Returns early without throwing when the type cannot be mapped to any validator, leaving `decorators`
 * partially populated.
 */
function buildValidators(
  decorators: TypeScriptDecorator[],
  target: { schema: ObjectSchema; property: Property },
  schemas: Record<string, Schema>,
): void {
  const { property } = target;
  const isArray = property.type.kind === 'array';
  let singleType: PropertyType | Schema =
    property.type.kind === 'array' ? property.type.items : property.type;
  if (singleType.kind === 'ref') {
    const resolved = schemas[singleType.ref];
    if (!resolved) {
      return;
    }
    singleType = resolved;
  }

  let arrayOptions = '';
  if (isArray) {
    arrayOptions = '{ each: true }';
    addDecoratorToList(
      decorators,
      target,
      'IsArray',
      CLASS_VALIDATOR_MODULE,
      '@IsArray()',
    );
  }

  const kind =
    singleType.kind === 'primitive' ? singleType.type : singleType.kind;

  for (const { name, source } of KIND_TO_DECORATORS[kind] ?? []) {
    addDecoratorToList(
      decorators,
      target,
      name,
      CLASS_VALIDATOR_MODULE,
      source?.(singleType, arrayOptions) ??
        appendCall(`@${name}`, arrayOptions),
    );
  }

  let typeName: string | null = null;
  if (kind === 'object') {
    if (property.required) {
      // Contrary to base types, by default a nested type won't throw an error if it's not defined.
      addDecoratorToList(
        decorators,
        target,
        'IsDefined',
        CLASS_VALIDATOR_MODULE,
        '@IsDefined()',
      );
    }
    typeName = (singleType as ObjectSchema).name;
  } else if (kind === 'datetime') {
    typeName = 'Date';
  }

  if (typeName) {
    addDecoratorToList(
      decorators,
      target,
      'Type',
      CLASS_TRANSFORMER_MODULE,
      `@Type(() => ${typeName})`,
    );
  }
}

/**
 * Returns the decorator source for the given positional arguments. Empty-string entries are skipped, so callers can
 * pass conditional arguments (e.g. an array-options object) inline.
 */
function appendCall(decorator: string, ...args: string[]): string {
  return `${decorator}(${args.filter((a) => a !== '').join(', ')})`;
}
