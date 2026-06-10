import type { ObjectSchema, Property } from '@causa/workspace-core';
import { externalImportSpec, externalSymbolAlias } from '../base.js';
import type { TypeScriptDecorator } from './generator.js';

/**
 * Adds a decorator to the given list, respecting the `tsExcludedDecorators` extension on the class and property.
 *
 * When `source` is a function, the decorator's own symbol is imported from `modulePath` under a module-qualified alias
 * (see {@link externalSymbolAlias}), and the alias is passed to `source`. When `source` is a string, the symbol is
 * imported under its bare name.
 *
 * @param decorators The list of decorators to append to.
 * @param target The class or property context the decorator is being generated for.
 * @param name The name of the decorator. An import for it is added unless the module already exports it.
 * @param modulePath The path of the module the decorator is imported from.
 * @param source The TypeScript source code for the decorator (e.g. `@MyDecorator(opts)`).
 * @param options Additional options for the decorator.
 */
export function addDecoratorToList(
  decorators: TypeScriptDecorator[],
  target: { schema: ObjectSchema; property?: Property },
  name: string,
  modulePath: string,
  source: string | ((alias: string) => string),
  options: { imports?: Record<string, string[]> } = {},
): void {
  const classExcluded = (target.schema.extensions.tsExcludedDecorators ??
    []) as string[];
  if (classExcluded.includes(name)) {
    return;
  }

  if (target.property) {
    const propertyExcluded = (target.property.extensions.tsExcludedDecorators ??
      []) as string[];
    if (propertyExcluded.includes(name)) {
      return;
    }
  }

  const imports: Record<string, string[]> = {};
  for (const [path, symbols] of Object.entries(options.imports ?? {})) {
    imports[path] = [...symbols];
  }
  const useAlias = typeof source === 'function';
  const spec = useAlias ? externalImportSpec(modulePath, name) : name;
  if (imports[modulePath]) {
    if (!imports[modulePath].includes(spec)) {
      imports[modulePath].push(spec);
    }
  } else {
    imports[modulePath] = [spec];
  }

  decorators.push({
    source: useAlias ? source(externalSymbolAlias(modulePath, name)) : source,
    imports,
  });
}
