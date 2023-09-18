import { readFile } from 'fs/promises';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createApp } from '@causa/runtime/nestjs';

/**
 * Reads the package information from the `package.json` file.
 *
 * @returns {Promise<{name: string, version: string}>} The name and version of the package.
 */
async function readPackageInfo() {
  const packageStr = await readFile('package.json', 'utf8');
  const packageDefinition = JSON.parse(packageStr);
  const name = packageDefinition.name.split('/').at(-1);
  return { name, version: packageDefinition.version };
}

/**
 * Generates the OpenAPI definition for a service.
 *
 * @param {object} packageInfo - The `package.json` information used to set up the OpenAPI document.
 * @param {string} packageInfo.name - The package name.
 * @param {string} packageInfo.version - The package version.
 * @param {object} moduleInfo - Describes how the NestJS application module should be imported.
 * @param {string} moduleInfo.sourceFile - The path to the file containing the NestJS application module.
 * @param {string} moduleInfo.name - The name of the NestJS application module in the source file.
 * @param {OpenAPIObject} openApiConfig - A base OpenAPI document to merge with the generated document.
 * @returns {Promise<void>}
 */
async function generateOpenApi(packageInfo, moduleInfo, openApiConfig) {
  const sourceModule = await import(moduleInfo.sourceFile);
  const AppModule = sourceModule[moduleInfo.name];

  const app = await createApp(AppModule);

  const baseConfig = new DocumentBuilder()
    .setTitle(packageInfo.name)
    .setDescription(`The ${packageInfo.name} API definition.`)
    .setVersion(packageInfo.version)
    .build();

  const config = { ...baseConfig, ...openApiConfig };

  const document = SwaggerModule.createDocument(app, config);

  console.log(JSON.stringify(document));

  await app.close();
}

/**
 * Generates the OpenAPI definition for a service.
 *
 * This script should be run from the root of the source directory (e.g. `src` or `dist`).
 * The only argument should be a JSON object containing the information on how to import the NestJS application module
 * and optionally a base OpenAPI document to merge with the generated document. For example:
 *
 * ```json
 * {
 *   "module": {
 *     "sourceFile": "./api.module.js",
 *     "name": "ApiModule"
 *   },
 *   "baseOpenApi": {
 *     "tags": [
 *       { "name": "Example", "description": "Example tag" }
 *     ]
 *   }
 * }
 * ```
 */
async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: node generate-openapi.js <configuration>');
    process.exit(1);
  }

  const configuration = JSON.parse(process.argv[2]);
  if (
    !configuration.module ||
    !configuration.module.sourceFile ||
    !configuration.module.name
  ) {
    console.error(`The configuration must contain the 'module' information, for example:
{
  "module": {
    "sourceFile": "./api.module.js",
    "name": "ApiModule"
  }
}`);
    process.exit(1);
  }

  const packageInfo = await readPackageInfo();
  await generateOpenApi(
    packageInfo,
    configuration.module,
    configuration.baseOpenApi ?? {},
  );
}

await main();
