import type { GeneratedSchema, GeneratedSchemas } from '@causa/workspace-core';
import { writeFile } from 'fs/promises';
import { dirname, relative, sep } from 'path';
import prettier from 'prettier';
import type {
  HttpMethod,
  ParsedApiSpec,
  ParsedOperation,
  ParsedResponse,
} from './types.js';
import {
  computeSubPath,
  deriveMethodName,
  getParameterSchemaKey,
  resolveRefPath,
} from './utilities.js';

/**
 * An import dictionary mapping file paths to sets of symbols.
 */
type ImportDictionary = Record<string, Set<string>>;

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
const HTTP_STATUS_MAP: Record<number, string> = {
  200: 'OK',
  201: 'CREATED',
  202: 'ACCEPTED',
  204: 'NO_CONTENT',
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
  successStatusCode: number;

  /**
   * Whether the method has path parameters.
   */
  hasPathParams: boolean;

  /**
   * The schema for path parameters.
   */
  pathParamsSchema?: GeneratedSchema;

  /**
   * Whether the method has query parameters.
   */
  hasQueryParams: boolean;

  /**
   * The schema for query parameters.
   */
  queryParamsSchema?: GeneratedSchema;

  /**
   * Whether the method has a request body.
   */
  hasRequestBody: boolean;

  /**
   * The schema for the request body.
   */
  requestBodySchema?: GeneratedSchema;

  /**
   * The schema for the return type.
   */
  returnTypeSchema?: GeneratedSchema;

  /**
   * JSDoc description for the method.
   */
  description?: string;
};

/**
 * Gets the success response from a list of responses.
 *
 * @param responses The responses from the operation.
 * @returns The success response, or undefined if none found.
 */
function getSuccessResponse(
  responses: ParsedResponse[],
): ParsedResponse | undefined {
  return responses.find((r) => r.statusCode >= 200 && r.statusCode < 300);
}

/**
 * Resolves a schema from a reference using the generated schemas.
 *
 * @param schemaRef The `$ref` value (e.g., `../entities/post.yaml`).
 * @param openApiFilePath The path to the OpenAPI file.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @returns The resolved schema, or `undefined` if not found.
 */
function resolveSchema(
  schemaRef: string,
  openApiFilePath: string,
  modelClassSchemas: GeneratedSchemas,
): GeneratedSchema | undefined {
  const resolvedPath = resolveRefPath(schemaRef, openApiFilePath);

  // Try exact match first
  const exactMatch = modelClassSchemas[resolvedPath];
  if (exactMatch) {
    return exactMatch;
  }

  // Try with fragment (e.g., for $defs references)
  const fragment = schemaRef.includes('#') ? schemaRef.split('#')[1] : '';
  if (fragment) {
    const withFragment = `${resolvedPath}#${fragment}`;
    const fragmentMatch = modelClassSchemas[withFragment];
    if (fragmentMatch) {
      return fragmentMatch;
    }
  }

  // Try to find by just the filename
  for (const [uri, schema] of Object.entries(modelClassSchemas)) {
    if (
      uri.endsWith(resolvedPath) ||
      resolvedPath.endsWith(uri.replace(/^file:\/\//, ''))
    ) {
      return schema;
    }
  }

  return undefined;
}

/**
 * Builds method information from a parsed operation.
 *
 * @param operation The parsed operation.
 * @param resourceName The resource name.
 * @param basePath The base path of the API.
 * @param openApiFilePath The path to the OpenAPI file.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @param paramsSchemas The generated schemas for parameter classes.
 * @returns The method information.
 */
function buildMethodInfo(
  operation: ParsedOperation,
  resourceName: string,
  basePath: string,
  openApiFilePath: string,
  modelClassSchemas: GeneratedSchemas,
  paramsSchemas: GeneratedSchemas,
): MethodInfo {
  const methodName = deriveMethodName(operation.operationId, resourceName);
  const subPath = computeSubPath(operation.path, basePath);

  const pathParams = operation.parameters.filter((p) => p.in === 'path');
  const queryParams = operation.parameters.filter((p) => p.in === 'query');

  const successResponse = getSuccessResponse(operation.responses);
  const successStatusCode = successResponse?.statusCode ?? 200;

  // Resolve return type schema
  const returnTypeSchema = successResponse?.schemaRef
    ? resolveSchema(
        successResponse.schemaRef,
        openApiFilePath,
        modelClassSchemas,
      )
    : undefined;

  // Resolve request body schema (only $ref bodies are supported)
  const requestBodySchema = operation.requestBody?.schemaRef
    ? resolveSchema(
        operation.requestBody.schemaRef,
        openApiFilePath,
        modelClassSchemas,
      )
    : undefined;

  // Look up parameter schemas from generated schemas
  const pathParamsSchema =
    pathParams.length > 0
      ? paramsSchemas[getParameterSchemaKey(operation.operationId, 'path')]
      : undefined;
  const queryParamsSchema =
    queryParams.length > 0
      ? paramsSchemas[getParameterSchemaKey(operation.operationId, 'query')]
      : undefined;

  return {
    name: methodName,
    operationId: operation.operationId,
    httpMethod: operation.method,
    subPath,
    successStatusCode,
    hasPathParams: pathParams.length > 0,
    pathParamsSchema,
    hasQueryParams: queryParams.length > 0,
    queryParamsSchema,
    hasRequestBody: !!operation.requestBody,
    requestBodySchema,
    returnTypeSchema,
    description: operation.description ?? operation.summary,
  };
}

/**
 * Adds a symbol to the import dictionary.
 *
 * @param imports The import dictionary.
 * @param filePath The file path to import from.
 * @param symbol The symbol to import.
 */
function addImport(
  imports: ImportDictionary,
  filePath: string,
  symbol: string,
): void {
  const existing = imports[filePath];
  if (existing) {
    existing.add(symbol);
  } else {
    imports[filePath] = new Set([symbol]);
  }
}

/**
 * Builds the import dictionary from method information.
 *
 * @param methods The methods to process.
 * @returns The import dictionary.
 */
function buildImportDictionary(methods: MethodInfo[]): ImportDictionary {
  const imports: ImportDictionary = {};

  for (const method of methods) {
    if (method.pathParamsSchema) {
      addImport(
        imports,
        method.pathParamsSchema.file,
        method.pathParamsSchema.name,
      );
    }
    if (method.queryParamsSchema) {
      addImport(
        imports,
        method.queryParamsSchema.file,
        method.queryParamsSchema.name,
      );
    }
    if (method.requestBodySchema) {
      addImport(
        imports,
        method.requestBodySchema.file,
        method.requestBodySchema.name,
      );
    }
    if (method.returnTypeSchema) {
      addImport(
        imports,
        method.returnTypeSchema.file,
        method.returnTypeSchema.name,
      );
    }
  }

  return imports;
}

/**
 * Renders the imports section of the controller file.
 *
 * @param methods The methods to render.
 * @param controllerFilePath The path to the controller file being generated.
 * @returns The rendered imports section.
 */
function renderImports(
  methods: MethodInfo[],
  controllerFilePath: string,
): string {
  const lines: string[] = [];
  const outputDir = dirname(controllerFilePath);

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

  // Build and render type imports from generated schemas
  const typeImports = buildImportDictionary(methods);

  // Sort entries: module imports first, then relative imports alphabetically
  const sortedEntries = Object.entries(typeImports).toSorted(
    ([path1], [path2]) =>
      Number(path1.startsWith('/')) - Number(path2.startsWith('/')) ||
      path1.localeCompare(path2),
  );

  for (const [filePath, symbols] of sortedEntries) {
    // Convert absolute paths to relative imports
    let importPath = filePath;
    if (filePath.startsWith('/')) {
      let relativePath = relative(outputDir, filePath);
      if (!relativePath.startsWith('.')) {
        relativePath = `.${sep}${relativePath}`;
      }
      importPath = relativePath.replace(/\.ts$/, '.js');
    }

    const sortedSymbols = Array.from(symbols).sort();
    lines.push(`import type {`);
    lines.push(`  ${sortedSymbols.join(',\n  ')},`);
    lines.push(`} from '${importPath}';`);
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
    const returnTypeName = method.returnTypeSchema?.name ?? 'void';

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
      if (returnTypeName !== 'void') {
        lines.push(`   * @returns The response.`);
      }
      lines.push(`   */`);
    }

    // Method signature
    const params: string[] = [];
    if (method.pathParamsSchema) {
      params.push(`params: ${method.pathParamsSchema.name}`);
    }
    if (method.queryParamsSchema) {
      params.push(`query: ${method.queryParamsSchema.name}`);
    }
    if (method.requestBodySchema) {
      params.push(`body: ${method.requestBodySchema.name}`);
    }
    params.push('...rest: any[]');

    lines.push(`  ${method.name}(`);
    lines.push(`    ${params.join(',\n    ')}`);
    lines.push(`  ): Promise<${returnTypeName}>;`);
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
    const httpCodeArg = httpStatus
      ? `HttpStatus.${httpStatus}`
      : `${method.successStatusCode}`;
    if (httpStatus) {
      lines.push(`    HttpCode(${httpCodeArg})(`);
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
 * @param paramsSchemas The generated schemas for parameter classes.
 * @param controllerFilePath The path where the controller file will be written.
 * @returns The rendered controller file content.
 */
export function renderControllerFile(
  apiSpec: ParsedApiSpec,
  modelClassSchemas: GeneratedSchemas,
  paramsSchemas: GeneratedSchemas,
  controllerFilePath: string,
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
      paramsSchemas,
    ),
  );

  // Render sections
  const imports = renderImports(methods, controllerFilePath);
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
