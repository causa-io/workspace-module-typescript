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
