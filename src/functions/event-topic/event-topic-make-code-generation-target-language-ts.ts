import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicMakeCodeGenerationTargetLanguage,
  type TargetLanguageWithWriter,
} from '@causa/workspace-core';
import { resolve } from 'path';
import { TypeScriptWithDecoratorsTargetLanguage } from '../../code-generation/index.js';
import type { TypeScriptConfiguration } from '../../configurations/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';

/**
 * The default path for the generated file.
 */
const DEFAULT_OUTPUT_PATH = 'src/model.ts';

/**
 * The default leading comment for the generated file.
 */
const DEFAULT_LEADING_COMMENT = `This file was generated by the Causa command line. Do not edit it manually.`;

/**
 * Implements {@link EventTopicMakeCodeGenerationTargetLanguage} for TypeScript.
 * The language and the underlying renderer are configured using the options in the `typescript.codeGeneration`
 * configuration.
 * Additional decorators on the generated classes can be configured using the
 * `typescript.codeGeneration.decoratorRenderers` configuration.
 * Those decorators are fetched using the {@link TypeScriptGetDecoratorRenderer} workspace function.
 */
export class EventTopicMakeCodeGenerationTargetLanguageForTypeScript extends EventTopicMakeCodeGenerationTargetLanguage {
  async _call(context: WorkspaceContext): Promise<TargetLanguageWithWriter> {
    const projectPath = context.getProjectPathOrThrow();
    const conf = context.asConfiguration<TypeScriptConfiguration>();

    const outputPath = resolve(
      projectPath,
      conf.get('typescript.codeGeneration.outputFile') ?? DEFAULT_OUTPUT_PATH,
    );

    const nonNullAssertionOnProperties =
      conf.get('typescript.codeGeneration.nonNullAssertionOnProperties') ??
      true;
    const readonlyProperties =
      conf.get('typescript.codeGeneration.readonlyProperties') ?? true;
    const assignConstructor =
      conf.get('typescript.codeGeneration.assignConstructor') ?? true;
    const leadingComment =
      conf.get('typescript.codeGeneration.leadingComment') ??
      DEFAULT_LEADING_COMMENT;
    const decoratorOptions =
      conf.get('typescript.codeGeneration.decoratorOptions') ?? {};

    const decoratorRenderers = context
      .getFunctionImplementations(TypeScriptGetDecoratorRenderer, {})
      .map((f) => f._call(context))
      .sort((r1, r2) => r1.name.localeCompare(r2.name));

    return new TypeScriptWithDecoratorsTargetLanguage(outputPath, {
      decoratorRenderers,
      nonNullAssertionOnProperties,
      readonlyProperties,
      assignConstructor,
      leadingComment,
      decoratorOptions,
    });
  }

  _supports(context: WorkspaceContext): boolean {
    return context.get('project.language') === 'typescript';
  }
}
