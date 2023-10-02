# 🔖 Changelog

## Unreleased

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
