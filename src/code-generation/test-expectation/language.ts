import { type RenderContext, Renderer } from 'quicktype-core/dist/Renderer.js';
import { TypeScriptWithDecoratorsTargetLanguage } from '../language.js';
import { type TypeScriptTestExpectationOptions } from './options.js';
import { TypeScriptTestExpectationRenderer } from './renderer.js';

/**
 * The quicktype {@link TargetLanguage} for TypeScript test expectation generation.
 * This language uses a renderer that generates utility functions for test expectations.
 */
export class TypeScriptTestExpectationTargetLanguage extends TypeScriptWithDecoratorsTargetLanguage<TypeScriptTestExpectationOptions> {
  protected makeRenderer(renderContext: RenderContext): Renderer {
    return new TypeScriptTestExpectationRenderer(this, renderContext);
  }
}
