import type { OpenAPIV3_1 } from '@scalar/openapi-types';

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
  in: OpenAPIV3_1.ParameterLocation;

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
 * Only `$ref` request bodies are supported.
 */
export type ParsedRequestBody = {
  /**
   * Whether the request body is required.
   */
  required: boolean;

  /**
   * The `$ref` to the schema.
   */
  schemaRef: string;
};

/**
 * A response extracted from an OpenAPI operation.
 */
export type ParsedResponse = {
  /**
   * The HTTP status code for the response.
   */
  statusCode: number;

  /**
   * A description of the response.
   */
  description?: string;

  /**
   * The `$ref` to the schema, if present.
   */
  schemaRef?: string;
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
   * The common path prefix for all operations (e.g., `/entities`).
   */
  basePath: string;

  /**
   * The operations defined in the specification.
   */
  operations: ParsedOperation[];
};
