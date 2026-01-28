import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import type { JSONSchemaSourceData } from 'quicktype-core';
import type { ParsedOperation, ParsedParameter } from './types.js';

/**
 * Builds the key for a parameter schema in the generated schemas registry.
 *
 * @param operationId The operation ID.
 * @param location The parameter location ('path' or 'query').
 * @returns The key for the generated schemas registry.
 */

export function getParameterSchemaKey(
  operationId: string,
  location: OpenAPIV3_1.ParameterLocation,
): string {
  return `${operationId}/${location}`;
}

/**
 * Constructs the JSON Schema for a set of parameters with the same location..
 *
 * @param operationId The operation ID.
 * @param location The location of the parameters (e.g., 'path' or 'query').
 * @param parameters The parameters to include in the schema.
 * @returns The JSON Schema.
 */
function makeParametersSchemaForLocation(
  operationId: string,
  location: OpenAPIV3_1.ParameterLocation,
  parameters: ParsedParameter[],
): OpenAPIV3_1.SchemaObject {
  // Although TypeScript naming should be PascalCase, kebab-case (or a mix of) ensures the title components are
  // correctly separated. Code generation will ensure this is converted to PascalCase.
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
 * Constructs JSON Schemas for path and query parameters of an operation.
 *
 * @param operation The parsed operation.
 * @returns An array of JSON Schemas.
 */
function makeParametersSchemasForOperation(
  operation: ParsedOperation,
): JSONSchemaSourceData[] {
  const schemas: JSONSchemaSourceData[] = [];

  for (const location of ['path', 'query'] as const) {
    const params = operation.parameters.filter((p) => p.in === location);
    if (params.length === 0) {
      continue;
    }

    const name = getParameterSchemaKey(operation.operationId, location);
    const schema = makeParametersSchemaForLocation(
      operation.operationId,
      location,
      params,
    );

    schemas.push({ name, schema: JSON.stringify(schema) });
  }

  return schemas;
}

/**
 * Constructs JSON Schemas for all operations in a parsed API specification.
 *
 * @param operations The parsed operations.
 * @returns An array of all JSON Schemas.
 */
export function makeParametersSchemasForOperations(
  operations: ParsedOperation[],
): JSONSchemaSourceData[] {
  const schemas: JSONSchemaSourceData[] = [];

  for (const operation of operations) {
    schemas.push(...makeParametersSchemasForOperation(operation));
  }

  return schemas;
}
