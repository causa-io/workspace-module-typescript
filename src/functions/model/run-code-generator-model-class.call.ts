import type { GeneratedSchemas } from '@causa/workspace-core';
import { generateCodeForSchemas } from '@causa/workspace-core/code-generation';
import { resolve } from 'path';
import { TypeScriptModelClassTargetLanguage } from '../../code-generation/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import type { ModelRunCodeGeneratorForTypeScriptModelClass } from './run-code-generator-model-class.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import { LEADING_COMMENT, tryMakeGeneratorInputData } from './utils.js';

export default async function call(
  this: ModelRunCodeGeneratorForTypeScriptModelClass,
): Promise<GeneratedSchemas> {
  const { generator, configuration } = this;

  const input = await tryMakeGeneratorInputData(this._context, configuration);

  const { output } = configuration;
  if (!output || typeof output !== 'string') {
    throw new Error(
      `The 'output' configuration for generator '${TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR}' must be a string.`,
    );
  }

  const outputPath = resolve(this._context.getProjectPathOrThrow(), output);

  const decoratorRenderers = await Promise.all(
    this._context.callAll(TypeScriptGetDecoratorRenderer, {
      generator,
      configuration,
    }),
  );
  decoratorRenderers.sort((r1, r2) => r1.name.localeCompare(r2.name));

  const language = new TypeScriptModelClassTargetLanguage(
    outputPath,
    this._context,
    {
      decoratorRenderers,
      leadingComment: LEADING_COMMENT,
      generatorOptions: configuration,
    },
  );

  await generateCodeForSchemas(language, input);

  return language.generatedSchemas;
}
