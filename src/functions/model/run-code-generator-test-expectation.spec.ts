import type { BaseConfiguration } from '@causa/workspace';
import {
  EventTopicList,
  makeJsonSchemaInputData,
  ModelMakeGeneratorQuicktypeInputData,
  ModelRunCodeGenerator,
} from '@causa/workspace-core';
import {
  NoImplementationFoundError,
  type ImplementableFunctionArguments,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import { ModelRunCodeGeneratorForTypeScriptTestExpectation } from './run-code-generator-test-expectation.js';
import { LEADING_COMMENT } from './utils.js';

const SCHEMA = {
  title: 'User',
  type: 'object',
  description: 'A user in the system',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      description: "The user's ID",
    },
    name: {
      type: 'string',
      description: "The user's name",
    },
    email: {
      type: 'string',
      format: 'email',
      description: "The user's email address",
    },
    isActive: {
      type: 'boolean',
      description: 'Whether the user is active',
    },
  },
  required: ['id', 'name', 'email'],
};

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
      [TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR]: {},
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

  it('should generate TypeScript test expectation functions from JSON schemas and return GeneratedSchemas', async () => {
    const schemaFile = join(tmpDir, 'user.schema.json');
    const modelFile = join(tmpDir, 'model.ts');
    await writeFile(schemaFile, JSON.stringify(SCHEMA));
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: {
        ...baseConfiguration,
        project: { ...baseConfiguration.project!, language: 'typescript' },
      },
      functions: [ModelRunCodeGeneratorForTypeScriptTestExpectation],
    });
    const input = await makeJsonSchemaInputData([schemaFile]);
    const parseMock = registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
    );
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
        [TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR]: modelClassSchemas,
      },
    });

    const file = join(tmpDir, 'test-expectations.ts');
    expect(parseMock).toHaveBeenCalledWith(context, { configuration });
    expect(eventTopicsMock).toHaveBeenCalledWith(context, {});
    const actualOutput = await readFile(file, 'utf8');
    expect(result).toEqual({
      [schemaFile]: { name: 'expectUser,expectUserNotToExist', file },
    });
    expect(actualOutput).toStartWith(`// ${LEADING_COMMENT}`);
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
      'const actual = await runner.run((t) => t.get(User, expected));',
    );
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
    const input = await makeJsonSchemaInputData([]);
    registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
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
    const input = await makeJsonSchemaInputData([]);
    registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
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
    const input = await makeJsonSchemaInputData([]);
    registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
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
