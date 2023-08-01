# 🔖 Changelog

## Unreleased

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
