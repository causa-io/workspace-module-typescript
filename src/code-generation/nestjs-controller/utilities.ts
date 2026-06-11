import type { GeneratedSchema } from '@causa/workspace-core';
import {
  externalImportSpec,
  externalSymbolAlias,
  mergeImports,
} from '../base.js';

/**
 * An import dictionary mapping file paths to sets of symbols.
 */
export type ImportDictionary = Record<string, Set<string>>;

/**
 * Adds a NestJS common import with underscore prefix to avoid clashes.
 *
 * @param imports The import dictionary.
 * @param symbol The symbol to import.
 * @param isType Whether to import as a type.
 * @returns The prefixed symbol name to use in code.
 */
export function addNestJsImport(
  imports: ImportDictionary,
  symbol: string,
  isType = false,
): string {
  mergeImports(imports, {
    ['@nestjs/common']: [externalImportSpec('@nestjs/common', symbol, isType)],
  });
  return externalSymbolAlias('@nestjs/common', symbol);
}

/**
 * The module from which Causa runtime NestJS symbols are imported.
 */
const CAUSA_NESTJS_MODULE = '@causa/runtime/nestjs';

/**
 * Adds a `@causa/runtime/nestjs` import with underscore prefix to avoid clashes.
 *
 * @param imports The import dictionary.
 * @param symbol The symbol to import.
 * @returns The prefixed symbol name to use in code.
 */
export function addCausaNestJsImport(
  imports: ImportDictionary,
  symbol: string,
): string {
  mergeImports(imports, {
    [CAUSA_NESTJS_MODULE]: [externalImportSpec(CAUSA_NESTJS_MODULE, symbol)],
  });
  return externalSymbolAlias(CAUSA_NESTJS_MODULE, symbol);
}

/**
 * Renders the statements defining the `design:paramtypes` metadata for a controller method, to be appended to a
 * decorator factory body.
 *
 * Because the controller decorators are applied imperatively (through the decorator factory) rather than syntactically
 * on the implementation method, the TypeScript compiler does not emit the `design:paramtypes` metadata for it. Without
 * it, the runtime cannot deserialize and validate the method's parameters (e.g. the request body or event payload). The
 * metadata is defined only when absent, leaving any metadata emitted by the compiler (e.g. when the user adds their own
 * decorators to the method) untouched.
 *
 * @param imports The import dictionary to add the parameter class imports to.
 * @param methodName The name of the method.
 * @param paramTypes The types of the method's parameters, in parameter order. Each entry is either a generated class
 *   (value-imported) or a literal type expression such as `Object` for an untyped parameter. When empty, no statement
 *   is rendered.
 * @returns The lines defining the metadata.
 */
export function renderParamTypesMetadata(
  imports: ImportDictionary,
  methodName: string,
  paramTypes: (GeneratedSchema | string)[],
): string[] {
  if (paramTypes.length === 0) {
    return [];
  }

  const typeNames = paramTypes.map((paramType) => {
    if (typeof paramType === 'string') {
      return paramType;
    }

    mergeImports(imports, { [paramType.file]: [paramType.name] });
    return paramType.name;
  });

  return [
    `    if (!Reflect.hasOwnMetadata('design:paramtypes', constructor.prototype, '${methodName}')) {`,
    `      Reflect.defineMetadata('design:paramtypes', [${typeNames.join(', ')}], constructor.prototype, '${methodName}');`,
    `    }`,
  ];
}
