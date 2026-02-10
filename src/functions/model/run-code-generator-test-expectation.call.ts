import type { WorkspaceContext } from '@causa/workspace';
import { EventTopicList, type GeneratedSchemas } from '@causa/workspace-core';
import { generateCodeForSchemas } from '@causa/workspace-core/code-generation';
import { resolve } from 'path';
import { TypeScriptTestExpectationTargetLanguage } from '../../code-generation/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import type { ModelRunCodeGeneratorForTypeScriptTestExpectation } from './run-code-generator-test-expectation.js';
import { TYPESCRIPT_TEST_EXPECTATION_GENERATOR } from './run-code-generator-test-expectation.js';
import { LEADING_COMMENT, tryMakeGeneratorInputData } from './utils.js';

export default async function call(
  this: ModelRunCodeGeneratorForTypeScriptTestExpectation,
  context: WorkspaceContext,
): Promise<GeneratedSchemas> {
  const { configuration, previousGeneratorsOutput } = this;

  const input = await tryMakeGeneratorInputData(context, configuration);
  const eventTopics = await context.call(EventTopicList, {});

  const { output } = configuration;
  if (!output || typeof output !== 'string') {
    throw new Error(
      `The 'output' configuration for generator '${TYPESCRIPT_TEST_EXPECTATION_GENERATOR}' must be a string.`,
    );
  }

  const modelClassSchemas =
    previousGeneratorsOutput[TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR];
  if (!modelClassSchemas) {
    throw new Error(
      `The '${TYPESCRIPT_TEST_EXPECTATION_GENERATOR}' generator requires the output of the '${TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR}' generator. Make sure it runs before this generator.`,
    );
  }

  const outputPath = resolve(context.getProjectPathOrThrow(), output);

  const language = new TypeScriptTestExpectationTargetLanguage(
    outputPath,
    context,
    {
      leadingComment: LEADING_COMMENT,
      generatorOptions: configuration,
      modelClassSchemas,
      eventTopics,
    },
  );

  await generateCodeForSchemas(language, input);

  return language.generatedSchemas;
}
