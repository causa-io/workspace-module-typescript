import { type RenderContext, Renderer } from 'quicktype-core/dist/Renderer.js';
import { TypeScriptWithDecoratorsTargetLanguage } from '../language.js';
import type { TypeScriptModelClassOptions } from './options.js';
import { TypeScriptModelClassRenderer } from './renderer.js';

/**
 * The quicktype {@link TargetLanguage} for TypeScript.
 * This language uses a renderer that generates classes and supports decorators on them.
 */
export class TypeScriptModelClassTargetLanguage extends TypeScriptWithDecoratorsTargetLanguage<TypeScriptModelClassOptions> {
  protected makeRenderer(renderContext: RenderContext): Renderer {
    return new TypeScriptModelClassRenderer(this, renderContext, this.logger);
  }
}
