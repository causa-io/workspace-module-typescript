import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { CausaValidatorRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from '../model/run-code-generator-model-class.js';
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

    expect(() =>
      context.call(TypeScriptGetDecoratorRenderer, {
        generator: TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR,
        configuration: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support other generators', () => {
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

    expect(() =>
      context.call(TypeScriptGetDecoratorRenderer, {
        generator: 'otherGenerator',
        configuration: {},
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return the renderer for the correct generator', () => {
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

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {
      generator: TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR,
      configuration: {},
    });

    expect(actualRenderer).toBe(CausaValidatorRenderer);
  });
});
