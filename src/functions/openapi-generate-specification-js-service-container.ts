import { WorkspaceContext } from '@causa/workspace';
import {
  DockerService,
  OpenApiGenerateSpecification,
  ProjectBuildArtefact,
} from '@causa/workspace-core';
import { stat, writeFile } from 'fs/promises';
import { dump } from 'js-yaml';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as uuid from 'uuid';

/**
 * The JavaScript file that will be used to generate the OpenAPI specification.
 */
const GENERATION_SCRIPT_FILE = fileURLToPath(
  new URL('../assets/generate-openapi.js', import.meta.url),
);

/**
 * The default output file for the OpenAPI specification.
 */
const DEFAULT_OUTPUT = 'openapi.yaml';

/**
 * Implements {@link OpenApiGenerateSpecification} for JavaScript and TypeScript projects of type `serviceContainer`.
 * This works by building the Docker image for the service, and running a script in the container that generates the
 * OpenAPI specification, using the NestJS application module.
 * Generation is ignored if the `javascript.openApi.applicationModule` configuration is not set.
 */
export class OpenApiGenerateSpecificationForJavaScriptServiceContainer extends OpenApiGenerateSpecification {
  async _call(context: WorkspaceContext): Promise<string> {
    const dockerTag = await context.call(ProjectBuildArtefact, {});

    const { sourceFile, name: moduleName } = context
      .asConfiguration()
      .getOrThrow('javascript.openApi.applicationModule');

    // The generation script is placed in the Docker container, in the same directory as the application module.
    // This ensures the script can import the application module, but also NestJS and the Causa runtime.
    const dockerModuleDirectory = dirname(sourceFile);
    const dockerScriptPath = join(dockerModuleDirectory, `${uuid.v4()}.js`);
    const configuration = {
      module: {
        sourceFile: `./${basename(sourceFile)}`,
        name: moduleName,
      },
    };

    const envFile = join(context.getProjectPathOrThrow(), '.env');
    const envFileExists = !!(await stat(envFile).catch(() => false));

    const result = await context.service(DockerService).run(dockerTag, {
      rm: true,
      network: 'host',
      mounts: [
        {
          source: GENERATION_SCRIPT_FILE,
          destination: dockerScriptPath,
          type: 'bind',
          readonly: true,
        },
      ],
      capture: { stdout: true },
      logging: 'debug',
      envFile: envFileExists ? envFile : undefined,
      commandAndArgs: [dockerScriptPath, JSON.stringify(configuration)],
    });

    const openApiSpec = JSON.parse(result.stdout ?? '');
    const openApiSpecYaml = dump(openApiSpec);

    if (this.returnSpecification) {
      return openApiSpecYaml;
    }

    const output = this.output ?? DEFAULT_OUTPUT;
    await writeFile(output, openApiSpecYaml);
    return output;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      ['javascript', 'typescript'].includes(
        context.get('project.language') ?? '',
      ) &&
      context.get('project.type') === 'serviceContainer' &&
      !!context.get('javascript.openApi.applicationModule')
    );
  }
}
