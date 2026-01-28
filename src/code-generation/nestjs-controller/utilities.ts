import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { dirname, resolve } from 'path';

/**
 * Builds the key for a synthetic parameter schema in the generated schemas registry.
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
