import type { GeneratedSchema, GeneratedSchemas } from '@causa/workspace-core';
import { dirname, resolve } from 'path';
import {
  formatAndWriteTypeScript,
  LEADING_COMMENT,
  mergeImports,
  renderImports as renderImportsBlock,
} from '../base.js';
import { getParameterSchemaKey } from './parameters-json-schema.js';
import type {
  ApiControllerMethod,
  HttpMethod,
  ParsedApiSpecification,
  ParsedOperation,
} from './types.js';

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
 * Converts OpenAPI path syntax (`{param}`) to Express/NestJS syntax (`:param`).
 *
 * @param path The path with OpenAPI syntax.
 * @returns The path with Express/NestJS syntax.
 */
function toExpressPath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ':$1');
}

/**
 * Computes the sub-path for an operation, relative to the (controller) base path.
 *
 * @param fullPath The full path of the operation.
 * @param basePath The controller base path.
 * @returns The sub-path.
 */
function computeSubPath(fullPath: string, basePath: string): string {
  let subPath = fullPath;

  if (basePath && fullPath.startsWith(basePath)) {
    subPath = fullPath.slice(basePath.length);
  }

  if (subPath.startsWith('/')) {
    subPath = subPath.slice(1);
  }

  return subPath;
}

/**
 * Derives the method name from the operation ID by removing the resource prefix.
 * E.g., "myResourceNameRetry" with resource "MyResourceName" -> "retry".
 *
 * @param operationId The operation ID.
 * @param resourceName The resource name.
 * @returns The derived method name.
 */
export function computeMethodName(
  operationId: string,
  resourceName: string,
): string {
  let name = operationId;
  if (name.toLowerCase().startsWith(resourceName.toLowerCase())) {
    name = name.slice(resourceName.length);
  }

  name = name.replaceAll(/[^a-zA-Z]/g, '');
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Resolves a schema from a reference using the generated schemas.
 *
 * @param schemaRef The `$ref` value (e.g., `../schema.yaml`).
 * @param openApiFilePath The path to the OpenAPI file.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @returns The resolved schema.
 */
function resolveSchema(
  schemaRef: string,
  openApiFilePath: string,
  modelClassSchemas: GeneratedSchemas,
): GeneratedSchema {
  const resolvedPath = resolve(dirname(openApiFilePath), schemaRef);

  const exactMatch = modelClassSchemas[resolvedPath];
  if (!exactMatch) {
    throw new Error(
      `Generated schema reference '${schemaRef}' could not be resolved from OpenAPI file '${openApiFilePath}'.`,
    );
  }

  return exactMatch;
}

/**
 * Builds method information from a parsed operation.
 *
 * @param operation The parsed operation.
 * @param apiSpec The parsed API specification.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @param paramsSchemas The generated schemas for parameter classes.
 * @returns The method information.
 */
function buildMethodInfo(
  operation: ParsedOperation,
  apiSpec: ParsedApiSpecification,
  modelClassSchemas: GeneratedSchemas,
  paramsSchemas: GeneratedSchemas,
): ApiControllerMethod {
  const {
    operationId,
    requestBodyRef,
    method: httpMethod,
    successResponse,
  } = operation;
  const { resourceName, basePath, filePath } = apiSpec;

  const name = computeMethodName(operationId, resourceName);
  const subPath = computeSubPath(operation.path, basePath);
  const successStatusCode = successResponse?.statusCode;
  const returnTypeDescription = successResponse?.description;
  const returnTypeSchema = successResponse?.schemaRef
    ? resolveSchema(successResponse.schemaRef, filePath, modelClassSchemas)
    : undefined;
  const requestBodySchema = requestBodyRef
    ? resolveSchema(requestBodyRef, filePath, modelClassSchemas)
    : undefined;
  const pathParamsSchema: GeneratedSchema | undefined =
    paramsSchemas[getParameterSchemaKey(operationId, 'path')];
  const queryParamsSchema: GeneratedSchema | undefined =
    paramsSchemas[getParameterSchemaKey(operationId, 'query')];
  const description = operation.description ?? operation.summary;

  return {
    name,
    operationId,
    httpMethod,
    subPath,
    successStatusCode,
    pathParamsSchema,
    queryParamsSchema,
    requestBodySchema,
    returnTypeSchema,
    returnTypeDescription,
    description,
  };
}

/**
 * Adds a NestJS common import with underscore prefix to avoid clashes.
 *
 * @param imports The import dictionary.
 * @param symbol The symbol to import.
 * @param isType Whether to import as a type.
 * @returns The prefixed symbol name to use in code.
 */
function addNestJsImport(
  imports: ImportDictionary,
  symbol: string,
  isType = false,
): string {
  const prefixed = `_${symbol}`;
  const importSpec = `${isType ? 'type ' : ''}${symbol} as ${prefixed}`;
  mergeImports(imports, { '@nestjs/common': [importSpec] });
  return prefixed;
}

/**
 * Renders the interface definition.
 *
 * @param resourceName The resource name.
 * @param methods The methods to include.
 * @param imports The import dictionary to add imports to.
 * @param lines The lines array to append to.
 * @returns The interface name.
 */
function renderInterface(
  resourceName: string,
  methods: ApiControllerMethod[],
  imports: ImportDictionary,
  lines: string[],
): string {
  const interfaceName = `${resourceName}ApiContract`;

  lines.push(
    `/**`,
    ` * The contract for the ${resourceName} API controller.`,
    ` */`,
    `export interface ${interfaceName} {`,
  );

  for (const method of methods) {
    const {
      pathParamsSchema,
      queryParamsSchema,
      requestBodySchema,
      returnTypeSchema,
    } = method;
    const returnTypeName = returnTypeSchema?.name;

    lines.push(`  /**`);
    const descLines = method.description?.split('\n') ?? [];
    lines.push(...descLines.map((l) => `   * ${l}`));

    const prototypeDoc: string[] = [];
    const params: string[] = [];

    if (pathParamsSchema) {
      mergeImports(imports, {
        [pathParamsSchema.file]: [pathParamsSchema.name],
      });
      prototypeDoc.push(`   * @param params The path parameters.`);
      params.push(`params: ${pathParamsSchema.name}`);
    }

    if (queryParamsSchema) {
      mergeImports(imports, {
        [queryParamsSchema.file]: [queryParamsSchema.name],
      });
      prototypeDoc.push(`   * @param query The query parameters.`);
      params.push(`query: ${queryParamsSchema.name}`);
    }

    if (requestBodySchema) {
      mergeImports(imports, {
        [requestBodySchema.file]: [requestBodySchema.name],
      });
      prototypeDoc.push(`   * @param body The request body.`);
      params.push(`body: ${requestBodySchema.name}`);
    }

    if (returnTypeSchema) {
      mergeImports(imports, {
        [returnTypeSchema.file]: [`type ${returnTypeName}`],
      });
      prototypeDoc.push(
        `   * @returns ${method.returnTypeDescription ?? 'The response.'}`,
      );
    }

    if (prototypeDoc.length > 0) {
      lines.push(`   *`, ...prototypeDoc);
    }

    params.push('...rest: any[]');
    lines.push(
      `   */`,
      `  ${method.name}(${params.join(',')}): Promise<${returnTypeName ?? 'void'}>;`,
      '',
    );
  }

  lines.push(`}`);

  return interfaceName;
}

/**
 * Renders the decorator factory function.
 *
 * @param resourceName The resource name.
 * @param interfaceName The name of the interface.
 * @param basePath The base path for the controller.
 * @param methods The methods to decorate.
 * @param imports The import dictionary to add imports to.
 * @param lines The lines array to append to.
 */
function renderDecoratorFactory(
  resourceName: string,
  interfaceName: string,
  basePath: string,
  methods: ApiControllerMethod[],
  imports: ImportDictionary,
  lines: string[],
): void {
  const factoryName = `As${resourceName}ApiController`;

  const controllerPath = toExpressPath(basePath.replace(/^\//, ''));
  const typeSymbol = addNestJsImport(imports, 'Type', true);
  const controllerSymbol = addNestJsImport(imports, 'Controller');

  lines.push(
    `/**`,
    ` * Decorates a class as a ${resourceName} API controller.`,
    ` */`,
    `export function ${factoryName}() {`,
    `  return function (constructor: ${typeSymbol}<${interfaceName}>) {`,
    `    ${controllerSymbol}('${controllerPath}')(constructor);`,
  );

  for (const method of methods) {
    const { pathParamsSchema, queryParamsSchema, requestBodySchema } = method;

    const methodDecorator = HTTP_METHOD_DECORATORS[method.httpMethod];
    const methodSymbol = addNestJsImport(imports, methodDecorator);
    lines.push(
      '',
      `    ${methodSymbol}('${toExpressPath(method.subPath)}')(`,
      `      constructor.prototype,`,
      `      '${method.name}',`,
      `      Object.getOwnPropertyDescriptor(constructor.prototype, '${method.name}')!,`,
      `    );`,
    );

    if (method.successStatusCode !== undefined) {
      const httpCodeSymbol = addNestJsImport(imports, 'HttpCode');
      const httpStatus = HTTP_STATUS_MAP[method.successStatusCode];

      let httpCodeArg = `${method.successStatusCode}`;
      if (httpStatus) {
        const httpStatusSymbol = addNestJsImport(imports, 'HttpStatus');
        httpCodeArg = `${httpStatusSymbol}.${httpStatus}`;
      }

      lines.push(
        `    ${httpCodeSymbol}(${httpCodeArg})(`,
        `      constructor.prototype,`,
        `      '${method.name}',`,
        `      Object.getOwnPropertyDescriptor(constructor.prototype, '${method.name}')!,`,
        `    );`,
      );
    }

    let paramIndex = 0;
    if (pathParamsSchema) {
      const paramSymbol = addNestJsImport(imports, 'Param');
      lines.push(
        `    ${paramSymbol}()(constructor.prototype, '${method.name}', ${paramIndex});`,
      );
      paramIndex++;
    }

    if (queryParamsSchema) {
      const querySymbol = addNestJsImport(imports, 'Query');
      lines.push(
        `    ${querySymbol}()(constructor.prototype, '${method.name}', ${paramIndex});`,
      );
      paramIndex++;
    }

    if (requestBodySchema) {
      const bodySymbol = addNestJsImport(imports, 'Body');
      lines.push(
        `    ${bodySymbol}()(constructor.prototype, '${method.name}', ${paramIndex});`,
      );
    }
  }

  lines.push('  };', '}');
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
  apiSpec: ParsedApiSpecification,
  modelClassSchemas: GeneratedSchemas,
  paramsSchemas: GeneratedSchemas,
  controllerFilePath: string,
): string {
  const methods = apiSpec.operations.map((op) =>
    buildMethodInfo(op, apiSpec, modelClassSchemas, paramsSchemas),
  );

  const imports: ImportDictionary = {};
  const lines: string[] = [];

  const interfaceName = renderInterface(
    apiSpec.resourceName,
    methods,
    imports,
    lines,
  );

  lines.push('');

  renderDecoratorFactory(
    apiSpec.resourceName,
    interfaceName,
    apiSpec.basePath,
    methods,
    imports,
    lines,
  );

  const importsBlock = renderImportsBlock(imports, controllerFilePath);
  lines.unshift(importsBlock, '');

  return lines.join('\n');
}

/**
 * Writes a controller file with prettier formatting.
 *
 * @param apiSpec The parsed API specification.
 * @param modelClassSchemas The generated schemas from the model class generator.
 * @param paramsSchemas The generated schemas for parameter classes.
 * @param controllerFilePath The path where the controller file will be written.
 */
export async function writeControllerFile(
  apiSpec: ParsedApiSpecification,
  modelClassSchemas: GeneratedSchemas,
  paramsSchemas: GeneratedSchemas,
  controllerFilePath: string,
): Promise<void> {
  const body = renderControllerFile(
    apiSpec,
    modelClassSchemas,
    paramsSchemas,
    controllerFilePath,
  );
  await formatAndWriteTypeScript(
    controllerFilePath,
    `// ${LEADING_COMMENT}\n${body}`,
  );
}
