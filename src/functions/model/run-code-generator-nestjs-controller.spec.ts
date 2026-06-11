import type { BaseConfiguration } from '@causa/workspace';
import {
  EventTopicList,
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
import { ModelGenerateTypeScriptTriggerDecorators } from '../../definitions/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
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
        - name: state
          in: query
          required: false
          schema:
            oneOf:
              - $ref: ../entities/car.yaml#/$defs/CarState
        - name: kind
          in: query
          required: false
          schema:
            oneOf:
              - $ref: ../entities/car-kind.yaml
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
    model: { schema: 'jsonschema' },
  };
  let baseArguments: ImplementableFunctionArguments<ModelRunCodeGenerator>;

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    await mkdir(join(tmpDir, 'api'), { recursive: true });
    await mkdir(join(tmpDir, 'entities'), { recursive: true });
    await writeFile(
      join(tmpDir, 'entities/car.yaml'),
      `
title: Car
type: object
$defs:
  CarState:
    title: CarState
    type: string
    enum: [on, off]
`,
    );
    await writeFile(
      join(tmpDir, 'entities/car-kind.yaml'),
      `
title: CarKind
type: string
enum: [sedan, suv]
`,
    );

    baseArguments = {
      generator: TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR,
      configuration: {},
      previousGeneratorsOutput: {
        [TYPESCRIPT_MODEL_CLASS_GENERATOR]: {
          [join(tmpDir, 'entities/car.yaml')]: {
            name: 'Car',
            file: join(tmpDir, 'src/model/generated.ts'),
          },
          [join(tmpDir, 'entities/car-list.yaml')]: {
            name: 'CarList',
            file: join(tmpDir, 'src/model/generated.ts'),
          },
          [`${join(tmpDir, 'entities/car.yaml')}#/$defs/CarState`]: {
            name: 'CarState',
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
    const staleFile = join(tmpDir, 'src/api/stale.controller.ts');
    await mkdir(join(tmpDir, 'src/api'), { recursive: true });
    await writeFile(staleFile, '// Leftover from a previous generation.');

    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: baseConfiguration,
      functions: [ModelRunCodeGeneratorForTypeScriptNestjsController],
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
    registerMockFunction(functionRegistry, EventTopicList, async () => []);

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
      [join(tmpDir, 'entities/car-kind.yaml')]: { file, name: 'CarKind' },
    });

    const modelFile = join(tmpDir, 'src/api/model.ts');
    const modelContent = await readFile(modelFile, 'utf-8');
    expect(modelContent).toContain('export class CarListQueryParams');
    expect(modelContent).toContain('export class CarGetPathParams');
    expect(modelContent).toContain('export class CarUpdatePathParams');
    expect(modelContent).toContain('export class CarUpdateQueryParams');
    expect(modelContent).toContain('export class CarDeletePathParams');
    expect(modelContent).toContain(
      `import { CarState } from "../model/generated.js";`,
    );
    expect(modelContent).not.toContain('export enum CarState');
    expect(modelContent).toContain('readonly state?: CarState;');
    expect(modelContent).toContain('export enum CarKind');
    expect(modelContent).toContain('readonly kind?: CarKind;');

    const controllerFile = join(tmpDir, 'src/api/car.api.controller.ts');
    const controllerContent = await readFile(controllerFile, 'utf-8');
    expect(controllerContent).toContain('export interface CarApiContract');
    expect(controllerContent).toContain('export function AsCarApiController()');

    await expect(readFile(staleFile, 'utf-8')).rejects.toThrow('ENOENT');
  });

  it('should generate event controllers from service container triggers', async () => {
    const triggers = {
      handleCarForProcessing: {
        type: 'event',
        topic: 'my-domain.car-event.v1',
        description: 'Handles car events for processing.',
        endpoint: { type: 'http', path: '/cars/handleCarForProcessing' },
      },
      handleCarDeletion: {
        type: 'task',
        queue: 'car-deletion',
        dto: 'dtos/delete-car.dto.yaml',
        endpoint: { type: 'http', path: '/cars/handleCarDeletion' },
      },
      staleCarCleanup: {
        type: 'cron',
        schedule: '0 * * * *',
        endpoint: { type: 'http', path: '/background-jobs/staleCarCleanup' },
      },
      noHttpEndpoint: { type: 'event', topic: 'my-domain.other-event.v1' },
    };
    const { context, functionRegistry } = createContext({
      projectPath: tmpDir,
      configuration: { ...baseConfiguration, serviceContainer: { triggers } },
      functions: [ModelRunCodeGeneratorForTypeScriptNestjsController],
    });
    registerMockFunction(
      functionRegistry,
      ModelParseCodeGeneratorInputs,
      async () => ({ includeEvents: false, globs: [], files: [] }),
    );
    registerMockFunction(functionRegistry, EventTopicList, async () => [
      {
        id: 'my-domain.car-event.v1',
        schemaFilePath: join(tmpDir, 'events/car-event.yaml'),
        formatParts: {},
      },
    ]);
    const decoratorsMock = registerMockFunction(
      functionRegistry,
      ModelGenerateTypeScriptTriggerDecorators,
      async (_, { trigger }) =>
        (trigger as any).type === 'event'
          ? []
          : [
              {
                source: `@MyUseEventHandler('${(trigger as any).type}')`,
                imports: { 'my-module': ['MyUseEventHandler'] },
              },
            ],
    );

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'src/api/' },
      previousGeneratorsOutput: {
        [TYPESCRIPT_MODEL_CLASS_GENERATOR]: {
          [join(tmpDir, 'events/car-event.yaml')]: {
            name: 'CarEvent',
            file: join(tmpDir, 'src/model/generated.ts'),
          },
          [join(tmpDir, 'dtos/delete-car.dto.yaml')]: {
            name: 'DeleteCarDto',
            file: join(tmpDir, 'src/model/generated.ts'),
          },
        },
      },
    });

    expect(result).toEqual({});
    const carsContent = await readFile(
      join(tmpDir, 'src/api/cars.events.controller.ts'),
      'utf-8',
    );
    expect(carsContent).toContain('export interface CarsEventsContract');
    expect(carsContent).toContain('export function AsCarsEventsController()');
    expect(carsContent).toContain('Handles car events for processing.');
    expect(carsContent).toMatch(
      /handleCarForProcessing\(\s*event: CarEvent,\s*\.\.\.rest: any\[\]\s*\): Promise<void>;/,
    );
    expect(carsContent).toMatch(
      /handleCarDeletion\(\s*event: DeleteCarDto,\s*\.\.\.rest: any\[\]\s*\): Promise<void>;/,
    );
    expect(carsContent).toContain(`from "../model/generated.js"`);
    expect(carsContent).toMatch(/_NestjsCommonController\("cars"\)/);
    expect(carsContent).toMatch(
      /MyUseEventHandler\("task"\)\(\s*constructor\.prototype,\s*"handleCarDeletion"/,
    );
    expect(carsContent).not.toMatch(/MyUseEventHandler\("event"\)/);
    expect(carsContent).toMatch(
      /_CausaRuntimeEventBody\(\)\(\s*constructor\.prototype,\s*"handleCarForProcessing",\s*0,?\s*\)/,
    );
    const jobsContent = await readFile(
      join(tmpDir, 'src/api/background-jobs.events.controller.ts'),
      'utf-8',
    );
    expect(jobsContent).toContain(
      'export interface BackgroundJobsEventsContract',
    );
    expect(jobsContent).toMatch(
      /staleCarCleanup\(\s*event: object,\s*\.\.\.rest: any\[\]\s*\): Promise<void>;/,
    );
    expect(jobsContent).toMatch(/_NestjsCommonController\("background-jobs"\)/);
    expect(jobsContent).toMatch(/MyUseEventHandler\("cron"\)/);
    expect(decoratorsMock).toHaveBeenCalledTimes(3);
    expect(decoratorsMock).toHaveBeenCalledWith(context, {
      generator: TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR,
      configuration: { output: 'src/api/' },
      name: 'handleCarForProcessing',
      trigger: triggers.handleCarForProcessing,
    });
  });
});
