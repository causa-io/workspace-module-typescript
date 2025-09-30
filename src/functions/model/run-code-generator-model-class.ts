import type { WorkspaceContext } from '@causa/workspace';
import {
  generateCodeForSchemas,
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { resolve } from 'path';
import { TypeScriptModelClassTargetLanguage } from '../../code-generation/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { LEADING_COMMENT, tryMakeGeneratorInputData } from './utils.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptModelClass}.
 */
export const TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR =
  'typescriptModelClass';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript JSON Schema model class generator.
 */
export class ModelRunCodeGeneratorForTypeScriptModelClass extends ModelRunCodeGenerator {
  async _call(context: WorkspaceContext): Promise<GeneratedSchemas> {
    const { generator, configuration } = this;

    const input = await tryMakeGeneratorInputData(context, configuration);

    const { output } = configuration;
    if (!output || typeof output !== 'string') {
      throw new Error(
        `The 'output' configuration for generator '${TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR}' must be a string.`,
      );
    }

    const outputPath = resolve(context.getProjectPathOrThrow(), output);

    const decoratorRenderers = context
      .getFunctionImplementations(TypeScriptGetDecoratorRenderer, {
        generator,
        configuration,
      })
      .map((f) => f._call(context))
      .sort((r1, r2) => r1.name.localeCompare(r2.name));

    const language = new TypeScriptModelClassTargetLanguage(
      outputPath,
      context,
      {
        decoratorRenderers,
        leadingComment: LEADING_COMMENT,
        generatorOptions: configuration,
      },
    );

    await generateCodeForSchemas(language, input);

    return language.generatedSchemas;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR
    );
  }
}
