# 🔖 Changelog

## Unreleased

Breaking changes:

- Upgrade the minimum Node.js version to `20`.

## v0.10.2 (2025-05-12)

Chores:

- Adapt to `quicktype` breaking changes.

## v0.10.1 (2025-03-17)

Chores:

- Upgrade dependencies.

Fixes:

- Set `selfRequired` to the correct boolean value in the `ApiProperty` decorator.

## v0.10.0 (2024-11-18)

Breaking changes:

- Use `@nestjs/swagger` `selfRequired` property when generating OpenAPI decorators. This property is only available with `@nestjs/swagger` version 8.

## v0.9.1 (2024-10-09)

Chores:

- Upgrade dependencies.

## v0.9.0 (2024-05-21)

Breaking change:

- Drop support for Node.js 16.

Chore:

- Upgrade dependencies.

Fixes:

- Always set the `required` attribute in the generated `ApiProperty` decorator.
- Use a file instead of the standard output to emit the OpenAPI specification. This prevents errors when the service produces logs.

## v0.8.2 (2024-02-21)

Fixes:

- Disable pino logs when generating the OpenAPI specification. This prevents (non-error) logs from interfering with the outputted OpenAPI document.

## v0.8.1 (2024-01-23)

Fixes:

- Do not set a class type in the `@ApiProperty` decorator when NestJS can infer it.
- Explicitly set the type of string enums in generated ApiProperty decorators.

## v0.8.0 (2024-01-23)

Breaking changes:

- The `@ApiProperty` decorators from code generation now produce OpenAPI 3.1-compatible specifications.
- OpenAPI generation for service containers now produce a specification marked with version `3.1.0`.

## v0.7.2 (2023-11-20)

Fixes:

- Set the UUID version of the generated `@IsUUID` decorator to `undefined`, as it cannot be known from the schema. This ensures the decorator is valid and can be used for arrays as well.

## v0.7.1 (2023-11-07)

Fixes:

- Ensure the TypeScript decorator renderers are ordered, such that decorators are always listed in the same order in generated files.

## v0.7.0 (2023-11-03)

Features:

- Adapt to the core module breaking changes by implementing `EventTopicMakeCodeGenerationTargetLanguage` rather than `EventTopicGenerateCode`. The new implementation uses [quicktype](https://github.com/glideapps/quicktype) to generate classes. It can be extended by implementing `TypeScriptGetDecoratorRenderer` to add decorators to classes and their properties.
- Implement the `causaValidator`, `classValidator`, and `openapi` decorator renderers.

## v0.6.0 (2023-10-03)

Breaking changes:

- The `typescript.serviceContainerDockerfile` configuration has been removed and replaced by the `serviceContainer.buildFile` parameter.
- The default `Dockerfile` for TypeScript service containers now supports an `NPM_TOKEN` secret (rather than a build argument) that will be passed as an environment variable during `npm ci` calls.

Features:

- The default `Dockerfile` for TypeScript service containers now reuses the npm cache across calls and builds.

## v0.5.1 (2023-10-02)

Fixes:

- Ensure `cs dependencies update` is run with the `javascript.npm.environment` configuration added as environment variables. This brings consistency to how npm-related commands are run and supports more configuration options for npm authentication.

## v0.5.0 (2023-09-18)

Features:

- Implement OpenAPI specification generation for `serviceContainer` projects.

## v0.4.0 (2023-08-01)

Breaking changes:

- Dependencies check configuration is moved from `javascript.dependenciesCheck` to `javascript.dependencies.check`.

Features:

- Implement `ProjectDependenciesUpdate` for JavaScript and TypeScript.

Fixes:

- Allow `.npmrc` and `nest-cli.json` to be missing when building a Docker image.

## v0.3.0 (2023-06-09)

Features:

- Implement `ProjectInit`, `ProjectTest`, `ProjectLint`, `ProjectDependenciesCheck`, and `ProjectSecurityCheck` for JavaScript and TypeScript projects.
- Implement the `ci` command for the `NpmService`.

## v0.2.0 (2023-06-02)

Features:

- Implement `ProjectBuildArtefact` for TypeScript serverless functions.

Fixes:

- Ensure the distroless image matches the major Node version

## v0.1.0 (2023-05-26)

Features:

- Implement `ProjectReadVersion` for JavaScript and TypeScript languages.
- Implement `EventTopicGenerateCode` for TypeScript projects and JSON events.
- Implement `ProjectGetArtefactDestination` for npm packages.
- Implement the `NpmService`.
- Implement `ProjectBuildArtefact` for TypeScript packages.
- Implement `ProjectPushArtefact` for npm packages
- Implement `ProjectBuildArtefact` for TypeScript service containers
