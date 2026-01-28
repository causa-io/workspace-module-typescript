import type { OpenAPIV3, OpenAPIV3_1 } from '@scalar/openapi-types';
import { load } from 'js-yaml';
import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';

/**
 * The supported HTTP methods for NestJS controller generation.
 */
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * A supported HTTP method.
 */
export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * A parameter extracted from an OpenAPI operation.
 */
export type ParsedParameter = {
  /**
   * The name of the parameter.
   */
  name: string;

  /**
   * The location of the parameter (path, query, header, cookie).
   */
  in: 'path' | 'query' | 'header' | 'cookie';

  /**
   * Whether the parameter is required.
   */
  required: boolean;

  /**
   * A description of the parameter.
   */
  description?: string;

  /**
   * The JSON Schema for the parameter.
   */
  schema: Record<string, unknown>;
};

/**
 * A request body extracted from an OpenAPI operation.
 */
export type ParsedRequestBody = {
  /**
   * Whether the request body is required.
   */
  required: boolean;

  /**
   * The `$ref` to the schema, if present.
   */
  schemaRef?: string;

  /**
   * The inline schema, if no `$ref` is present.
   */
  schema?: Record<string, unknown>;
};

/**
 * A response extracted from an OpenAPI operation.
 */
export type ParsedResponse = {
  /**
   * The HTTP status code for the response.
   */
  statusCode: string;

  /**
   * A description of the response.
   */
  description?: string;

  /**
   * The `$ref` to the schema, if present.
   */
  schemaRef?: string;

  /**
   * The inline schema, if no `$ref` is present.
   */
  schema?: Record<string, unknown>;
};

/**
 * An operation extracted from an OpenAPI specification.
 */
export type ParsedOperation = {
  /**
   * The unique identifier for the operation.
   */
  operationId: string;

  /**
   * The HTTP method for the operation.
   */
  method: HttpMethod;

  /**
   * The full path for the operation (e.g., `/posts/{id}`).
   */
  path: string;

  /**
   * A summary of the operation.
   */
  summary?: string;

  /**
   * A description of the operation.
   */
  description?: string;

  /**
   * The parameters for the operation.
   */
  parameters: ParsedParameter[];

  /**
   * The request body for the operation, if present.
   */
  requestBody?: ParsedRequestBody;

  /**
   * The responses for the operation.
   */
  responses: ParsedResponse[];
};

/**
 * An API specification parsed from an OpenAPI document.
 */
export type ParsedApiSpec = {
  /**
   * The path to the OpenAPI file.
   */
  filePath: string;

  /**
   * The title of the API (from `info.title`).
   */
  title: string;

  /**
   * The resource name derived from the title (e.g., "Post API" -> "Post").
   */
  resourceName: string;

  /**
   * A description of the API.
   */
  description?: string;

  /**
   * The common path prefix for all operations (e.g., `/posts`).
   */
  basePath: string;

  /**
   * The operations defined in the specification.
   */
  operations: ParsedOperation[];
};

/**
 * Checks if an object is a reference object.
 *
 * @param obj The object to check.
 * @returns `true` if the object is a reference object.
 */
function isReferenceObject(
  obj: unknown,
): obj is OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject {
  return typeof obj === 'object' && obj !== null && '$ref' in obj;
}

/**
 * Derives the resource name from the API title.
 * E.g., "Post API" -> "Post", "PostImportJob API" -> "PostImportJob".
 *
 * @param title The API title from `info.title`.
 * @returns The derived resource name.
 */
export function deriveResourceName(title: string): string {
  // Remove common suffixes like "API", "Service", etc.
  const cleaned = title.replace(/\s+(API|Service|Controller)$/i, '').trim();

  // Convert to PascalCase if it contains spaces
  if (cleaned.includes(' ')) {
    return cleaned
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  // Ensure first letter is uppercase
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Computes the common path prefix for a list of paths.
 *
 * @param paths The list of paths.
 * @returns The common path prefix.
 */
export function computeBasePath(paths: string[]): string {
  if (paths.length === 0) {
    return '';
  }

  if (paths.length === 1) {
    // For a single path, use the first segment
    const segments = paths[0].split('/').filter(Boolean);
    return segments.length > 0 ? `/${segments[0]}` : '';
  }

  // Split all paths into segments
  const segmentArrays = paths.map((p) => p.split('/').filter(Boolean));

  // Find common prefix segments
  const commonSegments: string[] = [];
  const minLength = Math.min(...segmentArrays.map((s) => s.length));

  for (let i = 0; i < minLength; i++) {
    const segment = segmentArrays[0][i];
    // Don't include path parameters in the common prefix if they differ
    if (segmentArrays.every((s) => s[i] === segment)) {
      commonSegments.push(segment);
    } else {
      break;
    }
  }

  return commonSegments.length > 0 ? `/${commonSegments.join('/')}` : '';
}

/**
 * Computes the sub-path for an operation, relative to the base path.
 *
 * @param fullPath The full path of the operation.
 * @param basePath The base path of the API.
 * @returns The sub-path, with `{param}` replaced by `:param`.
 */
export function computeSubPath(fullPath: string, basePath: string): string {
  let subPath = fullPath;

  if (basePath && fullPath.startsWith(basePath)) {
    subPath = fullPath.slice(basePath.length);
  }

  // Remove leading slash
  if (subPath.startsWith('/')) {
    subPath = subPath.slice(1);
  }

  // Replace {param} with :param
  return subPath.replace(/\{([^}]+)\}/g, ':$1');
}

/**
 * Derives the method name from the operation ID by removing the resource prefix.
 * E.g., "postImportJobRetry" with resource "PostImportJob" -> "retry".
 *
 * @param operationId The operation ID.
 * @param resourceName The resource name.
 * @returns The derived method name.
 */
export function deriveMethodName(
  operationId: string,
  resourceName: string,
): string {
  // Convert resource name to the same case as the operationId prefix
  const lowerResourceName =
    resourceName.charAt(0).toLowerCase() + resourceName.slice(1);

  if (operationId.startsWith(lowerResourceName)) {
    const methodName = operationId.slice(lowerResourceName.length);
    // Lowercase the first letter
    return methodName.charAt(0).toLowerCase() + methodName.slice(1);
  }

  // If no prefix match, return the operationId as-is
  return operationId;
}

/**
 * Resolves a `$ref` path relative to the OpenAPI file.
 *
 * @param ref The `$ref` value (e.g., `../entities/post.yaml`).
 * @param openApiFilePath The path to the OpenAPI file containing the reference.
 * @returns The resolved absolute path.
 */
export function resolveRefPath(ref: string, openApiFilePath: string): string {
  // Remove any fragment identifier
  const refPath = ref.split('#')[0];

  if (!refPath) {
    // Reference to the same file
    return openApiFilePath;
  }

  return resolve(dirname(openApiFilePath), refPath);
}

/**
 * Parses a parameter object from the OpenAPI specification.
 *
 * @param param The parameter object.
 * @returns The parsed parameter.
 */
function parseParameter(
  param: OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject,
): ParsedParameter {
  const schema = param.schema;
  let parsedSchema: Record<string, unknown> = { type: 'string' };

  if (schema && !isReferenceObject(schema)) {
    parsedSchema = schema as Record<string, unknown>;
  }

  return {
    name: param.name ?? '',
    in: param.in as ParsedParameter['in'],
    required: param.required ?? param.in === 'path',
    description: param.description,
    schema: parsedSchema,
  };
}

/**
 * Parses a request body object from the OpenAPI specification.
 *
 * @param requestBody The request body object.
 * @returns The parsed request body.
 */
function parseRequestBody(
  requestBody: OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject,
): ParsedRequestBody {
  const content = requestBody.content ?? {};
  const jsonContent = content['application/json'];

  if (!jsonContent) {
    return { required: requestBody.required ?? false };
  }

  const schema = jsonContent.schema;

  if (isReferenceObject(schema)) {
    return {
      required: requestBody.required ?? false,
      schemaRef: schema.$ref,
    };
  }

  return {
    required: requestBody.required ?? false,
    schema: schema as Record<string, unknown> | undefined,
  };
}

/**
 * Parses responses from an OpenAPI operation.
 *
 * @param responses The responses object.
 * @returns The parsed responses.
 */
function parseResponses(
  responses: OpenAPIV3.ResponsesObject | OpenAPIV3_1.ResponsesObject,
): ParsedResponse[] {
  const parsed: ParsedResponse[] = [];

  for (const [statusCode, response] of Object.entries(responses)) {
    if (!response || isReferenceObject(response)) {
      continue;
    }

    const content = response.content ?? {};
    const jsonContent = content['application/json'];

    if (!jsonContent) {
      // Response without a body (e.g., 204)
      parsed.push({
        statusCode,
        description: response.description,
      });
      continue;
    }

    const schema = jsonContent.schema;

    if (isReferenceObject(schema)) {
      parsed.push({
        statusCode,
        description: response.description,
        schemaRef: schema.$ref,
      });
    } else {
      parsed.push({
        statusCode,
        description: response.description,
        schema: schema as Record<string, unknown> | undefined,
      });
    }
  }

  return parsed;
}

/**
 * Parses an operation from the OpenAPI specification.
 *
 * @param method The HTTP method.
 * @param path The path for the operation.
 * @param operation The operation object.
 * @param pathLevelParams Parameters defined at the path level.
 * @returns The parsed operation, or `undefined` if the operation is invalid.
 */
function parseOperation(
  method: HttpMethod,
  path: string,
  operation: OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject,
  pathLevelParams: (
    | OpenAPIV3.ParameterObject
    | OpenAPIV3_1.ParameterObject
  )[] = [],
): ParsedOperation | undefined {
  const operationId = operation.operationId;

  if (!operationId) {
    return undefined;
  }

  // Merge path-level and operation-level parameters
  const allParams = [...pathLevelParams];
  const operationParams = operation.parameters ?? [];

  for (const param of operationParams) {
    if (isReferenceObject(param)) {
      continue;
    }
    // Operation-level params override path-level params with the same name/in
    const existingIndex = allParams.findIndex(
      (p) => p.name === param.name && p.in === param.in,
    );
    if (existingIndex >= 0) {
      allParams[existingIndex] = param;
    } else {
      allParams.push(param);
    }
  }

  const parameters = allParams.map(parseParameter);

  // Parse request body
  let requestBody: ParsedRequestBody | undefined;
  if (operation.requestBody && !isReferenceObject(operation.requestBody)) {
    requestBody = parseRequestBody(operation.requestBody);
  }

  // Parse responses
  const responses = parseResponses(operation.responses ?? {});

  return {
    operationId,
    method,
    path,
    summary: operation.summary,
    description: operation.description,
    parameters,
    requestBody,
    responses,
  };
}

/**
 * Parses an OpenAPI specification from a YAML file.
 *
 * @param filePath The path to the OpenAPI YAML file.
 * @returns The parsed API specification.
 */
export async function parseOpenApiSpec(
  filePath: string,
): Promise<ParsedApiSpec> {
  const content = await readFile(filePath, 'utf-8');
  const doc = load(content) as OpenAPIV3.Document | OpenAPIV3_1.Document;

  const title = doc.info?.title ?? 'Unknown API';
  const resourceName = deriveResourceName(title);
  const description = doc.info?.description;

  const operations: ParsedOperation[] = [];
  const allPaths: string[] = [];

  const paths = doc.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) {
      continue;
    }

    allPaths.push(path);

    // Collect path-level parameters
    const pathLevelParams: (
      | OpenAPIV3.ParameterObject
      | OpenAPIV3_1.ParameterObject
    )[] = [];
    for (const param of pathItem.parameters ?? []) {
      if (!isReferenceObject(param)) {
        pathLevelParams.push(param);
      }
    }

    // Parse operations for each HTTP method
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }

      const parsed = parseOperation(method, path, operation, pathLevelParams);
      if (parsed) {
        operations.push(parsed);
      }
    }
  }

  const basePath = computeBasePath(allPaths);

  return {
    filePath,
    title,
    resourceName,
    description,
    basePath,
    operations,
  };
}
