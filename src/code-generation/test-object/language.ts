import { type RenderContext, Renderer } from 'quicktype-core/dist/Renderer.js';
import { TypeScriptWithDecoratorsTargetLanguage } from '../language.js';
import { type TypeScriptTestObjectOptions } from './options.js';
import { TypeScriptTestObjectRenderer } from './renderer.js';

/**
 * The quicktype {@link TargetLanguage} for TypeScript test object generation.
 * This language uses a renderer that generates utility functions to create test objects.
 */
export class TypeScriptTestObjectTargetLanguage extends TypeScriptWithDecoratorsTargetLanguage<TypeScriptTestObjectOptions> {
  protected makeRenderer(renderContext: RenderContext): Renderer {
    return new TypeScriptTestObjectRenderer(this, renderContext, this.logger);
  }
}
