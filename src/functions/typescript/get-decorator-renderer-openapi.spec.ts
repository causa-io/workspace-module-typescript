import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { OpenApiRenderer } from '../../code-generation/renderers/index.js';
import { TypeScriptGetDecoratorRenderer } from '../../definitions/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from '../model/run-code-generator-model-class.js';
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
      functions: [TypeScriptGetDecoratorRendererForOpenApi],
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
      functions: [TypeScriptGetDecoratorRendererForOpenApi],
    });

    const actualRenderer = context.call(TypeScriptGetDecoratorRenderer, {
      generator: TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR,
      configuration: {},
    });

    expect(actualRenderer).toBe(OpenApiRenderer);
  });
});
