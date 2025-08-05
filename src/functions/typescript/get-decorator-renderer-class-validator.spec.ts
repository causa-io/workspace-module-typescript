import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { ClassValidatorTransformerPropertyDecoratorsRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from '../model/run-code-generator-model-class.js';
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
      functions: [TypeScriptGetDecoratorRendererForClassValidator],
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
      functions: [TypeScriptGetDecoratorRendererForClassValidator],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {
      generator: TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR,
      configuration: {},
    });

    expect(actualRenderer).toBe(
      ClassValidatorTransformerPropertyDecoratorsRenderer,
    );
  });
});
