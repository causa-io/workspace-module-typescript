import {
  EventTopicList,
  ModelRunCodeGenerator,
  type GeneratedSchemas,
} from '@causa/workspace-core';
import { resolve } from 'path';
import { TypeScriptTestExpectationGenerator } from '../../code-generation/index.js';
import type { TypeScriptModelConfiguration } from '../../configurations/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import {
  parseInputSchemas,
  requirePreviousGeneratorOutput,
  resolveOutputPath,
} from './utils.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptTestExpectation}.
 */
export const TYPESCRIPT_TEST_EXPECTATION_GENERATOR =
  'typescriptTestExpectation';

/**
 * Runs the TypeScript test expectation code generator: parses input schemas with {@link parseInputSchemas} and
 * renders helper functions through {@link TypeScriptTestExpectationGenerator}.
 */
export class ModelRunCodeGeneratorForTypeScriptTestExpectation extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const outputPath = resolveOutputPath(
      this._context,
      TYPESCRIPT_TEST_EXPECTATION_GENERATOR,
      this.configuration.output,
    );
    const modelClassSchemas = requirePreviousGeneratorOutput(
      this.previousGeneratorsOutput,
      TYPESCRIPT_TEST_EXPECTATION_GENERATOR,
      TYPESCRIPT_MODEL_CLASS_GENERATOR,
    );
    const schemas = await parseInputSchemas(this._context, this.configuration);
    const eventTopics = await this._context.call(EventTopicList, {});

    const projectPath = this._context.getProjectPathOrThrow();
    if (
      this.configuration.entitiesGlobs !== undefined &&
      !(
        Array.isArray(this.configuration.entitiesGlobs) &&
        this.configuration.entitiesGlobs.every((g) => typeof g === 'string')
      )
    ) {
      throw new Error(
        `The 'entitiesGlobs' configuration for generator '${TYPESCRIPT_TEST_EXPECTATION_GENERATOR}' must be an array of strings when provided.`,
      );
    }
    const entitiesGlobs = this.configuration.entitiesGlobs?.map((g) =>
      resolve(projectPath, g),
    );
    const constraintSuffix = this._context
      .asConfiguration<TypeScriptModelConfiguration>()
      .get('model.constraintSuffix');

    const generator = new TypeScriptTestExpectationGenerator(
      outputPath,
      schemas,
      modelClassSchemas,
      eventTopics,
      { entitiesGlobs, constraintSuffix },
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
