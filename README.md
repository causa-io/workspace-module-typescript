# `@causa/workspace-typescript` module

This repository contains the source code for the `@causa/workspace-typescript` Causa module. It provides Causa features and implementations of `cs` commands for projects written in TypeScript. For more information about the Causa CLI cs, checkout [its repository](https://github.com/causa-io/cli).

# Installation

Add `@causa/workspace-typescript` to your Causa configuration in `causa.modules`.

# Configuration

For all the configuration in your Causa files related to TypeScript (but also JavaScript) look at [the schema for the `TypeScriptConfiguration`](./src/configurations/typescript.ts).

# Supported project types and commands

Projects supported by this module must have `typescript` (or in some cases `javascript` is enough) as their `project.language`. The following Causa `project.type`s are supported:

- `package`: Builds TypeScript packages using `npm run build`, and publishes both JavaScript and TypeScript packages using `npm publish`.
- `serverlessFunctions`: The TypeScript package is built using `npm run build` and archived as a ZIP file. Publishing is not implemented and depends on the `serverlessFunctions.platform`.
- `serviceContainer`: Builds a Docker image for the service using [distroless](https://github.com/GoogleContainerTools/distroless). Publishing is implemented in the [core module](https://github.com/causa-io/workspace-module-core).

TypeScript event interfaces generation through `cs events generateCode` is supported for JSON events (defined using JSONSchema).
