import type {
  ArrayPropertyType,
  EnumSchema,
  ObjectSchema,
  Property,
  PropertyType,
  Schema,
} from '@causa/workspace-core';
import type { TypeScriptDecorator } from './generator.js';
import { addDecoratorToList } from './utilities.js';

/**
 * The module that exports the NestJS OpenAPI decorators.
 */
const NESTJS_SWAGGER_MODULE = '@nestjs/swagger';

/**
 * The Causa attribute that opts a class into the OpenAPI decorators.
 */
const OPENAPI_ATTRIBUTE = 'tsOpenApi';

/**
 * Returns the NestJS Swagger decorators for the given class or property.
 *
 * Schemas without the {@link OPENAPI_ATTRIBUTE} causa extension are skipped.
 *
 * @param schema The class the decorators are being generated for.
 * @param property The property within {@link schema} the decorators are being generated for, or `undefined` when the
 *   target is the class itself.
 * @param schemas The full schema map, used to resolve `ref` types.
 */
export function makeOpenApiDecorators(
  schema: ObjectSchema,
  property: Property | undefined,
  schemas: Record<string, Schema>,
): TypeScriptDecorator[] {
  if (!schema.extensions[OPENAPI_ATTRIBUTE]) {
    return [];
  }

  return property
    ? propertyDecorators(schema, property, schemas)
    : classDecorators(schema, schemas);
}

/**
 * Returns the class-level decorators emitted by {@link makeOpenApiDecorators}.
 *
 * When the class references object schemas (directly or through arrays), NestJS Swagger needs `@ApiExtraModels` so the
 * referenced classes are registered alongside the parent. Schemas without any object references emit no class
 * decorators.
 *
 * @param schema The class the decorators are being generated for.
 * @param schemas The full schema map, used to resolve `ref` types.
 */
function classDecorators(
  schema: ObjectSchema,
  schemas: Record<string, Schema>,
): TypeScriptDecorator[] {
  const refs = new Set<string>();
  for (const property of schema.properties) {
    for (const name of listReferencedClassNames(property.type, schemas)) {
      refs.add(name);
    }
  }
  if (refs.size === 0) {
    return [];
  }

  const decorators: TypeScriptDecorator[] = [];
  const source = `@ApiExtraModels(${[...refs].join(', ')})`;
  addDecoratorToList(
    decorators,
    { schema },
    'ApiExtraModels',
    NESTJS_SWAGGER_MODULE,
    source,
    { imports: { [NESTJS_SWAGGER_MODULE]: ['getSchemaPath'] } },
  );
  return decorators;
}

/**
 * Returns the `@ApiProperty({ ... })` decorator for the given property.
 *
 * @param schema The class the property belongs to.
 * @param property The property the decorator is being generated for.
 * @param schemas The full schema map, used to resolve `ref` types.
 */
function propertyDecorators(
  schema: ObjectSchema,
  property: Property,
  schemas: Record<string, Schema>,
): TypeScriptDecorator[] {
  const target = { schema, property };
  const description = property.description?.trim();
  const required = property.required;

  const inner = typeToDecoratorOptions(property.type, property.nullable, {
    required,
    isArrayItem: false,
    schemas,
  });

  const fields: string[] = [];
  if (description) {
    fields.push(`description: ${JSON.stringify(description)}`);
  }
  fields.push(...inner);

  const decorators: TypeScriptDecorator[] = [];
  addDecoratorToList(
    decorators,
    target,
    'ApiProperty',
    NESTJS_SWAGGER_MODULE,
    `@ApiProperty({ ${fields.join(', ')} })`,
  );
  return decorators;
}

/**
 * Returns the ordered list of `key: value` parts that should appear inside the `@ApiProperty({...})` options for the
 * given property type. The returned strings are joined with `, ` by the caller.
 *
 * The shape mirrors the JSON-Schema-like spec consumed by NestJS Swagger:
 * - primitives produce `type: "..."` (and `format: "..."` for `uuid`/`datetime`),
 * - object refs produce `$ref: getSchemaPath(...)` when an explicit reference is required (array items / nullable),
 * - enums produce `type: "string"` plus `enum: [...]`,
 * - arrays produce `type: "array"` plus an `items: { ... }` wrapper,
 * - maps produce `type: "object"` plus `additionalProperties`,
 * - nullable properties are wrapped in a `oneOf: [..., { type: "null" }]`,
 * - `required: <bool>` is prepended when {@link ctx.required} is set (except for `map`, which uses `selfRequired`).
 *
 * @param type The property type to convert.
 * @param nullable Whether the property accepts `null`.
 * @param ctx Recursion context: whether this call is for an array item, the schema map for ref resolution, and the
 *   optional `required` flag forwarded to the top-level emit.
 */
function typeToDecoratorOptions(
  type: PropertyType,
  nullable: boolean,
  ctx: {
    required?: boolean;
    isArrayItem: boolean;
    schemas: Record<string, Schema>;
  },
): string[] {
  const { isArrayItem, schemas } = ctx;
  let { required } = ctx;

  const fields: string[] = [];

  const isArray = type.kind === 'array';
  const innerType = isArray ? type.items : type;
  const resolved =
    innerType.kind === 'ref' ? schemas[innerType.ref] : undefined;

  if (isArray) {
    const itemNullable = (type as ArrayPropertyType).itemNullable;
    const itemFields = typeToDecoratorOptions(innerType, itemNullable, {
      isArrayItem: true,
      schemas,
    });
    fields.push(`type: "array"`);
    fields.push(`items: { ${itemFields.join(', ')} }`);
  } else {
    const kind = resolved?.kind ?? innerType.kind;
    if (kind === 'object') {
      if (isArrayItem || nullable) {
        fields.push(`$ref: getSchemaPath(${(resolved as ObjectSchema).name})`);
      }
    } else if (kind === 'enum') {
      const e = resolved as EnumSchema;
      fields.push(`type: "string"`);
      fields.push(`enum: ${JSON.stringify(e.values)}`);
    } else if (innerType.kind === 'primitive') {
      switch (innerType.type) {
        case 'string':
          fields.push(`type: "string"`);
          break;
        case 'uuid':
          fields.push(`type: "string"`);
          fields.push(`format: "uuid"`);
          break;
        case 'datetime':
          fields.push(`type: "string"`);
          fields.push(`format: "date-time"`);
          break;
        case 'integer':
          fields.push(`type: "integer"`);
          break;
        case 'number':
          fields.push(`type: "number"`);
          break;
        case 'boolean':
          fields.push(`type: "boolean"`);
          break;
      }
    } else if (innerType.kind === 'map') {
      fields.push(`type: "object"`);
      if (required !== undefined) {
        // For `object` types, the `required` option is ambiguous; `selfRequired` is used instead.
        fields.unshift(`selfRequired: ${required}`);
        required = undefined;
      }
      if (innerType.items === 'any') {
        fields.push('additionalProperties: true');
      } else {
        const itemFields = typeToDecoratorOptions(innerType.items, false, {
          isArrayItem: false,
          schemas,
        });
        fields.push(`additionalProperties: { ${itemFields.join(', ')} }`);
      }
    } else if (innerType.kind === 'null') {
      fields.push(`type: "null"`);
    }
  }

  const out = nullable
    ? [`oneOf: [{ ${fields.join(', ')} }, { type: "null" }]`]
    : fields;
  return required === undefined ? out : [`required: ${required}`, ...out];
}

/**
 * Returns the names of every object schema referenced (directly or through arrays) by the given property type. Used to
 * collect the classes that should be listed in the `@ApiExtraModels(...)` class decorator.
 *
 * @param type The property type to inspect.
 * @param schemas The full schema map, used to resolve `ref` types.
 */
function listReferencedClassNames(
  type: PropertyType,
  schemas: Record<string, Schema>,
): string[] {
  if (type.kind === 'array') {
    return listReferencedClassNames(type.items, schemas);
  }
  if (type.kind === 'ref') {
    const resolved = schemas[type.ref];
    if (resolved?.kind === 'object') {
      return [resolved.name];
    }
  }
  return [];
}
