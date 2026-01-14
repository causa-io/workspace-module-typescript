import type { WorkspaceContext } from '@causa/workspace';
import type {
  GeneratedSchemas,
  TargetLanguageWithWriter,
} from '@causa/workspace-core';
import { writeFile } from 'fs/promises';
import prettier from 'prettier';
import { Option, type StringTypeMapping, TargetLanguage } from 'quicktype-core';

/**
 * A base quicktype {@link TargetLanguage} for TypeScript.
 * This language enables support for decorators on classes and properties.
 * It also implements {@link TargetLanguageWithWriter} by formatting the generated code with `prettier` before writing
 * it to disk.
 */
export abstract class TypeScriptWithDecoratorsTargetLanguage<
  T extends object = object,
>
  extends TargetLanguage
  implements TargetLanguageWithWriter
{
  /**
   * Contains information about the {@link GeneratedSchema}.
   * This is only populated once the code generation is complete.
   */
  readonly generatedSchemas: GeneratedSchemas = {};

  /**
   * Creates a new TypeScript target language.
   *
   * @param outputPath The path to write the generated source code to.
   * @param workspaceContext The workspace context, which provides access to functions, workspace / project paths, and
   *   logging.
   * @param options The options for the TypeScript renderer.
   */
  constructor(
    readonly outputPath: string,
    readonly workspaceContext: WorkspaceContext,
    readonly options: T,
  ) {
    super({
      displayName: 'TypeScript',
      names: ['typescript'],
      extension: 'ts',
    });
  }

  protected getOptions(): Record<string, Option<string, unknown>> {
    return {};
  }

  get stringTypeMapping(): StringTypeMapping {
    // Defining this mapping ensures the renderer receives the original type names for the listed types (instead of just
    // `string`). For example, this is useful to set decorators specific to dates and UUIDs.
    return new Map([
      ['date', 'date-time'],
      ['date-time', 'date-time'],
      ['uuid', 'uuid'],
    ]);
  }

  get supportsOptionalClassProperties(): boolean {
    return true;
  }

  get supportsFullObjectType(): boolean {
    return true;
  }

  async writeFile(source: string): Promise<void> {
    const prettierConfig = await prettier.resolveConfig(this.outputPath);

    const formattedOutput = await prettier.format(source, {
      parser: 'typescript',
      ...prettierConfig,
    });

    await writeFile(this.outputPath, formattedOutput);
  }
}
