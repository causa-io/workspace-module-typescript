import type { WorkspaceContext } from '@causa/workspace';
import type { GeneratedSchemas } from '@causa/workspace-core';
import { generateCodeForSchemas } from '@causa/workspace-core/code-generation';
import { resolve } from 'path';
import { TypeScriptTestObjectTargetLanguage } from '../../code-generation/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import type { ModelRunCodeGeneratorForTypeScriptTestObject } from './run-code-generator-test-object.js';
import { TYPESCRIPT_TEST_OBJECT_GENERATOR } from './run-code-generator-test-object.js';
import { LEADING_COMMENT, tryMakeGeneratorInputData } from './utils.js';

export default async function call(
  this: ModelRunCodeGeneratorForTypeScriptTestObject,
  context: WorkspaceContext,
): Promise<GeneratedSchemas> {
  const { configuration, previousGeneratorsOutput } = this;

  const input = await tryMakeGeneratorInputData(context, configuration);

  const { output } = configuration;
  if (!output || typeof output !== 'string') {
    throw new Error(
      `The 'output' configuration for generator '${TYPESCRIPT_TEST_OBJECT_GENERATOR}' must be a string.`,
    );
  }

  const modelClassSchemas =
    previousGeneratorsOutput[TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR];
  if (!modelClassSchemas) {
    throw new Error(
      `The '${TYPESCRIPT_TEST_OBJECT_GENERATOR}' generator requires the output of the '${TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR}' generator. Make sure it runs before this generator.`,
    );
  }

  const outputPath = resolve(context.getProjectPathOrThrow(), output);

  const language = new TypeScriptTestObjectTargetLanguage(outputPath, context, {
    leadingComment: LEADING_COMMENT,
    generatorOptions: configuration,
    modelClassSchemas,
  });

  await generateCodeForSchemas(language, input);

  return language.generatedSchemas;
}
