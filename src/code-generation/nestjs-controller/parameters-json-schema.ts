import type {
  ObjectSchema,
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
 * `uuid` / `date-time` format hints), arrays of supported types, and `$ref` (directly or wrapped in a single-member
 * `oneOf`, the shape Scalar emits when a parameter references an external enum).
 */
function propertyTypeForSchema(
  schema: Record<string, unknown>,
  filePath: string,
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
    return propertyTypeForSchema(schema.oneOf[0], filePath);
  }

  if (schema.type === 'array') {
    const items = (schema.items ?? {}) as Record<string, unknown>;
    return {
      kind: 'array',
      items: propertyTypeForSchema(items, filePath),
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
 * Returns the {@link ObjectSchema} for the parameters of a single operation + location, or `undefined` when the
 * operation has no parameter in that location.
 */
function objectSchemaForLocation(
  operation: ParsedOperation,
  location: OpenAPIV3_1.ParameterLocation,
  filePath: string,
): ObjectSchema | undefined {
  const params = operation.parameters.filter((p) => p.in === location);
  if (params.length === 0) {
    return undefined;
  }

  const path = getParameterSchemaKey(operation.operationId, location);
  // Although TypeScript naming should be PascalCase, kebab-case ensures the title components are correctly separated.
  // Code generation will convert it to PascalCase.
  const name = `${operation.operationId}-${location}-params`;
  return {
    kind: 'object',
    name,
    path,
    description: `The ${location} parameters for the \`${operation.operationId}\` operation.`,
    extensions: {},
    databases: [],
    properties: params.map((p) => ({
      name: p.name,
      type: propertyTypeForSchema(p.schema, filePath),
      nullable: false,
      required: p.required,
      description: p.description,
      extensions: {},
    })),
  };
}

/**
 * Constructs the {@link Schema}s describing the path and query parameter classes for every operation in the given
 * specification.
 */
export function makeParametersSchemasForSpecification(
  spec: ParsedApiSpecification,
): Record<string, Schema> {
  const result: Record<string, Schema> = {};
  for (const operation of spec.operations) {
    for (const location of ['path', 'query'] as const) {
      const schema = objectSchemaForLocation(
        operation,
        location,
        spec.filePath,
      );
      if (schema) {
        result[schema.path] = schema;
      }
    }
  }
  return result;
}
