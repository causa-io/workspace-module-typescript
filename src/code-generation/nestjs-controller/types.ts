import type {
  GeneratedSchema,
  ServiceContainerConfiguration,
} from '@causa/workspace-core';
import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import type { TypeScriptDecorator } from '../model-class/index.js';

/**
 * A trigger defined in the `serviceContainer.triggers` configuration.
 */
export type ServiceContainerTrigger = NonNullable<
  NonNullable<ServiceContainerConfiguration['serviceContainer']>['triggers']
>[string];

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
   * The `$ref` to the request body schema, if present and required.
   */
  requestBodyRef?: string;

  /**
   * The success response for the operation.
   */
  successResponse?: ParsedResponse;

  /**
   * Whether the operation explicitly opts out of authorization, by declaring an empty `security` array.
   */
  isPublic: boolean;
};

/**
 * An API specification parsed from an OpenAPI document.
 */
export type ParsedApiSpecification = {
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

/**
 * Information about a method to be rendered.
 */
export type ApiControllerMethod = {
  /**
   * The method name.
   */
  name: string;

  /**
   * The operation ID from OpenAPI.
   */
  operationId: string;

  /**
   * The HTTP method.
   */
  httpMethod: HttpMethod;

  /**
   * The sub-path for the method decorator.
   */
  subPath: string;

  /**
   * The HTTP status code for the success response.
   */
  successStatusCode?: number;

  /**
   * The schema for path parameters.
   */
  pathParamsSchema?: GeneratedSchema;

  /**
   * The schema for query parameters.
   */
  queryParamsSchema?: GeneratedSchema;

  /**
   * The schema for the request body.
   */
  requestBodySchema?: GeneratedSchema;

  /**
   * The schema for the return type.
   */
  returnTypeSchema?: GeneratedSchema;

  /**
   * JSDoc description for the return type.
   */
  returnTypeDescription?: string;

  /**
   * JSDoc description for the method.
   */
  description?: string;

  /**
   * Whether to decorate the method with `@Public()`, marking it as not requiring authorization.
   */
  isPublic: boolean;
};

/**
 * A service container trigger calling an HTTP endpoint of the service.
 */
export type HttpTrigger = {
  /**
   * The name of the trigger, i.e. its key in the `serviceContainer.triggers` configuration.
   */
  name: string;

  /**
   * The raw trigger configuration.
   */
  trigger: ServiceContainerTrigger;

  /**
   * The last segment of the endpoint path, used as the method's sub-path.
   */
  subPath: string;

  /**
   * The schema for the event passed to the handler method.
   * For `event` triggers, this is the class generated for the topic's schema. For other triggers, this is the class
   * generated for the `dto` schema, when defined.
   * When `undefined`, the event is typed as `object`.
   */
  eventSchema: GeneratedSchema | undefined;
};

/**
 * Information about an event controller method to be rendered.
 */
export type EventControllerMethod = {
  /**
   * The method name, derived from the trigger name.
   */
  name: string;

  /**
   * The sub-path for the method decorator.
   */
  subPath: string;

  /**
   * JSDoc description for the method.
   */
  description?: string;

  /**
   * The schema for the event (or DTO) passed to the method.
   * When `undefined`, the event is typed as `object`.
   */
  eventSchema: GeneratedSchema | undefined;

  /**
   * Additional decorators to apply to the method (e.g. `@UseEventHandler(...)`).
   */
  decorators: TypeScriptDecorator[];
};

/**
 * An event controller grouping the trigger-handling methods sharing a common endpoint base path.
 */
export type EventController = {
  /**
   * The PascalCase name for the controller, derived from the base path (e.g. `assets` -> `Assets`).
   */
  name: string;

  /**
   * The base path for the controller, without leading nor trailing slash.
   */
  basePath: string;

  /**
   * The methods of the controller.
   */
  methods: EventControllerMethod[];
};
