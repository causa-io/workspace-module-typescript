import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { OpenApiRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { TypeScriptGetDecoratorRendererForOpenApi } from './get-decorator-renderer-openapi.js';

describe('TypeScriptGetDecoratorRendererForOpenApi', () => {
  it('should not support languages other than TypeScript', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'javascript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForOpenApi],
    });

    expect(() => context.call(TypeScriptGetDecoratorRenderer, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a configuration without the renderer', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        typescript: { codeGeneration: { decoratorRenderers: ['other'] } },
      },
      functions: [TypeScriptGetDecoratorRendererForOpenApi],
    });

    expect(() => context.call(TypeScriptGetDecoratorRenderer, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should return the renderer', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        typescript: { codeGeneration: { decoratorRenderers: ['openapi'] } },
      },
      functions: [TypeScriptGetDecoratorRendererForOpenApi],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(OpenApiRenderer);
  });

  it('should return the renderer when none is specified', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForOpenApi],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(OpenApiRenderer);
  });
});
