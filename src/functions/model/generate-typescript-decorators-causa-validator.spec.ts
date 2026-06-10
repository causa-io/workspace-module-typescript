import type { BaseConfiguration } from '@causa/workspace';
import type { ObjectSchema } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import 'jest-extended';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';
import { ModelGenerateTypeScriptDecoratorsForCausaValidator } from './generate-typescript-decorators-causa-validator.js';

const SCHEMA: ObjectSchema = {
  kind: 'object',
  name: 'Test',
  path: '/test.json',
  extensions: {},
  databases: [],
  additionalProperties: false,
  properties: [],
};

describe('ModelGenerateTypeScriptDecoratorsForCausaValidator', () => {
  const baseConfiguration: BaseConfiguration = {
    version: 1,
    workspace: { name: 'test' },
    project: {
      name: 'test',
      type: 'serviceContainer',
      language: 'typescript',
    },
  };

  it('should not support a language other than TypeScript', () => {
    const { context } = createContext({
      configuration: {
        ...baseConfiguration,
        project: { ...baseConfiguration.project!, language: 'java' },
      },
      functions: [ModelGenerateTypeScriptDecoratorsForCausaValidator],
    });

    expect(() =>
      context.call(ModelGenerateTypeScriptDecorators, {
        generator: 'typescriptModelClass',
        configuration: {},
        schemas: {},
        schema: SCHEMA,
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support a generator other than typescriptModelClass', () => {
    const { context } = createContext({
      configuration: baseConfiguration,
      functions: [ModelGenerateTypeScriptDecoratorsForCausaValidator],
    });

    expect(() =>
      context.call(ModelGenerateTypeScriptDecorators, {
        generator: 'other',
        configuration: {},
        schemas: {},
        schema: SCHEMA,
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return decorators from makeCausaValidatorDecorators', async () => {
    const { context } = createContext({
      configuration: baseConfiguration,
      functions: [ModelGenerateTypeScriptDecoratorsForCausaValidator],
    });

    const result = await context.call(ModelGenerateTypeScriptDecorators, {
      generator: 'typescriptModelClass',
      configuration: {},
      schemas: {},
      schema: SCHEMA,
      property: {
        name: 'p',
        type: { kind: 'primitive', type: 'string' },
        nullable: true,
        required: false,
        extensions: {},
      },
    });

    expect(result).toEqual([
      {
        source: '@_CausaRuntimeIsNullable()',
        imports: {
          '@causa/runtime': ['IsNullable as _CausaRuntimeIsNullable'],
        },
      },
      {
        source: '@_CausaRuntimeAllowMissing()',
        imports: {
          '@causa/runtime': ['AllowMissing as _CausaRuntimeAllowMissing'],
        },
      },
    ]);
  });
});
