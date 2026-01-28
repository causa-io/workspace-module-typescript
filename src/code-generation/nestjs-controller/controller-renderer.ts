import type { GeneratedSchemas } from '@causa/workspace-core';
import { writeFile } from 'fs/promises';
import prettier from 'prettier';
import { relative, dirname } from 'path';
import type {
  HttpMethod,
  ParsedApiSpec,
  ParsedOperation,
  ParsedResponse,
} from './openapi-parser.js';
import {
  computeSubPath,
  deriveMethodName,
  resolveRefPath,
} from './openapi-parser.js';
import {
  buildPathParamsClassName,
  buildQueryParamsClassName,
} from './schema-synthesizer.js';

/**
 * Maps HTTP methods to NestJS decorator names.
 */
const HTTP_METHOD_DECORATORS: Record<HttpMethod, string> = {
  get: 'Get',
  post: 'Post',
  put: 'Put',
  patch: 'Patch',
  delete: 'Delete',
};

/**
 * Maps HTTP status codes to NestJS HttpStatus enum values.
 */
const HTTP_STATUS_MAP: Record<string, string> = {
  '200': 'OK',
  '201': 'CREATED',
  '202': 'ACCEPTED',
  '204': 'NO_CONTENT',
};

/**
 * Information about a method to be rendered.
 */
type MethodInfo = {
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
  successStatusCode: string;

  /**
   * Whether the method has path parameters.
   */
  hasPathParams: boolean;

  /**
   * The class name for path parameters.
   */
  pathParamsClass?: string;

  /**
   * Whether the method has query parameters.
   */
  hasQueryParams: boolean;

  /**
   * The class name for query parameters.
   */
  queryParamsClass?: string;

  /**
   * Whether the method has a request body.
   */
  hasRequestBody: boolean;

  /**
   * The type name for the request body.
   */
  requestBodyType?: string;

  /**
   * The return type for the method.
   */
  returnType: string;

  /**
   * JSDoc description for the method.
   */
  description?: string;
};

/**
 * Gets the success response from a list of responses.
 * Prioritizes 200, 201, 202, then 204.
 *
 * @param responses The responses from the operation.
 * @returns The success response, or undefined if none found.
 */
function getSuccessResponse(
  responses: ParsedResponse[],
): ParsedResponse | undefined {
  const priorityOrder = ['200', '201', '202', '204'];

  for (const code of priorityOrder) {
    const response = responses.find((r) => r.statusCode === code);
    if (response) {
      return response;
    }
  }

  // Fall back to the first 2xx response
  return responses.find((r) => r.statusCode.startsWith('2'));
}

/**
 * Resolves a type name from a schema reference using the generated schemas.
 *
 * @param schemaRef The `$ref` value (e.g., `../entities/post.yaml`).
 * @param openApiFilePath The path to the OpenAPI file.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @returns The resolved type name, or `unknown` if not found.
 */
function resolveTypeName(
  schemaRef: string,
  openApiFilePath: string,
  modelClassSchemas: GeneratedSchemas,
): string {
  const resolvedPath = resolveRefPath(schemaRef, openApiFilePath);

  // Try exact match first
  const exactMatch = modelClassSchemas[resolvedPath];
  if (exactMatch) {
    return exactMatch.name;
  }

  // Try with fragment (e.g., for $defs references)
  const fragment = schemaRef.includes('#') ? schemaRef.split('#')[1] : '';
  if (fragment) {
    const withFragment = `${resolvedPath}#${fragment}`;
    const fragmentMatch = modelClassSchemas[withFragment];
    if (fragmentMatch) {
      return fragmentMatch.name;
    }
  }

  // Try to find by just the filename
  for (const [uri, schema] of Object.entries(modelClassSchemas)) {
    if (
      uri.endsWith(resolvedPath) ||
      resolvedPath.endsWith(uri.replace(/^file:\/\//, ''))
    ) {
      return schema.name;
    }
  }

  return 'unknown';
}

/**
 * Computes the relative import path from the controller file to the model file.
 *
 * @param controllerPath The path to the controller file.
 * @param modelPath The path to the model file.
 * @returns The relative import path with `.js` extension.
 */
function computeRelativeImportPath(
  controllerPath: string,
  modelPath: string,
): string {
  let relativePath = relative(dirname(controllerPath), modelPath);

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`;
  }

  // Replace .ts extension with .js
  return relativePath.replace(/\.ts$/, '.js');
}

/**
 * Builds method information from a parsed operation.
 *
 * @param operation The parsed operation.
 * @param resourceName The resource name.
 * @param basePath The base path of the API.
 * @param openApiFilePath The path to the OpenAPI file.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @returns The method information.
 */
function buildMethodInfo(
  operation: ParsedOperation,
  resourceName: string,
  basePath: string,
  openApiFilePath: string,
  modelClassSchemas: GeneratedSchemas,
): MethodInfo {
  const methodName = deriveMethodName(operation.operationId, resourceName);
  const subPath = computeSubPath(operation.path, basePath);

  const pathParams = operation.parameters.filter((p) => p.in === 'path');
  const queryParams = operation.parameters.filter((p) => p.in === 'query');

  const successResponse = getSuccessResponse(operation.responses);
  const successStatusCode = successResponse?.statusCode ?? '200';

  // Determine return type
  let returnType = 'void';
  if (successResponse?.schemaRef) {
    returnType = resolveTypeName(
      successResponse.schemaRef,
      openApiFilePath,
      modelClassSchemas,
    );
  } else if (successResponse?.schema) {
    // Inline schema - use 'unknown' as we don't generate a type for it
    returnType = 'unknown';
  }

  // Determine request body type
  let requestBodyType: string | undefined;
  if (operation.requestBody?.schemaRef) {
    requestBodyType = resolveTypeName(
      operation.requestBody.schemaRef,
      openApiFilePath,
      modelClassSchemas,
    );
  } else if (operation.requestBody?.schema) {
    requestBodyType = 'unknown';
  }

  return {
    name: methodName,
    operationId: operation.operationId,
    httpMethod: operation.method,
    subPath,
    successStatusCode,
    hasPathParams: pathParams.length > 0,
    pathParamsClass:
      pathParams.length > 0
        ? buildPathParamsClassName(operation.operationId)
        : undefined,
    hasQueryParams: queryParams.length > 0,
    queryParamsClass:
      queryParams.length > 0
        ? buildQueryParamsClassName(operation.operationId)
        : undefined,
    hasRequestBody: !!operation.requestBody,
    requestBodyType,
    returnType,
    description: operation.description ?? operation.summary,
  };
}

/**
 * Renders the imports section of the controller file.
 *
 * @param methods The methods to render.
 * @param modelImportPath The relative import path to the model.ts file.
 * @param externalTypes The external types to import from the model class output.
 * @param externalTypesImportPath The import path for external types.
 * @returns The rendered imports section.
 */
function renderImports(
  methods: MethodInfo[],
  modelImportPath: string,
  externalTypes: Set<string>,
  externalTypesImportPath: string,
): string {
  const lines: string[] = [];

  // Collect NestJS imports
  const nestjsImports = new Set<string>([
    'Controller',
    'HttpCode',
    'HttpStatus',
    'Type',
  ]);
  const nestjsMethodDecorators = new Set<string>();
  let needsParam = false;
  let needsQuery = false;
  let needsBody = false;

  for (const method of methods) {
    nestjsMethodDecorators.add(HTTP_METHOD_DECORATORS[method.httpMethod]);
    if (method.hasPathParams) needsParam = true;
    if (method.hasQueryParams) needsQuery = true;
    if (method.hasRequestBody) needsBody = true;
  }

  nestjsMethodDecorators.forEach((d) => nestjsImports.add(d));
  if (needsParam) nestjsImports.add('Param');
  if (needsQuery) nestjsImports.add('Query');
  if (needsBody) nestjsImports.add('Body');

  lines.push(`import {`);
  lines.push(`  ${Array.from(nestjsImports).sort().join(',\n  ')},`);
  lines.push(`} from '@nestjs/common';`);

  // Import param classes from model.ts
  const paramClasses = new Set<string>();
  for (const method of methods) {
    if (method.pathParamsClass) paramClasses.add(method.pathParamsClass);
    if (method.queryParamsClass) paramClasses.add(method.queryParamsClass);
  }

  if (paramClasses.size > 0) {
    lines.push(`import type {`);
    lines.push(`  ${Array.from(paramClasses).sort().join(',\n  ')},`);
    lines.push(`} from '${modelImportPath}';`);
  }

  // Import external types (entities, DTOs) from the model class output
  if (externalTypes.size > 0) {
    const sortedTypes = Array.from(externalTypes)
      .filter((t) => t !== 'void' && t !== 'unknown')
      .sort();

    if (sortedTypes.length > 0) {
      lines.push(`import type {`);
      lines.push(`  ${sortedTypes.join(',\n  ')},`);
      lines.push(`} from '${externalTypesImportPath}';`);
    }
  }

  return lines.join('\n');
}

/**
 * Renders the interface definition.
 *
 * @param interfaceName The name of the interface.
 * @param methods The methods to include.
 * @returns The rendered interface.
 */
function renderInterface(interfaceName: string, methods: MethodInfo[]): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(
    ` * The contract for the ${interfaceName.replace('ApiContract', '')} API controller.`,
  );
  lines.push(` */`);
  lines.push(`export interface ${interfaceName} {`);

  for (const method of methods) {
    // JSDoc
    if (method.description) {
      lines.push(`  /**`);
      const descLines = method.description.split('\n');
      for (const line of descLines) {
        lines.push(`   * ${line}`);
      }
      lines.push(`   *`);
      if (method.hasPathParams) {
        lines.push(`   * @param params The path parameters.`);
      }
      if (method.hasQueryParams) {
        lines.push(`   * @param query The query parameters.`);
      }
      if (method.hasRequestBody) {
        lines.push(`   * @param body The request body.`);
      }
      if (method.returnType !== 'void') {
        lines.push(`   * @returns The response.`);
      }
      lines.push(`   */`);
    }

    // Method signature
    const params: string[] = [];
    if (method.hasPathParams) {
      params.push(`params: ${method.pathParamsClass}`);
    }
    if (method.hasQueryParams) {
      params.push(`query: ${method.queryParamsClass}`);
    }
    if (method.hasRequestBody && method.requestBodyType) {
      params.push(`body: ${method.requestBodyType}`);
    }
    params.push('...rest: any[]');

    const returnType =
      method.returnType === 'void' ? 'void' : method.returnType;
    lines.push(`  ${method.name}(`);
    lines.push(`    ${params.join(',\n    ')}`);
    lines.push(`  ): Promise<${returnType}>;`);
    lines.push('');
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Renders the decorator factory function.
 *
 * @param factoryName The name of the factory function.
 * @param interfaceName The name of the interface.
 * @param basePath The base path for the controller.
 * @param methods The methods to decorate.
 * @returns The rendered decorator factory.
 */
function renderDecoratorFactory(
  factoryName: string,
  interfaceName: string,
  basePath: string,
  methods: MethodInfo[],
): string {
  const lines: string[] = [];

  // Remove leading slash from base path
  const controllerPath = basePath.startsWith('/')
    ? basePath.slice(1)
    : basePath;

  lines.push(`/**`);
  lines.push(
    ` * Decorates a class as a ${interfaceName.replace('ApiContract', '')} API controller.`,
  );
  lines.push(` */`);
  lines.push(`export function ${factoryName}() {`);
  lines.push(`  return function (constructor: Type<${interfaceName}>) {`);
  lines.push(`    Controller('${controllerPath}')(constructor);`);

  for (const method of methods) {
    lines.push('');

    // HTTP method decorator
    const methodDecorator = HTTP_METHOD_DECORATORS[method.httpMethod];
    lines.push(`    ${methodDecorator}('${method.subPath}')(`);
    lines.push(`      constructor.prototype,`);
    lines.push(`      '${method.name}',`);
    lines.push(
      `      Object.getOwnPropertyDescriptor(constructor.prototype, '${method.name}')!,`,
    );
    lines.push(`    );`);

    // HttpCode decorator
    const httpStatus = HTTP_STATUS_MAP[method.successStatusCode];
    if (httpStatus) {
      lines.push(`    HttpCode(HttpStatus.${httpStatus})(`);
      lines.push(`      constructor.prototype,`);
      lines.push(`      '${method.name}',`);
      lines.push(
        `      Object.getOwnPropertyDescriptor(constructor.prototype, '${method.name}')!,`,
      );
      lines.push(`    );`);
    }

    // Parameter decorators
    let paramIndex = 0;
    if (method.hasPathParams) {
      lines.push(
        `    Param()(constructor.prototype, '${method.name}', ${paramIndex});`,
      );
      paramIndex++;
    }
    if (method.hasQueryParams) {
      lines.push(
        `    Query()(constructor.prototype, '${method.name}', ${paramIndex});`,
      );
      paramIndex++;
    }
    if (method.hasRequestBody) {
      lines.push(
        `    Body()(constructor.prototype, '${method.name}', ${paramIndex});`,
      );
    }
  }

  lines.push(`  };`);
  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Renders the complete controller file content.
 *
 * @param apiSpec The parsed API specification.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @param controllerFilePath The path where the controller file will be written.
 * @param modelFilePath The path to the generated model.ts file.
 * @param externalTypesFilePath The path to the external types file (e.g., ../model/generated.ts).
 * @returns The rendered controller file content.
 */
export function renderControllerFile(
  apiSpec: ParsedApiSpec,
  modelClassSchemas: GeneratedSchemas,
  controllerFilePath: string,
  modelFilePath: string,
  externalTypesFilePath: string,
): string {
  const interfaceName = `${apiSpec.resourceName}ApiContract`;
  const factoryName = `As${apiSpec.resourceName}ApiController`;

  // Build method information
  const methods = apiSpec.operations.map((op) =>
    buildMethodInfo(
      op,
      apiSpec.resourceName,
      apiSpec.basePath,
      apiSpec.filePath,
      modelClassSchemas,
    ),
  );

  // Collect external types needed
  const externalTypes = new Set<string>();
  for (const method of methods) {
    if (
      method.returnType &&
      method.returnType !== 'void' &&
      method.returnType !== 'unknown'
    ) {
      externalTypes.add(method.returnType);
    }
    if (method.requestBodyType && method.requestBodyType !== 'unknown') {
      externalTypes.add(method.requestBodyType);
    }
  }

  // Compute import paths
  const modelImportPath = computeRelativeImportPath(
    controllerFilePath,
    modelFilePath,
  );
  const externalTypesImportPath = computeRelativeImportPath(
    controllerFilePath,
    externalTypesFilePath,
  );

  // Render sections
  const imports = renderImports(
    methods,
    modelImportPath,
    externalTypes,
    externalTypesImportPath,
  );
  const interfaceCode = renderInterface(interfaceName, methods);
  const factoryCode = renderDecoratorFactory(
    factoryName,
    interfaceName,
    apiSpec.basePath,
    methods,
  );

  return `${imports}\n\n${interfaceCode}\n\n${factoryCode}\n`;
}

/**
 * Writes a controller file with prettier formatting.
 *
 * @param content The content to write.
 * @param filePath The path to write to.
 * @param leadingComment An optional leading comment.
 */
export async function writeControllerFile(
  content: string,
  filePath: string,
  leadingComment?: string,
): Promise<void> {
  let source = content;
  if (leadingComment) {
    source = `// ${leadingComment}\n\n${content}`;
  }

  const prettierConfig = await prettier.resolveConfig(filePath);

  const formattedOutput = await prettier.format(source, {
    parser: 'typescript',
    ...prettierConfig,
  });

  await writeFile(filePath, formattedOutput);
}

/**
 * Converts a resource name to kebab-case for file naming.
 *
 * @param resourceName The resource name in PascalCase.
 * @returns The kebab-case version.
 */
export function toKebabCase(resourceName: string): string {
  return resourceName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Builds the controller file name from the resource name.
 *
 * @param resourceName The resource name.
 * @returns The file name (e.g., "post-import-job.api.controller.ts").
 */
export function buildControllerFileName(resourceName: string): string {
  return `${toKebabCase(resourceName)}.api.controller.ts`;
}
