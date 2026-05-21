import type { WorkspaceContext } from '@causa/workspace';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import {
  ModelParseCodeGeneratorInputs,
  ModelSchemaParse,
  type GeneratedSchemas,
  type GeneratorsOutput,
  type Schema,
} from '@causa/workspace-core';
import { resolve } from 'path';

/**
 * Validates the `output` configuration value as a non-empty string and resolves it against the project path.
 *
 * @param context The workspace context (used to resolve the project path).
 * @param generator The name of the generator the configuration belongs to (used in the error message).
 * @param output The configuration value to validate.
 * @param details Optional extra clarification appended to the error message (e.g. `directory path`).
 * @returns The absolute output path.
 */
export function resolveOutputPath(
  context: WorkspaceContext,
  generator: string,
  output: unknown,
  details?: string,
): string {
  if (!output || typeof output !== 'string') {
    throw new Error(
      `The 'output' configuration for generator '${generator}' must be a string${details ? ` (${details})` : ''}.`,
    );
  }
  return resolve(context.getProjectPathOrThrow(), output);
}

/**
 * Looks up the output of a previously-run generator, throwing a uniform error when missing.
 *
 * @param previousGeneratorsOutput The `previousGeneratorsOutput` field of the calling generator.
 * @param generator The name of the calling generator (used in the error message).
 * @param requiredGenerator The name of the generator whose output is required.
 * @returns The generated schemas of `requiredGenerator`.
 */
export function requirePreviousGeneratorOutput(
  previousGeneratorsOutput: GeneratorsOutput,
  generator: string,
  requiredGenerator: string,
): GeneratedSchemas {
  const output = previousGeneratorsOutput[requiredGenerator];
  if (!output) {
    throw new Error(
      `The '${generator}' generator requires the output of the '${requiredGenerator}' generator. Make sure it runs before this generator.`,
    );
  }
  return output;
}

/**
 * Throws an aggregated error when the given error map is non-empty.
 *
 * @param errors Map of file path → error returned by schema-loading / schema-parsing functions.
 * @param prefix The first line of the thrown error message (e.g. `Failed to parse one or more schema files:`).
 */
export function throwOnSchemaErrors(
  errors: Record<string, Error>,
  prefix: string,
): void {
  const entries = Object.entries(errors);
  if (entries.length === 0) {
    return;
  }
  const details = entries
    .map(([path, err]) => `${path}: ${err.message}`)
    .join('\n');
  throw new Error(`${prefix}\n${details}`);
}

/**
 * Calls {@link ModelParseCodeGeneratorInputs} (wrapping {@link NoImplementationFoundError} as a clearer error), feeds
 * the resulting file list to {@link ModelSchemaParse}, and throws on parse errors. Returns the parsed schema map.
 *
 * @param context The workspace context.
 * @param configuration The generator's configuration, forwarded to {@link ModelParseCodeGeneratorInputs}.
 */
export async function parseInputSchemas(
  context: WorkspaceContext,
  configuration: Record<string, unknown>,
): Promise<Record<string, Schema>> {
  let files: string[];
  try {
    ({ files } = await context.call(ModelParseCodeGeneratorInputs, {
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

  const { schemas, errors } = await context.call(ModelSchemaParse, {
    paths: files,
  });
  throwOnSchemaErrors(errors, 'Failed to parse one or more schema files:');
  return schemas;
}
