import type { BaseConfiguration } from '@causa/workspace';
import {
  EventTopicList,
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
import { ModelRunCodeGeneratorForTypeScriptTestExpectation } from './run-code-generator-test-expectation.js';

describe('ModelRunCodeGeneratorForTypeScriptTestExpectation', () => {
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
    generator: 'typescriptTestExpectation',
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
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
    });

    expect(() => context.call(ModelRunCodeGenerator, baseArguments)).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a generator other than typescriptTestExpectation', async () => {
    const { context } = createContext({
      projectPath: '/my-project',
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
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
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
    });

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'test-expectations.ts' },
    });

    await expect(actualPromise).rejects.toThrow(
      'Could not generate input data for code generation. Ensure the model schema format is supported.',
    );
  });

  it('should generate TypeScript test expectation functions from JSON schemas and return GeneratedSchemas', async () => {
    const schemaFile = join(tmpDir, 'user.schema.json');
    const modelFile = join(tmpDir, 'model.ts');
    const schemas: Record<string, Schema> = {
      [schemaFile]: {
        kind: 'object',
        name: 'User',
        path: schemaFile,
        extensions: {},
        databases: [],
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'name',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
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
        ],
      },
    };
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
    });
    const parseMock = registerMockFunction(
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
    const eventTopicsMock = registerMockFunction(
      functionRegistry,
      EventTopicList,
      async () => [
        {
          id: 'user.created.v1',
          schemaFilePath: join(tmpDir, 'events/user-created.json'),
          formatParts: { domain: 'user', event: 'created', version: 'v1' },
        },
      ],
    );
    const configuration = {
      output: 'test-expectations.ts',
      globs: ['*.schema.json'],
      entitiesGlobs: ['**/user.schema.json'],
    };
    const modelClassSchemas = {
      [schemaFile]: { name: 'User', file: modelFile },
    };

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration,
      previousGeneratorsOutput: {
        [TYPESCRIPT_MODEL_CLASS_GENERATOR]: modelClassSchemas,
      },
    });

    const file = join(tmpDir, 'test-expectations.ts');
    expect(parseMock).toHaveBeenCalledWith(context, { configuration });
    expect(eventTopicsMock).toHaveBeenCalledWith(context, {});
    const actualOutput = await readFile(file, 'utf8');
    expect(result).toEqual({
      [schemaFile]: { name: 'expectUser,expectUserNotToExist', file },
    });
    expect(actualOutput).toStartWith(
      '// This file was generated by the Causa command line. Do not edit it manually.',
    );
    expect(actualOutput).toInclude(
      'import {\n  type ReadOnlyStateTransaction,\n  type Transaction,\n  type TransactionRunner,\n} from "@causa/runtime";',
    );
    expect(actualOutput).toInclude('import { User } from "./model.js";');
    expect(actualOutput).toInclude('export async function expectUser(');
    expect(actualOutput).toInclude(
      'runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,',
    );
    expect(actualOutput).toInclude('expected: Partial<User>,');
    expect(actualOutput).toInclude('): Promise<User> {');
    expect(actualOutput).toInclude(
      'const actual = await runner.run({ readOnly: true }, (t) =>',
    );
    expect(actualOutput).toInclude('t.get(User, expected)');
    expect(actualOutput).toInclude('expect(actual).toEqual({');
    expect(actualOutput).toInclude('id: expect.any(String),');
    expect(actualOutput).toInclude('name: expect.any(String),');
    expect(actualOutput).toInclude('email: expect.any(String),');
    expect(actualOutput).toInclude(
      'isActive: expect.toBeOneOf([undefined, expect.any(Boolean)]),',
    );
    expect(actualOutput).toInclude('...expected,');
    expect(actualOutput).toInclude('});');
    expect(actualOutput).toInclude('return actual as User;');
  });

  it('should throw an error if model class schemas are missing from previous generators output', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );
    registerMockFunction(functionRegistry, EventTopicList, async () => []);

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'test-expectations.ts', globs: [] },
      previousGeneratorsOutput: {},
    });

    await expect(actualPromise).rejects.toThrow(
      "The 'typescriptTestExpectation' generator requires the output of the 'typescriptModelClass' generator. Make sure it runs before this generator.",
    );
  });

  it('should throw an error if output configuration is missing', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );
    registerMockFunction(functionRegistry, EventTopicList, async () => []);

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { globs: [] },
    });

    await expect(actualPromise).rejects.toThrow(
      "The 'output' configuration for generator 'typescriptTestExpectation' must be a string.",
    );
  });

  it('should throw an error if output configuration is not a string', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );
    registerMockFunction(functionRegistry, EventTopicList, async () => []);

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 123, globs: ['*.schema.json'] },
    });

    await expect(actualPromise).rejects.toThrow(
      "The 'output' configuration for generator 'typescriptTestExpectation' must be a string.",
    );
  });
});
