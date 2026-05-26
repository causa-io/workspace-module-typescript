import type { BaseConfiguration } from '@causa/workspace';
import {
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  ModelSchemaParse,
  type Schema,
} from '@causa/workspace-core';
import {
  NoImplementationFoundError,
  type ImplementableFunctionArguments,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { mkdtemp, readFile, rm } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import { ModelRunCodeGeneratorForTypeScriptTestObject } from './run-code-generator-test-object.js';

describe('ModelRunCodeGeneratorForTypeScriptTestObject', () => {
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
    generator: 'typescriptTestObject',
    configuration: {},
    previousGeneratorsOutput: {
      [TYPESCRIPT_MODEL_CLASS_GENERATOR]: {},
    },
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
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
    });

    expect(() => context.call(ModelRunCodeGenerator, baseArguments)).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a generator other than typescriptTestObject', async () => {
    const { context } = createContext({
      projectPath: '/my-project',
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
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
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
    });

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'test-objects.ts' },
    });

    await expect(actualPromise).rejects.toThrow(
      'Could not generate input data for code generation. Ensure the model schema format is supported.',
    );
  });

  it('should generate TypeScript test object functions from JSON schemas and return GeneratedSchemas', async () => {
    const schemaFile = join(tmpDir, 'person.schema.json');
    const addressPath = `${schemaFile}#/properties/address`;
    const statusPath = `${schemaFile}#/properties/status`;
    const modelFile = join(tmpDir, 'model.ts');
    const schemas: Record<string, Schema> = {
      [schemaFile]: {
        kind: 'object',
        name: 'Person',
        path: schemaFile,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'name',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'age',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'email',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'isActive',
            type: { kind: 'primitive', type: 'boolean' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'createdAt',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'tags',
            type: {
              kind: 'array',
              items: { kind: 'primitive', type: 'string' },
              itemNullable: false,
            },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'address',
            type: { kind: 'ref', ref: addressPath },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'status',
            type: { kind: 'ref', ref: statusPath },
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
        additionalProperties: false,
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
      [statusPath]: {
        kind: 'enum',
        type: 'string',
        name: 'Status',
        path: statusPath,
        extensions: {},
        values: ['active', 'inactive', 'pending'],
      },
    };
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
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
    const configuration = {
      output: 'test-objects.ts',
      globs: ['*.schema.json'],
    };
    const modelClassSchemas = {
      [schemaFile]: { name: 'Person', file: modelFile },
      [addressPath]: { name: 'Address', file: modelFile },
      [statusPath]: { name: 'Status', file: modelFile },
    };

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration,
      previousGeneratorsOutput: {
        [TYPESCRIPT_MODEL_CLASS_GENERATOR]: modelClassSchemas,
      },
    });

    const file = join(tmpDir, 'test-objects.ts');
    expect(result).toEqual({
      [schemaFile]: { name: 'makePerson', file },
      [addressPath]: { name: 'makeAddress', file },
    });
    const actualOutput = await readFile(file, 'utf8');
    expect(actualOutput).toStartWith(
      '// This file was generated by the Causa command line. Do not edit it manually.',
    );
    expect(actualOutput).toInclude(
      'import { Address, Person, Status } from "./model.js";',
    );
    expect(actualOutput).toInclude(
      'export function makePerson(data: Partial<Person> = {}): Person',
    );
    expect(actualOutput).toInclude(
      'export function makeAddress(data: Partial<Address> = {}): Address',
    );
    expect(actualOutput).toInclude('name: "string",');
    expect(actualOutput).toInclude('age: 0,');
    expect(actualOutput).toInclude('isActive: false,');
    expect(actualOutput).toInclude('createdAt: new Date(),');
    expect(actualOutput).toInclude('tags: [],');
    expect(actualOutput).toInclude('address: makeAddress(),');
    expect(actualOutput).toInclude('status: Status.Active,');
    expect(actualOutput).toInclude('...data,');
  });

  it('should throw an error if model class schemas are missing from previous generators output', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'test-objects.ts', globs: [] },
      previousGeneratorsOutput: {},
    });

    await expect(actualPromise).rejects.toThrow(
      "The 'typescriptTestObject' generator requires the output of the 'typescriptModelClass' generator. Make sure it runs before this generator.",
    );
  });

  it('should throw an error if output configuration is missing', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { globs: [] },
    });

    await expect(actualPromise).rejects.toThrow(
      "The 'output' configuration for generator 'typescriptTestObject' must be a string.",
    );
  });

  it('should throw an error if output configuration is not a string', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 123, globs: ['*.schema.json'] },
    });

    await expect(actualPromise).rejects.toThrow(
      "The 'output' configuration for generator 'typescriptTestObject' must be a string.",
    );
  });
});
