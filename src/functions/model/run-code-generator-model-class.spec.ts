import type { BaseConfiguration } from '@causa/workspace';
import {
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  ModelSchemaParse,
  type Schema,
} from '@causa/workspace-core';
import { ModelGenerateTypeScriptDecorators } from '../../definitions/index.js';
import {
  NoImplementationFoundError,
  type ImplementableFunctionArguments,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { mkdtemp, readFile, rm } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { ModelRunCodeGeneratorForTypeScriptModelClass } from './run-code-generator-model-class.js';

describe('ModelRunCodeGeneratorForTypeScriptModelClass', () => {
  const baseConfiguration: BaseConfiguration = {
    version: 1,
    workspace: { name: '🔖' },
    project: {
      name: 'my-project',
      type: 'serviceContainer',
      language: 'typescript',
    },
  };
  const baseArguments: ImplementableFunctionArguments<ModelRunCodeGenerator> = {
    generator: 'typescriptModelClass',
    configuration: { output: 'generated.ts', globs: ['*.schema.json'] },
    previousGeneratorsOutput: {},
  };

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not support a language other than TypeScript', async () => {
    const { context } = createContext({
      projectPath: '/my-project',
      configuration: {
        ...baseConfiguration,
        project: { ...baseConfiguration.project!, language: 'java' },
      },
      functions: [ModelRunCodeGeneratorForTypeScriptModelClass],
    });

    expect(() => context.call(ModelRunCodeGenerator, baseArguments)).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a generator other than typescriptModelClass', async () => {
    const { context } = createContext({
      projectPath: '/my-project',
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptModelClass],
    });

    expect(() =>
      context.call(ModelRunCodeGenerator, {
        ...baseArguments,
        generator: 'Other',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should throw an error if the input data cannot be created', async () => {
    const { context } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      // ModelParseCodeGeneratorInputs will not be present.
      functions: [ModelRunCodeGeneratorForTypeScriptModelClass],
    });

    const actualPromise = context.call(ModelRunCodeGenerator, baseArguments);

    await expect(actualPromise).rejects.toThrow(
      'Could not generate input data for code generation. Ensure the model schema format is supported.',
    );
  });

  it('should generate TypeScript classes from JSON schemas and return GeneratedSchemas', async () => {
    const schemaFile = join(tmpDir, 'person.schema.json');
    const addressPath = `${schemaFile}#/properties/address`;
    const schemas: Record<string, Schema> = {
      [schemaFile]: {
        kind: 'object',
        name: 'Person',
        path: schemaFile,
        description: 'A person in the system',
        extensions: {},
        databases: [],
        properties: [
          {
            name: 'name',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            description: "The person's name",
            extensions: {},
          },
          {
            name: 'age',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: false,
            description: "The person's age",
            extensions: {},
          },
          {
            name: 'email',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            description: "The person's email address",
            extensions: {},
          },
          {
            name: 'address',
            type: { kind: 'ref', ref: addressPath },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
      [addressPath]: {
        kind: 'object',
        name: 'Address',
        path: addressPath,
        extensions: {},
        databases: [],
        properties: [
          {
            name: 'street',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'city',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'zipCode',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
    };
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptModelClass],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({
        includeEvents: false,
        globs: ['*.schema.json'],
        files: [schemaFile],
      }),
    );
    registerMockFunction(functionRegistry, ModelSchemaParse, async () => ({
      schemas,
      errors: {},
    }));
    registerMockFunction(
      functionRegistry,
      ModelGenerateTypeScriptDecorators,
      async (_, args) =>
        args.property
          ? []
          : [
              {
                source: '@TestDecorator()',
                imports: { 'test-module': ['TestDecorator'] },
              },
            ],
    );

    const result = await context.call(ModelRunCodeGenerator, baseArguments);

    const file = join(tmpDir, 'generated.ts');
    expect(result).toEqual({
      [schemaFile]: { name: 'Person', file },
      [addressPath]: { name: 'Address', file },
    });
    const actualOutput = await readFile(file, 'utf8');
    expect(actualOutput).toStartWith(
      '// This file was generated by the Causa command line. Do not edit it manually.',
    );
    expect(actualOutput).toInclude('export class Person');
    expect(actualOutput).toInclude('export class Address');
    expect(actualOutput).toInclude('@TestDecorator()');
    expect(actualOutput).toInclude('from "test-module"');
  });
});
