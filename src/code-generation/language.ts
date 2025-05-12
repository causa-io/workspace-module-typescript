import type { TargetLanguageWithWriter } from '@causa/workspace-core';
import { writeFile } from 'fs/promises';
import prettier from 'prettier';
import { Option, type StringTypeMapping, TargetLanguage } from 'quicktype-core';
import { type RenderContext, Renderer } from 'quicktype-core/dist/Renderer.js';
import {
  TypeScriptWithDecoratorsRenderer,
  type TypeScriptWithDecoratorsRendererOptions,
} from './renderer.js';

/**
 * The quicktype {@link TargetLanguage} for TypeScript.
 * This language uses a renderer that generates classes and supports decorators on them.
 */
export class TypeScriptWithDecoratorsTargetLanguage
  extends TargetLanguage
  implements TargetLanguageWithWriter
{
  /**
   * Creates a new TypeScript target language.
   *
   * @param outputPath The path to write the generated source code to.
   * @param options The options for the TypeScript renderer.
   */
  constructor(
    readonly outputPath: string,
    readonly options: TypeScriptWithDecoratorsRendererOptions = {},
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

  protected makeRenderer(renderContext: RenderContext): Renderer {
    return new TypeScriptWithDecoratorsRenderer(
      this,
      renderContext,
      this.options,
    );
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
