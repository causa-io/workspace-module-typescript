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
  type WorkspaceFunctionCallMock,
  createContext,
  registerMockFunction,
} from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { OpenApiGenerateSpecificationForJavaScriptServiceContainer } from './generate-specification-js-service-container.js';

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

  function mockDockerRun(
    error?: Error,
  ): jest.SpiedFunction<typeof dockerService.run> {
    return jest
      .spyOn(dockerService, 'run')
      .mockImplementationOnce(async (_, options) => {
        const commandAndArgs = options?.commandAndArgs?.at(1) ?? '{}';
        const { outputFile } = JSON.parse(commandAndArgs);
        const localOutputFile = options?.mounts?.find(
          (m) => m.destination === outputFile,
        )?.source;
        if (!localOutputFile) {
          throw new Error('Missing output file mount.');
        }

        // The file should be created before being mounted.
        await stat(localOutputFile);

        await writeFile(localOutputFile, JSON.stringify({ openapi: '3.1.0' }));

        if (error) {
          throw error;
        }

        return { stdout: '', code: 0 };
      });
  }

  function expectDockerRunCall(
    runMock: jest.SpiedFunction<typeof dockerService.run>,
    options: Parameters<typeof dockerService.run>[1] = {},
  ) {
    expect(dockerService.run).toHaveBeenCalledOnce();

    const actualScriptDestination =
      runMock.mock.calls[0][1]?.mounts?.at(0)?.destination;
    expect(actualScriptDestination).toMatch(/\/app\/dist\/.+\.js/);

    expect(dockerService.run).toHaveBeenCalledWith('🐳🔖', {
      rm: true,
      network: 'host',
      mounts: expect.toIncludeSameMembers([
        {
          source: fileURLToPath(
            new URL('../../assets/generate-openapi.js', import.meta.url),
          ),
          destination: actualScriptDestination,
          type: 'bind',
          readonly: true,
        },
        {
          source: expect.not.toBeEmpty(),
          destination: '/openapi.json',
          type: 'bind',
        },
      ]),
      capture: { stdout: true },
      logging: 'debug',
      envFile: undefined,
      commandAndArgs: [
        actualScriptDestination,
        JSON.stringify({
          module: { sourceFile: './app.module.ts', name: 'AppModule' },
          outputFile: '/openapi.json',
        }),
      ],
      ...options,
    });
  }

  async function expectLocalOutputFileDeleted(
    runMock: jest.SpiedFunction<typeof dockerService.run>,
  ) {
    const runCallArgs = runMock.mock.calls[0][1];
    const actualLocalFilePath = runCallArgs?.mounts?.at(1)?.source;
    expect(actualLocalFilePath).toStartWith(tmpdir());
    await expect(stat(actualLocalFilePath as string)).rejects.toThrow();
  }

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
    const runMock = mockDockerRun();

    const actualResult = await context.call(OpenApiGenerateSpecification, {
      returnSpecification: true,
    });

    expect(actualResult).toEqual('openapi: 3.1.0\n');
    expect(buildMock).toHaveBeenCalledWith(context, {});
    expectDockerRunCall(runMock);
    await expectLocalOutputFileDeleted(runMock);
  });

  it('should set the env file when running the container', async () => {
    const envFile = join(tmpDir, '.env');
    await writeFile(envFile, '🔑=🔐');
    const runMock = mockDockerRun();

    const actualResult = await context.call(OpenApiGenerateSpecification, {
      returnSpecification: true,
    });

    expect(actualResult).toEqual('openapi: 3.1.0\n');
    expect(buildMock).toHaveBeenCalledWith(context, {});
    expectDockerRunCall(runMock, { envFile });
    await expectLocalOutputFileDeleted(runMock);
  });

  it('should write the OpenAPI specification to the specified file', async () => {
    const outputFile = join(tmpDir, 'test.yaml');
    const runMock = mockDockerRun();

    const actualResult = await context.call(OpenApiGenerateSpecification, {
      output: outputFile,
    });

    expect(actualResult).toEqual(outputFile);
    expect(buildMock).toHaveBeenCalledWith(context, {});
    expectDockerRunCall(runMock);
    const actualFile = await readFile(outputFile);
    expect(actualFile.toString()).toEqual('openapi: 3.1.0\n');
    await expectLocalOutputFileDeleted(runMock);
  });

  it('should remove the temporary local file if the Docker run fails', async () => {
    const runMock = mockDockerRun(new Error('🔥'));

    const actualPromise = context.call(OpenApiGenerateSpecification, {
      returnSpecification: true,
    });

    await expect(actualPromise).rejects.toThrow('🔥');
    expect(buildMock).toHaveBeenCalledWith(context, {});
    expectDockerRunCall(runMock);
    await expectLocalOutputFileDeleted(runMock);
  });
});
