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
x-causaResourceName: Post
info:
  title: Post API
  description: The API to manage posts.
  version: 0.1.0
paths:
  /posts:
    get:
      operationId: postList
      summary: Lists all posts.
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
                $ref: ../entities/post-list.yaml
  /posts/{id}:
    get:
      operationId: postGet
      summary: Gets a post by ID.
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
                $ref: ../entities/post.yaml
    patch:
      operationId: postUpdate
      summary: Updates a post.
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
                $ref: ../entities/post.yaml
    delete:
      operationId: postDelete
      summary: Deletes a post.
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
  const baseArguments: ImplementableFunctionArguments<ModelRunCodeGenerator> = {
    generator: TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR,
    configuration: {},
    previousGeneratorsOutput: {
      [TYPESCRIPT_JSON_SCHEMA_MODEL_CLASS_GENERATOR]: {
        '/project/entities/post.yaml': {
          name: 'Post',
          file: '/project/src/model/generated.ts',
        },
        '/project/entities/post-list.yaml': {
          name: 'PostList',
          file: '/project/src/model/generated.ts',
        },
      },
    },
  };

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    await mkdir(join(tmpDir, 'api'), { recursive: true });
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

  it('should return empty object when no OpenAPI files are found', async () => {
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
        files: [],
      }),
    );

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'src/api/', globs: ['api/*.api.yaml'] },
    });

    expect(result).toEqual({});
  });

  it('should generate model.ts and controller files from OpenAPI spec', async () => {
    const specFile = join(tmpDir, 'api', 'post.api.yaml');
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

    // Check that schemas were recorded (key is operationId/location)
    expect(Object.keys(result)).toContain('postList/query');
    expect(Object.keys(result)).toContain('postGet/path');
    expect(Object.keys(result)).toContain('postUpdate/path');
    expect(Object.keys(result)).toContain('postUpdate/query');
    expect(Object.keys(result)).toContain('postDelete/path');

    // Check model.ts was generated
    const modelFile = join(tmpDir, 'src/api/model.ts');
    const modelContent = await readFile(modelFile, 'utf-8');
    expect(modelContent).toContain('export class PostListQueryParams');
    expect(modelContent).toContain('export class PostGetPathParams');
    expect(modelContent).toContain('export class PostUpdatePathParams');
    expect(modelContent).toContain('export class PostUpdateQueryParams');
    expect(modelContent).toContain('export class PostDeletePathParams');

    // Check class-validator decorators
    expect(modelContent).toContain('@IsUUID(');
    expect(modelContent).toContain('@IsInt()');

    // Check controller file was generated
    const controllerFile = join(tmpDir, 'src/api/post.api.controller.ts');
    const controllerContent = await readFile(controllerFile, 'utf-8');

    // Check interface
    expect(controllerContent).toContain('export interface PostApiContract');
    expect(controllerContent).toContain('list(');
    expect(controllerContent).toContain('get(');
    expect(controllerContent).toContain('update(');
    expect(controllerContent).toContain('delete(');

    // Check decorator factory
    expect(controllerContent).toContain(
      'export function AsPostApiController()',
    );
    expect(controllerContent).toContain('Controller("posts")');
    expect(controllerContent).toContain('Get("")'); // for /posts
    expect(controllerContent).toContain('Get(":id")');
    expect(controllerContent).toContain('Patch(":id")');
    expect(controllerContent).toContain('Delete(":id")');

    // Check HttpCode decorators
    expect(controllerContent).toContain('HttpCode(HttpStatus.OK)');
    expect(controllerContent).toContain('HttpCode(HttpStatus.NO_CONTENT)');

    // Check parameter decorators
    expect(controllerContent).toContain('Param()');
    expect(controllerContent).toContain('Query()');
  });

  it('should handle OpenAPI spec without parameters', async () => {
    const specWithoutParams = `
openapi: 3.1.0
x-causaResourceName: Health
info:
  title: Health API
  version: 0.1.0
paths:
  /health:
    get:
      operationId: healthCheck
      summary: Health check endpoint.
      responses:
        "200":
          description: Healthy
`;
    const specFile = join(tmpDir, 'api', 'health.api.yaml');
    await writeFile(specFile, specWithoutParams);

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

    const result = await context.call(ModelRunCodeGenerator, {
      ...baseArguments,
      configuration: { output: 'src/api/', globs: ['api/*.api.yaml'] },
    });

    // No parameter classes should be generated
    expect(Object.keys(result)).toHaveLength(0);

    // Controller should still be generated
    const controllerFile = join(tmpDir, 'src/api/health.api.controller.ts');
    const controllerContent = await readFile(controllerFile, 'utf-8');
    expect(controllerContent).toContain('export interface HealthApiContract');
    expect(controllerContent).toContain('check(');
    expect(controllerContent).toContain('...rest: any[]');
  });
});
