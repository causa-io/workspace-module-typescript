import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { dirname, isAbsolute, resolve } from 'path';
import type { JSONSchemaSourceData } from 'quicktype-core';
import type {
  ParsedApiSpecification,
  ParsedOperation,
  ParsedParameter,
} from './types.js';

/**
 * Recursively rewrites relative `$ref` paths in a schema to absolute paths.
 *
 * @param obj The object to process.
 * @param specFileDir The directory of the OpenAPI specification file.
 * @returns A new object with absolute `$ref` paths.
 */
function rewriteSchemaRefs<T>(
  obj: T,
  specFileDir: string,
): T extends object ? Record<string, unknown> : T {
  if (obj === null || typeof obj !== 'object') {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => rewriteSchemaRefs(item, specFileDir)) as any;
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (key !== '$ref' || typeof value !== 'string') {
        return [key, rewriteSchemaRefs(value, specFileDir)];
      }

      const [filePart, fragment] = value.split('#', 2);
      if (filePart === '' || URL.canParse(filePart) || isAbsolute(filePart)) {
        return [key, value];
      }

      const absolutePath = resolve(specFileDir, filePart);
      const rewritten =
        fragment !== undefined ? `${absolutePath}#${fragment}` : absolutePath;
      return [key, rewritten];
    }),
  ) as any;
}

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
 * Constructs the JSON Schema for a set of parameters with the same location.
 *
 * @param operationId The operation ID.
 * @param location The location of the parameters (e.g., 'path' or 'query').
 * @param parameters The parameters to include in the schema.
 * @param specFilePath The absolute path to the OpenAPI specification file.
 * @returns The JSON Schema.
 */
function makeParametersSchemaForLocation(
  operationId: string,
  location: OpenAPIV3_1.ParameterLocation,
  parameters: ParsedParameter[],
  specFilePath: string,
): OpenAPIV3_1.SchemaObject {
  // Although TypeScript naming should be PascalCase, kebab-case (or a mix of) ensures the title components are
  // correctly separated. Code generation will ensure this is converted to PascalCase.
  const title = `${operationId}-${location}-params`;
  const description = `The ${location} parameters for the \`${operationId}\` operation.`;
  const properties: OpenAPIV3_1.BaseSchemaObject['properties'] = {};
  const required: string[] = [];

  const specFileDir = dirname(specFilePath);

  for (const {
    schema,
    required: isRequired,
    description,
    name,
  } of parameters) {
    const rewrittenSchema = rewriteSchemaRefs(schema, specFileDir);
    properties[name] = { description, ...rewrittenSchema };
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
 * @param specFilePath The absolute path to the OpenAPI specification file.
 * @returns An array of JSON Schemas.
 */
function makeParametersSchemasForOperation(
  operation: ParsedOperation,
  specFilePath: string,
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
      specFilePath,
    );

    schemas.push({ name, schema: JSON.stringify(schema) });
  }

  return schemas;
}

/**
 * Constructs JSON Schemas for all operations in a parsed API specification.
 *
 * @param spec The parsed API specification.
 * @returns An array of all JSON Schemas.
 */
export function makeParametersSchemasForSpecification({
  operations,
  filePath,
}: ParsedApiSpecification): JSONSchemaSourceData[] {
  return operations.flatMap((operation) =>
    makeParametersSchemasForOperation(operation, filePath),
  );
}
