import type {
  PrimitiveType,
  PropertyType,
  Schema,
} from '@causa/workspace-core';
import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { dirname, resolve } from 'path';
import type { ParsedApiSpecification, ParsedOperation } from './types.js';

/**
 * Maps OpenAPI `format` annotations to the {@link PrimitiveType} they refine.
 */
const FORMAT_TO_PRIMITIVE: Record<string, PrimitiveType> = {
  uuid: 'uuid',
  'date-time': 'datetime',
};

/**
 * Returns the key for a parameter schema in the generated schemas registry.
 */
export function getParameterSchemaKey(
  operationId: string,
  location: OpenAPIV3_1.ParameterLocation,
): string {
  return `${operationId}/${location}`;
}

/**
 * Returns the {@link PropertyType} for an OpenAPI parameter schema fragment. Supports primitives (with the common
 * `uuid` / `date-time` format hints), arrays of supported types, `$ref` (directly or wrapped in a single-member
 * `oneOf`, the shape Scalar emits when a parameter references an external enum), and inline `enum` definitions
 * (registered as separate {@link EnumSchema}s in `result` and returned by reference).
 *
 * @param schema The OpenAPI schema fragment to convert.
 * @param filePath The absolute path of the OpenAPI specification file (used to resolve `$ref`s and to scope
 *   inline-enum synthetic paths).
 * @param result Accumulator into which any inline {@link EnumSchema} discovered during the walk is registered.
 */
function propertyTypeForSchema(
  schema: Record<string, unknown>,
  filePath: string,
  result: Record<string, Schema>,
): PropertyType {
  if (typeof schema.$ref === 'string') {
    const [refFile, fragment] = schema.$ref.split('#', 2);
    const absFile = refFile ? resolve(dirname(filePath), refFile) : filePath;
    const ref = fragment === undefined ? absFile : `${absFile}#${fragment}`;
    return { kind: 'ref', ref };
  }

  if (Array.isArray(schema.oneOf)) {
    if (schema.oneOf.length !== 1) {
      throw new Error(
        `Unsupported parameter schema: 'oneOf' with ${schema.oneOf.length} members. Only single-member 'oneOf' is supported.`,
      );
    }
    return propertyTypeForSchema(schema.oneOf[0], filePath, result);
  }

  if (Array.isArray(schema.enum)) {
    const { title: name, type, enum: values } = schema;
    if (typeof name !== 'string') {
      throw new Error(
        `Unsupported inline enum without a 'title'. Define a 'title' on the parameter schema so its TypeScript type can be named.`,
      );
    }
    if (type !== 'string' && type !== 'integer') {
      throw new Error(
        `Unsupported inline enum type '${String(type)}' for '${name}'. Only 'string' and 'integer' enums are supported.`,
      );
    }

    const path = `${filePath}#/inlineEnums/${name}`;
    result[path] = { kind: 'enum', type, name, path, extensions: {}, values };

    return { kind: 'ref', ref: path };
  }

  if (schema.type === 'array') {
    const items = (schema.items ?? {}) as Record<string, unknown>;
    return {
      kind: 'array',
      items: propertyTypeForSchema(items, filePath, result),
      itemNullable: false,
    };
  }

  const type = schema.type;
  if (typeof type !== 'string') {
    throw new Error(
      `Unsupported parameter schema: ${JSON.stringify(schema)}. Expected a primitive 'type', a '$ref', or a 'oneOf'.`,
    );
  }

  if (type === 'string') {
    const format = typeof schema.format === 'string' ? schema.format : '';
    return { kind: 'primitive', type: FORMAT_TO_PRIMITIVE[format] ?? 'string' };
  }
  if (type === 'integer' || type === 'number' || type === 'boolean') {
    return { kind: 'primitive', type };
  }

  throw new Error(`Unsupported parameter type '${type}'.`);
}

/**
 * Registers the {@link ObjectSchema} for the parameters of a single operation + location into `result`. Any inline
 * enum found in the parameter schemas is registered into `result` as well. No-op when the operation has no parameter
 * in that location.
 */
function registerLocationSchema(
  operation: ParsedOperation,
  location: OpenAPIV3_1.ParameterLocation,
  filePath: string,
  result: Record<string, Schema>,
): void {
  const params = operation.parameters.filter((p) => p.in === location);
  if (params.length === 0) {
    return;
  }

  const path = getParameterSchemaKey(operation.operationId, location);
  // Although TypeScript naming should be PascalCase, kebab-case ensures the title components are correctly separated.
  // Code generation will convert it to PascalCase.
  const name = `${operation.operationId}-${location}-params`;
  result[path] = {
    kind: 'object',
    name,
    path,
    description: `The ${location} parameters for the \`${operation.operationId}\` operation.`,
    extensions: {},
    databases: [],
    properties: params.map((p) => ({
      name: p.name,
      type: propertyTypeForSchema(p.schema, filePath, result),
      nullable: false,
      required: p.required,
      description: p.description,
      extensions: {},
    })),
  };
}

/**
 * Constructs the {@link Schema}s describing the path and query parameter classes for every operation in the given
 * specification. Any inline enum found in a parameter schema is materialized as a separate {@link EnumSchema} in the
 * returned map (under a synthetic `${filePath}#/inlineEnums/${title}` path) and referenced by the corresponding
 * property.
 */
export function makeParametersSchemasForSpecification(
  spec: ParsedApiSpecification,
): Record<string, Schema> {
  const result: Record<string, Schema> = {};
  for (const operation of spec.operations) {
    for (const location of ['path', 'query'] as const) {
      registerLocationSchema(operation, location, spec.filePath, result);
    }
  }
  return result;
}
