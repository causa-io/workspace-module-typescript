import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { readFile } from 'fs/promises';
import { load } from 'js-yaml';
import {
  HTTP_METHODS,
  type HttpMethod,
  type ParsedApiSpecification,
  type ParsedOperation,
  type ParsedParameter,
  type ParsedResponse,
} from './types.js';

/**
 * Checks if an object is a reference object.
 *
 * @param obj The object to check.
 * @returns `true` if the object is a reference object.
 */
function isReferenceObject(obj: unknown): obj is OpenAPIV3_1.ReferenceObject {
  return typeof obj === 'object' && obj !== null && '$ref' in obj;
}

/**
 * Computes the common path prefix for a list of paths.
 *
 * @param paths The list of paths.
 * @returns The common path prefix.
 */
function computeBasePath(paths: string[]): string {
  if (paths.length === 0) {
    return '';
  }

  const segmentArrays = paths.map((p) => p.split('/').filter(Boolean));

  if (segmentArrays.length === 1) {
    const segments = segmentArrays[0];
    return segments.length > 0 ? `/${segments[0]}` : '';
  }

  const commonSegments: string[] = [];
  const minLength = Math.min(...segmentArrays.map((s) => s.length));
  for (let i = 0; i < minLength; i++) {
    const segment = segmentArrays[0][i];
    if (!segmentArrays.every((s) => s[i] === segment)) {
      break;
    }

    commonSegments.push(segment);
  }

  return commonSegments.length > 0 ? `/${commonSegments.join('/')}` : '';
}

/**
 * Parses a parameter object from the OpenAPI specification.
 *
 * @param param The parameter object.
 * @param operationId The operation ID.
 * @returns The parsed parameter.
 */
function parseParameter(
  param: OpenAPIV3_1.ParameterObject,
  operationId: string,
): ParsedParameter {
  const { name, in: location, required, schema, description } = param;
  if (!name) {
    throw new Error(
      `Parameter is missing a name in operation '${operationId}'.`,
    );
  }
  if (!location) {
    throw new Error(
      `Parameter '${name}' is missing a location in operation '${operationId}'.`,
    );
  }
  if (isReferenceObject(schema)) {
    throw new Error(
      `Parameter '${name}' in operation '${operationId}' uses a $ref schema, which is not supported.`,
    );
  }

  return {
    name,
    in: location,
    required: required ?? location === 'path',
    description,
    schema: schema ?? { type: 'string' },
  };
}

/**
 * Parses a request body object from the OpenAPI specification.
 * Only `$ref` request bodies are supported. The request body must be required (otherwise NestJS validation would fail).
 *
 * @param requestBody The request body object.
 * @param operationId The operation ID.
 * @returns The `$ref` to the request body schema, if present and required.
 */
function parseRequestBodyRef(
  requestBody: OpenAPIV3_1.RequestBodyObject | undefined,
  operationId: string,
): string | undefined {
  if (!requestBody) {
    return undefined;
  }

  if (isReferenceObject(requestBody)) {
    throw new Error(
      `Request body $ref is not supported in operation '${operationId}'.`,
    );
  }

  const { content, required } = requestBody as OpenAPIV3_1.RequestBodyObject;
  if (!required) {
    return undefined;
  }

  const jsonContent = content?.['application/json'];
  if (!jsonContent) {
    throw new Error(
      `Only 'application/json' request bodies are supported in operation '${operationId}'.`,
    );
  }

  const { schema } = jsonContent;
  if (!isReferenceObject(schema)) {
    throw new Error(
      `Inline request body schemas are not supported in operation '${operationId}'.`,
    );
  }

  return schema.$ref;
}

/**
 * Parses the success response from an OpenAPI operation.
 *
 * @param responses The responses object.
 * @param operationId The operation ID.
 * @returns The success response, if any.
 */
function parseSuccessResponse(
  responses: OpenAPIV3_1.ResponsesObject | undefined,
  operationId: string,
): ParsedResponse | undefined {
  for (const [statusCodeStr, response] of Object.entries(responses ?? {})) {
    if (!response) {
      continue;
    }

    const statusCode = parseInt(statusCodeStr);
    if (isNaN(statusCode) || statusCode < 200 || statusCode >= 300) {
      continue;
    }

    if (isReferenceObject(response)) {
      throw new Error(
        `Response $ref is not supported for status code '${statusCode}' in operation '${operationId}'.`,
      );
    }

    const { content, description } = response;
    if (!content) {
      return { statusCode, description };
    }

    const jsonContent = content['application/json'];
    if (!jsonContent) {
      throw new Error(
        `Only 'application/json' responses are supported for status code '${statusCode}' in operation '${operationId}'.`,
      );
    }

    const { schema } = jsonContent;
    if (!isReferenceObject(schema)) {
      throw new Error(
        `Inline response schemas are not supported for status code '${statusCode}' in operation '${operationId}'.`,
      );
    }

    return { statusCode, description, schemaRef: schema.$ref };
  }

  return undefined;
}

/**
 * Parses an operation from the OpenAPI specification.
 *
 * @param method The HTTP method.
 * @param path The path for the operation.
 * @param operation The operation object.
 * @param pathLevelParams Parameters defined at the path level.
 * @returns The parsed operation.
 */
function parseOperation(
  method: HttpMethod,
  path: string,
  operation: OpenAPIV3_1.OperationObject,
  pathLevelParams: OpenAPIV3_1.ParameterObject[] = [],
): ParsedOperation {
  const { operationId, summary, description } = operation;
  if (!operationId) {
    throw new Error(
      `Operation at path '${path}' and method '${method}' is missing an operationId.`,
    );
  }

  const allParams = [...pathLevelParams];
  for (const param of operation.parameters ?? []) {
    if (isReferenceObject(param)) {
      throw new Error(
        `Operation-level parameter $ref is not supported in operation '${operationId}' at path '${path}'.`,
      );
    }

    const existingIndex = allParams.findIndex(
      (p) => p.name === param.name && p.in === param.in,
    );
    if (existingIndex >= 0) {
      allParams[existingIndex] = param;
    } else {
      allParams.push(param);
    }
  }

  const parameters = allParams.map((p) => parseParameter(p, operationId));

  const requestBodyRef = parseRequestBodyRef(
    operation.requestBody,
    operationId,
  );

  const successResponse = parseSuccessResponse(
    operation.responses,
    operationId,
  );

  return {
    operationId,
    method,
    path,
    summary,
    description,
    parameters,
    requestBodyRef,
    successResponse,
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
): Promise<ParsedApiSpecification> {
  const content = await readFile(filePath, 'utf-8');
  const doc = load(content) as OpenAPIV3_1.Document;

  const resourceName = doc['x-causaResourceName'];
  if (!resourceName) {
    throw new Error(
      `OpenAPI spec '${filePath}' is missing the 'x-causaResourceName' field.`,
    );
  }

  const title = doc.info?.title ?? 'Unknown API';
  const description = doc.info?.description;

  const operations: ParsedOperation[] = [];
  const allPaths: string[] = [];

  const paths = doc.paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) {
      continue;
    }

    allPaths.push(path);

    const pathLevelParams: OpenAPIV3_1.ParameterObject[] = [];
    for (const param of pathItem.parameters ?? []) {
      if (isReferenceObject(param)) {
        throw new Error(
          `Path-level parameter $ref is not supported in path '${path}' of file '${filePath}'.`,
        );
      }

      pathLevelParams.push(param);
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }

      const parsed = parseOperation(method, path, operation, pathLevelParams);
      operations.push(parsed);
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
