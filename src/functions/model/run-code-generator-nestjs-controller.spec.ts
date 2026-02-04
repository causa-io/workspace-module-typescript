import type { BaseConfiguration } from '@causa/workspace';
import {
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
} from '@causa/workspace-core';
import {
  NoImplementationFoundError,
  type ImplementableFunctionArguments,
} from '@causa/workspace/function-registry';
import { createContext, registerMockFunction } from '@causa/workspace/testing';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  TypeScriptGetDecoratorRendererForCausaValidator,
  TypeScriptGetDecoratorRendererForClassValidator,
} from '../typescript/index.js';
import { TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import {
  ModelRunCodeGeneratorForTypeScriptNestjsController,
  TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR,
} from './run-code-generator-nestjs-controller.js';

const OPENAPI_SPEC = `
openapi: 3.1.0
x-causaResourceName: Car
info:
  title: Car API
  description: The API to manage cars.
  version: 0.1.0
paths:
  /cars:
    get:
      operationId: carList
      summary: Lists all cars.
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: ../entities/car-list.yaml
  /cars/{id}:
    get:
      operationId: carGet
      summary: Gets a car by ID.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: ../entities/car.yaml
    patch:
      operationId: carUpdate
      summary: Updates a car.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: updatedAt
          in: query
          required: true
          schema:
            type: string
            format: date-time
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: ../entities/car.yaml
    delete:
      operationId: carDelete
      summary: Deletes a car.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "204":
          description: Deleted successfully
`;

describe('ModelRunCodeGeneratorForTypeScriptNestjsController', () => {
  const baseConfiguration: BaseConfiguration = {
    version: 1,
    workspace: { name: '🔖' },
    project: {
      name: 'my-project',
      type: 'serviceContainer',
      language: 'typescript',
    },
  };
  let baseArguments: ImplementableFunctionArguments<ModelRunCodeGenerator>;

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    await mkdir(join(tmpDir, 'api'), { recursive: true });

    baseArguments = {
      generator: TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR,
      configuration: {},
      previousGeneratorsOutput: {
        [TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR]: {
          [join(tmpDir, 'entities/car.yaml')]: {
            name: 'Car',
            file: join(tmpDir, 'src/model/generated.ts'),
          },
          [join(tmpDir, 'entities/car-list.yaml')]: {
            name: 'CarList',
            file: join(tmpDir, 'src/model/generated.ts'),
          },
        },
      },
    };
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
      functions: [ModelRunCodeGeneratorForTypeScriptNestjsController],
    });

    expect(() => context.call(ModelRunCodeGenerator, baseArguments)).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support a generator other than typescriptNestjsController', async () => {
    const { context } = createContext({
      projectPath: '/my-project',
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptNestjsController],
    });

    expect(() =>
      context.call(ModelRunCodeGenerator, {
        ...baseArguments,
        generator: 'Other',
      }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should throw an error if the output configuration is missing', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptNestjsController],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: {},
    });

    await expect(actualPromise).rejects.toThrow(
      "The 'output' configuration for generator 'typescriptNestjsController' must be a string",
    );
  });

  it('should throw an error if typescriptModelClass has not run', async () => {
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptNestjsController],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );

    const actualPromise = context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'src/api/' },
      previousGeneratorsOutput: {},
    });

    await expect(actualPromise).rejects.toThrow(
      "requires the output of the 'typescriptModelClass' generator",
    );
  });

  it('should generate model.ts and controller files from OpenAPI spec', async () => {
    const specFile = join(tmpDir, 'api', 'car.api.yaml');
    await writeFile(specFile, OPENAPI_SPEC);

    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [
        ModelRunCodeGeneratorForTypeScriptNestjsController,
        TypeScriptGetDecoratorRendererForCausaValidator,
        TypeScriptGetDecoratorRendererForClassValidator,
      ],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({
        includeEvents: false,
        globs: ['api/*.api.yaml'],
        files: [specFile],
      }),
    );

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'src/api/', globs: ['api/*.api.yaml'] },
    });

    const file = join(tmpDir, 'src/api/model.ts');
    expect(result).toEqual({
      'carList/query': { file, name: 'CarListQueryParams' },
      'carGet/path': { file, name: 'CarGetPathParams' },
      'carUpdate/path': { file, name: 'CarUpdatePathParams' },
      'carUpdate/query': { file, name: 'CarUpdateQueryParams' },
      'carDelete/path': { file, name: 'CarDeletePathParams' },
    });

    const modelFile = join(tmpDir, 'src/api/model.ts');
    const modelContent = await readFile(modelFile, 'utf-8');
    expect(modelContent).toContain('export class CarListQueryParams');
    expect(modelContent).toContain('export class CarGetPathParams');
    expect(modelContent).toContain('export class CarUpdatePathParams');
    expect(modelContent).toContain('export class CarUpdateQueryParams');
    expect(modelContent).toContain('export class CarDeletePathParams');

    const controllerFile = join(tmpDir, 'src/api/car.api.controller.ts');
    const controllerContent = await readFile(controllerFile, 'utf-8');
    expect(controllerContent).toContain('export interface CarApiContract');
    expect(controllerContent).toContain('export function AsCarApiController()');
  });
});
