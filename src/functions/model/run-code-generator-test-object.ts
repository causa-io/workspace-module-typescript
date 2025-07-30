import type { WorkspaceContext } from '@causa/workspace';
import {
  generateCodeForSchemas,
  ModelMakeGeneratorQuicktypeInputData,
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { resolve } from 'path';
import { TypeScriptTestObjectTargetLanguage } from '../../code-generation/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import { LEADING_COMMENT } from './utils.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptTestObject}.
 */
export const TYPESCRIPT_TEST_OBJECT_GENERATOR = 'typescriptTestObject';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript test object generator.
 */
export class ModelRunCodeGeneratorForTypeScriptTestObject extends ModelRunCodeGenerator {
  async _call(context: WorkspaceContext): Promise<GeneratedSchemas> {
    const { configuration, previousGeneratorsOutput } = this;

    const input = await context.call(ModelMakeGeneratorQuicktypeInputData, {
      configuration,
    });

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

    const language = new TypeScriptTestObjectTargetLanguage(
      outputPath,
      context,
      {
        leadingComment: LEADING_COMMENT,
        generatorOptions: configuration,
        modelClassSchemas,
      },
    );

    await generateCodeForSchemas(language, input);

    return language.generatedSchemas;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_TEST_OBJECT_GENERATOR
    );
  }
}
