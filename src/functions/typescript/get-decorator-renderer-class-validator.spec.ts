import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { ClassValidatorTransformerPropertyDecoratorsRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { TypeScriptGetDecoratorRendererForClassValidator } from './get-decorator-renderer-class-validator.js';

describe('TypeScriptGetDecoratorRendererForClassValidator', () => {
  it('should not support languages other than TypeScript', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'javascript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForClassValidator],
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
      functions: [TypeScriptGetDecoratorRendererForClassValidator],
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
        typescript: {
          codeGeneration: { decoratorRenderers: ['classValidator'] },
        },
      },
      functions: [TypeScriptGetDecoratorRendererForClassValidator],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(
      ClassValidatorTransformerPropertyDecoratorsRenderer,
    );
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
      functions: [TypeScriptGetDecoratorRendererForClassValidator],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(
      ClassValidatorTransformerPropertyDecoratorsRenderer,
    );
  });
});
