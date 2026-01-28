import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import type { JSONSchemaSourceData } from 'quicktype-core';
import type { ParsedOperation, ParsedParameter } from './types.js';
import { getParameterSchemaKey } from './utilities.js';

/**
 * Synthesizes a JSON Schema for a set of parameters.
 *
 * @param title The name for the generated class.
 * @param parameters The parameters to include in the schema.
 * @param description An optional description for the schema.
 * @returns The synthesized JSON Schema, or `undefined` if there are no parameters.
 */
function synthesizeParameterSchema(
  operationId: string,
  location: OpenAPIV3_1.ParameterLocation,
  parameters: ParsedParameter[],
): OpenAPIV3_1.SchemaObject {
  const title = `${operationId}-${location}-params`;
  const description = `The ${location} parameters for the \`${operationId}\` operation.`;
  const properties: OpenAPIV3_1.BaseSchemaObject['properties'] = {};
  const required: string[] = [];

  for (const {
    schema,
    required: isRequired,
    description,
    name,
  } of parameters) {
    properties[name] = { description, ...schema };
    if (isRequired) {
      required.push(name);
    }
  }

  return {
    title,
    type: 'object',
    description,
    additionalProperties: false,
    properties,
    required,
  };
}

/**
 * Synthesizes JSON Schemas for path and query parameters of an operation.
 *
 * @param operation The parsed operation.
 * @returns An array of synthesized schemas (may be empty, one, or two items).
 */
export function synthesizeSchemasForOperation(
  operation: ParsedOperation,
): JSONSchemaSourceData[] {
  const schemas: JSONSchemaSourceData[] = [];

  for (const location of ['path', 'query', 'header'] as const) {
    const params = operation.parameters.filter((p) => p.in === location);
    if (params.length === 0) {
      continue;
    }

    const name = getParameterSchemaKey(operation.operationId, location);
    const schema = synthesizeParameterSchema(
      operation.operationId,
      location,
      params,
    );

    schemas.push({ name, schema: JSON.stringify(schema) });
  }

  return schemas;
}

/**
 * Synthesizes JSON Schemas for all operations in a parsed API specification.
 *
 * @param operations The parsed operations.
 * @returns An array of all synthesized schemas.
 */
export function synthesizeSchemasForOperations(
  operations: ParsedOperation[],
): JSONSchemaSourceData[] {
  const schemas: JSONSchemaSourceData[] = [];

  for (const operation of operations) {
    schemas.push(...synthesizeSchemasForOperation(operation));
  }

  return schemas;
}
