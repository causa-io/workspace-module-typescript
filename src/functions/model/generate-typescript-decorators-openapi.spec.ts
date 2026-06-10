import type { BaseConfiguration } from '@causa/workspace';
import type { ObjectSchema } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import 'jest-extended';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';
import { ModelGenerateTypeScriptDecoratorsForOpenApi } from './generate-typescript-decorators-openapi.js';

const SCHEMA: ObjectSchema = {
  kind: 'object',
  name: 'Test',
  path: '/test.json',
  extensions: { tsOpenApi: true },
  databases: [],
  additionalProperties: false,
  properties: [],
};

describe('ModelGenerateTypeScriptDecoratorsForOpenApi', () => {
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
      functions: [ModelGenerateTypeScriptDecoratorsForOpenApi],
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
      functions: [ModelGenerateTypeScriptDecoratorsForOpenApi],
    });

    expect(() =>
      context.call(ModelGenerateTypeScriptDecorators, {
        generator: 'typescriptNestjsController',
        configuration: {},
        schemas: {},
        schema: SCHEMA,
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return decorators from makeOpenApiDecorators', async () => {
    const { context } = createContext({
      configuration: baseConfiguration,
      functions: [ModelGenerateTypeScriptDecoratorsForOpenApi],
    });

    const result = await context.call(ModelGenerateTypeScriptDecorators, {
      generator: 'typescriptModelClass',
      configuration: {},
      schemas: {},
      schema: SCHEMA,
      property: {
        name: 'p',
        type: { kind: 'primitive', type: 'string' },
        nullable: false,
        required: true,
        extensions: {},
      },
    });

    expect(result).toEqual([
      {
        source:
          '@_NestjsSwaggerApiProperty({ required: true, type: "string" })',
        imports: {
          '@nestjs/swagger': ['ApiProperty as _NestjsSwaggerApiProperty'],
        },
      },
    ]);
  });
});
