import type { BaseConfiguration } from '@causa/workspace';
import {
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
import { ModelRunCodeGeneratorForTypeScriptModelClass } from './run-code-generator-model-class.js';
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
  },
  required: ['name', 'email'],
};

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
    configuration: {},
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
      // ModelMakeGeneratorQuicktypeInputData will not be present.
      functions: [ModelRunCodeGeneratorForTypeScriptModelClass],
    });

    const actualPromise = context.call(ModelRunCodeGenerator, baseArguments);

    await expect(actualPromise).rejects.toThrow(
      'Could not generate input data for code generation. Ensure the model schema format is supported.',
    );
  });

  it('should generate TypeScript classes from JSON schemas and return GeneratedSchemas', async () => {
    const schemaFile = join(tmpDir, 'person.schema.json');
    await writeFile(schemaFile, JSON.stringify(SCHEMA));
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptModelClass],
    });
    const input = await makeJsonSchemaInputData([schemaFile]);
    const makeMock = registerMockFunction(
      functionRegistry,
      ModelMakeGeneratorQuicktypeInputData,
      async () => input,
    );
    const configuration = {
      output: 'generated.ts',
      globs: ['*.schema.json'],
    };

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration,
    });

    const file = join(tmpDir, 'generated.ts');
    expect(makeMock).toHaveBeenCalledWith(context, { configuration });
    expect(result).toEqual({
      [schemaFile]: { name: 'Person', file },
      [`${schemaFile}#/properties/address`]: { name: 'Address', file },
    });
    const actualOutput = await readFile(file, 'utf8');
    expect(actualOutput).toStartWith(`// ${LEADING_COMMENT}`);
    expect(actualOutput).toInclude('export class Person');
    expect(actualOutput).toInclude('export class Address');
  });
});
