import { WorkspaceContext } from '@causa/workspace';
import {
  DockerService,
  OpenApiGenerateSpecification,
  ProjectBuildArtefact,
} from '@causa/workspace-core';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import {
  WorkspaceFunctionCallMock,
  createContext,
  registerMockFunction,
} from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { OpenApiGenerateSpecificationForJavaScriptServiceContainer } from './openapi-generate-specification-js-service-container.js';

describe('OpenApiGenerateSpecificationForJavaScriptServiceContainer', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let functionRegistry: FunctionRegistry<WorkspaceContext>;
  let dockerService: DockerService;
  let buildMock: WorkspaceFunctionCallMock<ProjectBuildArtefact>;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    ({ context, functionRegistry } = createContext({
      workingDirectory: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        javascript: {
          openApi: {
            applicationModule: {
              sourceFile: '/app/dist/app.module.ts',
              name: 'AppModule',
            },
          },
        },
      },
      functions: [OpenApiGenerateSpecificationForJavaScriptServiceContainer],
    }));
    buildMock = registerMockFunction(
      functionRegistry,
      ProjectBuildArtefact,
      async () => '🐳🔖',
    );
    dockerService = context.service(DockerService);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not support non-JavaScript or TypeScript projects', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'ruby',
        },
      },
      functions: [OpenApiGenerateSpecificationForJavaScriptServiceContainer],
    }));

    expect(() => context.call(OpenApiGenerateSpecification, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support projects other that service containers', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'typescript',
        },
      },
      functions: [OpenApiGenerateSpecificationForJavaScriptServiceContainer],
    }));

    expect(() => context.call(OpenApiGenerateSpecification, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support projects without the application module configured', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        javascript: { openApi: {} },
      },
      functions: [OpenApiGenerateSpecificationForJavaScriptServiceContainer],
    }));

    expect(() => context.call(OpenApiGenerateSpecification, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should return the OpenAPI specification as YAML', async () => {
    const runMock = jest.spyOn(dockerService, 'run').mockResolvedValueOnce({
      stdout: JSON.stringify({ openapi: '3.0.0' }),
      code: 0,
    });

    const actualResult = await context.call(OpenApiGenerateSpecification, {
      returnSpecification: true,
    });

    expect(actualResult).toEqual('openapi: 3.0.0\n');
    expect(buildMock).toHaveBeenCalledWith(context, {});
    expect(dockerService.run).toHaveBeenCalledOnce();
    const actualScriptDestination =
      runMock.mock.calls[0][1]?.mounts?.at(0)?.destination;
    expect(actualScriptDestination).toMatch(/\/app\/dist\/.+\.js/);
    expect(dockerService.run).toHaveBeenCalledWith('🐳🔖', {
      rm: true,
      network: 'host',
      mounts: [
        {
          source: fileURLToPath(
            new URL('../assets/generate-openapi.js', import.meta.url),
          ),
          destination: actualScriptDestination,
          type: 'bind',
          readonly: true,
        },
      ],
      capture: { stdout: true },
      logging: 'debug',
      envFile: undefined,
      commandAndArgs: [
        actualScriptDestination,
        JSON.stringify({
          module: { sourceFile: './app.module.ts', name: 'AppModule' },
        }),
      ],
    });
  });

  it('should set the env file when running the container', async () => {
    const envFile = join(tmpDir, '.env');
    await writeFile(envFile, '🔑=🔐');
    const runMock = jest.spyOn(dockerService, 'run').mockResolvedValueOnce({
      stdout: JSON.stringify({ openapi: '3.0.0' }),
      code: 0,
    });

    const actualResult = await context.call(OpenApiGenerateSpecification, {
      returnSpecification: true,
    });

    expect(actualResult).toEqual('openapi: 3.0.0\n');
    expect(buildMock).toHaveBeenCalledWith(context, {});
    expect(dockerService.run).toHaveBeenCalledOnce();
    const actualScriptDestination =
      runMock.mock.calls[0][1]?.mounts?.at(0)?.destination;
    expect(actualScriptDestination).toMatch(/\/app\/dist\/.+\.js/);
    expect(dockerService.run).toHaveBeenCalledWith('🐳🔖', {
      rm: true,
      network: 'host',
      mounts: [
        {
          source: fileURLToPath(
            new URL('../assets/generate-openapi.js', import.meta.url),
          ),
          destination: actualScriptDestination,
          type: 'bind',
          readonly: true,
        },
      ],
      capture: { stdout: true },
      logging: 'debug',
      envFile,
      commandAndArgs: [
        actualScriptDestination,
        JSON.stringify({
          module: { sourceFile: './app.module.ts', name: 'AppModule' },
        }),
      ],
    });
  });

  it('should write the OpenAPI specification to the specified file', async () => {
    const outputFile = join(tmpDir, 'test.yaml');
    const runMock = jest.spyOn(dockerService, 'run').mockResolvedValueOnce({
      stdout: JSON.stringify({ openapi: '3.0.0' }),
      code: 0,
    });

    const actualResult = await context.call(OpenApiGenerateSpecification, {
      output: outputFile,
    });

    expect(actualResult).toEqual(outputFile);
    expect(buildMock).toHaveBeenCalledWith(context, {});
    expect(dockerService.run).toHaveBeenCalledOnce();
    const actualScriptDestination =
      runMock.mock.calls[0][1]?.mounts?.at(0)?.destination;
    expect(actualScriptDestination).toMatch(/\/app\/dist\/.+\.js/);
    expect(dockerService.run).toHaveBeenCalledWith('🐳🔖', {
      rm: true,
      network: 'host',
      mounts: [
        {
          source: fileURLToPath(
            new URL('../assets/generate-openapi.js', import.meta.url),
          ),
          destination: actualScriptDestination,
          type: 'bind',
          readonly: true,
        },
      ],
      capture: { stdout: true },
      logging: 'debug',
      envFile: undefined,
      commandAndArgs: [
        actualScriptDestination,
        JSON.stringify({
          module: { sourceFile: './app.module.ts', name: 'AppModule' },
        }),
      ],
    });
    const actualFile = await readFile(outputFile);
    expect(actualFile.toString()).toEqual('openapi: 3.0.0\n');
  });
});
