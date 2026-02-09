import type { BaseConfiguration } from '@causa/workspace';
import {
  ModelMakeGeneratorQuicktypeInputData,
  ModelRunCodeGenerator,
} from '@causa/workspace-core';
import { makeJsonSchemaInputData } from '@causa/workspace-core/code-generation';
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
import { ModelRunCodeGeneratorForTypeScriptTestObject } from './run-code-generator-test-object.js';
import { LEADING_COMMENT } from './utils.js';

const SCHEMA = {
  title: 'Person',
  type: 'object',
  description: 'A person in the system',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      description: "The person's name",
    },
    age: {
      type: 'integer',
      minimum: 0,
      description: "The person's age",
    },
    email: {
      type: 'string',
      format: 'email',
      description: "The person's email address",
    },
    isActive: {
      type: 'boolean',
      description: 'Whether the person is active',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the person was created',
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Tags associated with the person',
    },
    address: {
      title: 'Address',
      type: 'object',
      additionalProperties: false,
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        zipCode: { type: 'string' },
      },
      required: ['street', 'city'],
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive', 'pending'],
      description: 'The status of the person',
    },
  },
  required: ['name', 'email'],
};

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
      // ModelMakeGeneratorQuicktypeInputData will not be present.
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
    });

    const actualPromise = context.call(ModelRunCodeGenerator, baseArguments);

    await expect(actualPromise).rejects.toThrow(
      'Could not generate input data for code generation. Ensure the model schema format is supported.',
    );
  });

  it('should generate TypeScript test object functions from JSON schemas and return GeneratedSchemas', async () => {
    const schemaFile = join(tmpDir, 'person.schema.json');
    const modelFile = join(tmpDir, 'model.ts');
    await writeFile(schemaFile, JSON.stringify(SCHEMA));
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptTestObject],
    });
    const input = await makeJsonSchemaInputData([schemaFile]);
    const parseMock = registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
    );
    const configuration = {
      output: 'test-objects.ts',
      globs: ['*.schema.json'],
    };
    const modelClassSchemas = {
      [schemaFile]: { name: 'Person', file: modelFile },
      [`${schemaFile}#/properties/address`]: {
        name: 'Address',
        file: modelFile,
      },
      [`${schemaFile}#/properties/status`]: {
        name: 'Status',
        file: modelFile,
      },
    };

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration,
      previousGeneratorsOutput: {
        [TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR]: modelClassSchemas,
      },
    });

    const file = join(tmpDir, 'test-objects.ts');
    expect(parseMock).toHaveBeenCalledWith(context, { configuration });
    expect(result).toEqual({
      [schemaFile]: { name: 'makePerson', file },
      [`${schemaFile}#/properties/address`]: { name: 'makeAddress', file },
    });
    const actualOutput = await readFile(file, 'utf8');
    expect(actualOutput).toStartWith(`// ${LEADING_COMMENT}`);
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
    const input = await makeJsonSchemaInputData([]);
    registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
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
    const input = await makeJsonSchemaInputData([]);
    registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
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
    const input = await makeJsonSchemaInputData([]);
    registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
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
