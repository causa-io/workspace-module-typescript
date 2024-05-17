import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import 'quicktype-core';
import { CausaValidatorRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { TypeScriptGetDecoratorRendererForCausaValidator } from './get-decorator-renderer-causa-validator.js';

describe('TypeScriptGetDecoratorRendererForCausaValidator', () => {
  it('should not support languages other than TypeScript', () => {
    const { context } = createContext({
      configuration: {
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'javascript',
        },
      },
      functions: [TypeScriptGetDecoratorRendererForCausaValidator],
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
      functions: [TypeScriptGetDecoratorRendererForCausaValidator],
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
          codeGeneration: { decoratorRenderers: ['causaValidator'] },
        },
      },
      functions: [TypeScriptGetDecoratorRendererForCausaValidator],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(CausaValidatorRenderer);
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
      functions: [TypeScriptGetDecoratorRendererForCausaValidator],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {});

    expect(actualRenderer).toBe(CausaValidatorRenderer);
  });
});
