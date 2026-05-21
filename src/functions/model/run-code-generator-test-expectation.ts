import {
  EventTopicList,
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  ModelSchemaParse,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { resolve } from 'path';
import { TypeScriptTestExpectationGenerator } from '../../code-generation/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptTestExpectation}.
 */
export const TYPESCRIPT_TEST_EXPECTATION_GENERATOR =
  'typescriptTestExpectation';

/**
 * Runs the TypeScript test expectation code generator: parses input schemas with {@link ModelSchemaParse} and
 * renders helper functions through {@link TypeScriptTestExpectationGenerator}.
 */
export class ModelRunCodeGeneratorForTypeScriptTestExpectation extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const { configuration, previousGeneratorsOutput } = this;

    const { output, entitiesGlobs } = configuration;
    if (!output || typeof output !== 'string') {
      throw new Error(
        `The 'output' configuration for generator '${TYPESCRIPT_TEST_EXPECTATION_GENERATOR}' must be a string.`,
      );
    }
    if (
      entitiesGlobs !== undefined &&
      !(
        Array.isArray(entitiesGlobs) &&
        entitiesGlobs.every((g) => typeof g === 'string')
      )
    ) {
      throw new Error(
        `The 'entitiesGlobs' configuration for generator '${TYPESCRIPT_TEST_EXPECTATION_GENERATOR}' must be an array of strings when provided.`,
      );
    }

    const modelClassSchemas =
      previousGeneratorsOutput[TYPESCRIPT_MODEL_CLASS_GENERATOR];
    if (!modelClassSchemas) {
      throw new Error(
        `The '${TYPESCRIPT_TEST_EXPECTATION_GENERATOR}' generator requires the output of the '${TYPESCRIPT_MODEL_CLASS_GENERATOR}' generator. Make sure it runs before this generator.`,
      );
    }

    let files: string[];
    try {
      ({ files } = await this._context.call(ModelParseCodeGeneratorInputs, {
        configuration,
      }));
    } catch (error) {
      if (error instanceof NoImplementationFoundError) {
        throw new Error(
          'Could not generate input data for code generation. Ensure the model schema format is supported.',
        );
      }
      throw error;
    }

    const { schemas, errors } = await this._context.call(ModelSchemaParse, {
      paths: files,
    });

    const errorEntries = Object.entries(errors);
    if (errorEntries.length > 0) {
      const details = errorEntries
        .map(([path, err]) => `${path}: ${err.message}`)
        .join('\n');
      throw new Error(`Failed to parse one or more schema files:\n${details}`);
    }

    const eventTopics = await this._context.call(EventTopicList, {});

    const projectPath = this._context.getProjectPathOrThrow();
    const outputPath = resolve(projectPath, output);
    const resolvedEntitiesGlobs = entitiesGlobs?.map((g) =>
      resolve(projectPath, g),
    );

    const generator = new TypeScriptTestExpectationGenerator(
      outputPath,
      schemas,
      modelClassSchemas,
      eventTopics,
      { entitiesGlobs: resolvedEntitiesGlobs },
    );
    await generator.generate();

    return generator.generatedSchemas;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_TEST_EXPECTATION_GENERATOR
    );
  }
}
