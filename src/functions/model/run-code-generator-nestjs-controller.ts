import { callDeferred, type WorkspaceContext } from '@causa/workspace';
import {
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptNestjsController}.
 */
export const TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR =
  'typescriptNestjsController';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript NestJS controller generator.
 *
 * This generator:
 * 1. Parses OpenAPI YAML specification files.
 * 2. Extracts path and query parameters to create JSON Schema objects.
 * 3. Feeds those schemas through the existing model-class pipeline to produce `model.ts`.
 * 4. Generates `*.api.controller.ts` files with TypeScript interfaces and decorator factories.
 */
export class ModelRunCodeGeneratorForTypeScriptNestjsController extends ModelRunCodeGenerator {
  async _call(context: WorkspaceContext): Promise<GeneratedSchemas> {
    return await callDeferred(this, context, import.meta.url);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR
    );
  }
}
