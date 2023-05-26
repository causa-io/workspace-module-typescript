import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicDefinition,
  EventTopicGenerateCode,
} from '@causa/workspace-core';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { load } from 'js-yaml';
import { compile } from 'json-schema-to-typescript';
import { template } from 'lodash-es';
import { dirname, join } from 'path';
import prettier from 'prettier';
import { TypeScriptConfiguration } from '../configurations/index.js';

/**
 * The default path format for the generated TypeScript topic schema definition files.
 */
const DEFAULT_DEFINITION_FILE_FORMAT =
  'src/events/${ domain }/${ topic }.${ version }.ts';

/**
 * Implements the {@link EventTopicGenerateCode} function for JSON events in TypeScript projects.
 * This uses `json-schema-to-typescript` to convert the JSONSchema to a TypeScript definition file.
 * The prettier configuration found in the project is applied.
 */
export class EventTopicGenerateCodeForTypeScriptAndJsonEvents extends EventTopicGenerateCode {
  async _call(context: WorkspaceContext): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();

    const definitionFileFormat =
      context
        .asConfiguration<TypeScriptConfiguration>()
        .get('typescript.events.definitionFileFormat') ??
      DEFAULT_DEFINITION_FILE_FORMAT;
    const definitionFilePathTemplate = template(definitionFileFormat);

    const prettierConfig = await prettier.resolveConfig(projectPath);

    await Promise.all(
      this.definitions.map(async (definition) =>
        this.generateCodeForDefinition(
          context,
          definition,
          definitionFilePathTemplate,
          { prettierConfig },
        ),
      ),
    );
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      context.get('events.format') === 'json'
    );
  }

  /**
   * Generate the TypeScript interface for a single {@link EventTopicDefinition}.
   *
   * @param context The {@link WorkspaceContext}.
   * @param definition The {@link EventTopicDefinition} to generate code for.
   * @param definitionFilePathTemplate A function that generates the path to the TypeScript definition from the
   *   {@link EventTopicDefinition.formatParts}.
   * @param options Options when generating the code.
   */
  private async generateCodeForDefinition(
    context: WorkspaceContext,
    definition: EventTopicDefinition,
    definitionFilePathTemplate: (formatParts: Record<string, string>) => string,
    options: {
      /**
       * The prettier configuration used to format the generated code.
       */
      prettierConfig?: prettier.Options | null;
    },
  ): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();

    context.logger.info(
      `📫 Generating TypeScript definition for topic '${definition.id}'.`,
    );

    const jsonSchemaBuffer = await readFile(definition.schemaFilePath);
    const jsonSchema = (await load(jsonSchemaBuffer.toString())) as any;

    const definitionFilePath = definitionFilePathTemplate(
      definition.formatParts,
    );
    const definitionFileAbsolutePath = join(projectPath, definitionFilePath);

    const code = await compile(jsonSchema, '', {
      style: options.prettierConfig ? options.prettierConfig : undefined,
    });

    const definitionDirectory = dirname(definitionFileAbsolutePath);
    await mkdir(definitionDirectory, { recursive: true });

    context.logger.debug(
      `📫 Writing TypeScript definition at '${definitionFileAbsolutePath}'.`,
    );
    await writeFile(definitionFileAbsolutePath, code);
  }
}
