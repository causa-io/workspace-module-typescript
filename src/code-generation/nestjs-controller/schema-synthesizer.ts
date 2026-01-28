import type { ParsedOperation, ParsedParameter } from './openapi-parser.js';

/**
 * A JSON Schema object that can be used with quicktype.
 */
export type JsonSchema = {
  /**
   * The title of the schema, used as the class name.
   */
  title: string;

  /**
   * The type of the schema (always "object" for parameter schemas).
   */
  type: 'object';

  /**
   * A description of the schema.
   */
  description?: string;

  /**
   * Whether additional properties are allowed.
   */
  additionalProperties: false;

  /**
   * The properties of the schema.
   */
  properties: Record<string, Record<string, unknown>>;

  /**
   * The required properties.
   */
  required: string[];
};

/**
 * A synthesized schema with its name and content.
 */
export type SynthesizedSchema = {
  /**
   * The name of the schema (used as the class name).
   */
  name: string;

  /**
   * The JSON Schema content as a string.
   */
  schema: string;
};

/**
 * Converts a PascalCase or camelCase operation ID to PascalCase.
 *
 * @param operationId The operation ID.
 * @returns The PascalCase version.
 */
function toPascalCase(operationId: string): string {
  return operationId.charAt(0).toUpperCase() + operationId.slice(1);
}

/**
 * Builds the name for a path parameters class.
 *
 * @param operationId The operation ID.
 * @returns The class name for path parameters.
 */
export function buildPathParamsClassName(operationId: string): string {
  return `${toPascalCase(operationId)}PathParams`;
}

/**
 * Builds the name for a query parameters class.
 *
 * @param operationId The operation ID.
 * @returns The class name for query parameters.
 */
export function buildQueryParamsClassName(operationId: string): string {
  return `${toPascalCase(operationId)}QueryParams`;
}

/**
 * Builds a JSON Schema property from a parsed parameter.
 *
 * @param param The parsed parameter.
 * @returns The JSON Schema property definition.
 */
function buildPropertySchema(param: ParsedParameter): Record<string, unknown> {
  const property: Record<string, unknown> = { ...param.schema };

  if (param.description) {
    property.description = param.description;
  }

  return property;
}

/**
 * Synthesizes a JSON Schema for a set of parameters.
 *
 * @param className The name for the generated class.
 * @param parameters The parameters to include in the schema.
 * @param description An optional description for the schema.
 * @returns The synthesized JSON Schema, or `undefined` if there are no parameters.
 */
function synthesizeParameterSchema(
  className: string,
  parameters: ParsedParameter[],
  description?: string,
): JsonSchema | undefined {
  if (parameters.length === 0) {
    return undefined;
  }

  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const param of parameters) {
    properties[param.name] = buildPropertySchema(param);
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    title: className,
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
): SynthesizedSchema[] {
  const schemas: SynthesizedSchema[] = [];

  // Separate parameters by location
  const pathParams = operation.parameters.filter((p) => p.in === 'path');
  const queryParams = operation.parameters.filter((p) => p.in === 'query');

  // Synthesize path parameters schema
  const pathParamsClassName = buildPathParamsClassName(operation.operationId);
  const pathParamsSchema = synthesizeParameterSchema(
    pathParamsClassName,
    pathParams,
    `The path parameters for the \`${operation.operationId}\` operation.`,
  );

  if (pathParamsSchema) {
    schemas.push({
      name: pathParamsClassName,
      schema: JSON.stringify(pathParamsSchema),
    });
  }

  // Synthesize query parameters schema
  const queryParamsClassName = buildQueryParamsClassName(operation.operationId);
  const queryParamsSchema = synthesizeParameterSchema(
    queryParamsClassName,
    queryParams,
    `The query parameters for the \`${operation.operationId}\` operation.`,
  );

  if (queryParamsSchema) {
    schemas.push({
      name: queryParamsClassName,
      schema: JSON.stringify(queryParamsSchema),
    });
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
): SynthesizedSchema[] {
  const schemas: SynthesizedSchema[] = [];

  for (const operation of operations) {
    schemas.push(...synthesizeSchemasForOperation(operation));
  }

  return schemas;
}
