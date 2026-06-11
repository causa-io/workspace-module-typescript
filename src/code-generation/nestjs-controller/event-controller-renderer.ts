import {
  formatAndWriteTypeScript,
  LEADING_COMMENT,
  mergeImports,
  renderImports,
} from '../base.js';
import type { EventController } from './types.js';
import {
  addCausaNestJsImport,
  addNestJsImport,
  renderParamTypesMetadata,
  type ImportDictionary,
} from './utilities.js';

/**
 * Renders the contract interface for an event controller.
 *
 * @param controller The event controller to render.
 * @param imports The import dictionary to add imports to.
 * @param lines The lines array to append to.
 * @returns The interface name.
 */
function renderInterface(
  controller: EventController,
  imports: ImportDictionary,
  lines: string[],
): string {
  const interfaceName = `${controller.name}EventsContract`;

  lines.push(
    `/**`,
    ` * The contract for the ${controller.name} event controller.`,
    ` */`,
    `export interface ${interfaceName} {`,
  );

  for (const method of controller.methods) {
    const { eventSchema } = method;

    let eventType = 'object';
    if (eventSchema) {
      mergeImports(imports, {
        [eventSchema.file]: [`type ${eventSchema.name}`],
      });
      eventType = eventSchema.name;
    }

    const description =
      method.description ?? `Handles the '${method.name}' trigger.`;

    lines.push(`  /**`);
    lines.push(...description.split('\n').map((l) => `   * ${l}`));
    lines.push(
      `   *`,
      `   * @param event The event payload.`,
      `   */`,
      `  ${method.name}(event: ${eventType}, ...rest: any[]): Promise<void>;`,
      '',
    );
  }

  lines.push(`}`);

  return interfaceName;
}

/**
 * Renders the application of a method decorator within the decorator factory.
 *
 * @param expression The decorator expression (e.g. `Post('subPath')`), without the leading `@`.
 * @param methodName The name of the decorated method.
 * @param lines The lines array to append to.
 */
function renderMethodDecorator(
  expression: string,
  methodName: string,
  lines: string[],
): void {
  lines.push(
    `    ${expression}(`,
    `      constructor.prototype,`,
    `      '${methodName}',`,
    `      Object.getOwnPropertyDescriptor(constructor.prototype, '${methodName}')!,`,
    `    );`,
  );
}

/**
 * Renders the decorator factory function for an event controller.
 *
 * @param controller The event controller to render.
 * @param interfaceName The name of the contract interface.
 * @param imports The import dictionary to add imports to.
 * @param lines The lines array to append to.
 */
function renderDecoratorFactory(
  controller: EventController,
  interfaceName: string,
  imports: ImportDictionary,
  lines: string[],
): void {
  const factoryName = `As${controller.name}EventsController`;

  const typeSymbol = addNestJsImport(imports, 'Type', true);
  const controllerSymbol = addNestJsImport(imports, 'Controller');

  lines.push(
    `/**`,
    ` * Decorates a class as a ${controller.name} event controller.`,
    ` */`,
    `export function ${factoryName}() {`,
    `  return function (constructor: ${typeSymbol}<${interfaceName}>) {`,
    `    ${controllerSymbol}('${controller.basePath}')(constructor);`,
  );

  for (const method of controller.methods) {
    const postSymbol = addNestJsImport(imports, 'Post');
    const httpCodeSymbol = addNestJsImport(imports, 'HttpCode');
    const httpStatusSymbol = addNestJsImport(imports, 'HttpStatus');

    lines.push('');
    lines.push(
      ...renderParamTypesMetadata(imports, method.name, [
        method.eventSchema ?? 'Object',
      ]),
    );
    renderMethodDecorator(
      `${postSymbol}('${method.subPath}')`,
      method.name,
      lines,
    );
    renderMethodDecorator(
      `${httpCodeSymbol}(${httpStatusSymbol}.OK)`,
      method.name,
      lines,
    );

    for (const decorator of method.decorators) {
      mergeImports(imports, decorator.imports);
      renderMethodDecorator(
        decorator.source.replace(/^@/, ''),
        method.name,
        lines,
      );
    }

    const eventBodySymbol = addCausaNestJsImport(imports, 'EventBody');
    lines.push(
      `    ${eventBodySymbol}()(constructor.prototype, '${method.name}', 0);`,
    );
  }

  lines.push('  };', '}');
}

/**
 * Renders the complete event controller file content.
 *
 * @param controller The event controller to render.
 * @param controllerFilePath The path where the controller file will be written.
 * @returns The rendered controller file content.
 */
export function renderEventControllerFile(
  controller: EventController,
  controllerFilePath: string,
): string {
  const imports: ImportDictionary = {};
  const lines: string[] = [];

  const interfaceName = renderInterface(controller, imports, lines);

  lines.push('');

  renderDecoratorFactory(controller, interfaceName, imports, lines);

  const importsBlock = renderImports(imports, controllerFilePath);
  lines.unshift(importsBlock, '');

  return lines.join('\n');
}

/**
 * Writes an event controller file with prettier formatting.
 *
 * @param controller The event controller to render.
 * @param controllerFilePath The path where the controller file will be written.
 */
export async function writeEventControllerFile(
  controller: EventController,
  controllerFilePath: string,
): Promise<void> {
  const body = renderEventControllerFile(controller, controllerFilePath);
  await formatAndWriteTypeScript(
    controllerFilePath,
    `// ${LEADING_COMMENT}\n${body}`,
  );
}
