# `@causa/workspace-typescript` module

This repository contains the source code for the `@causa/workspace-typescript` Causa module. It provides Causa features and implementations of `cs` commands for projects written in TypeScript. For more information about the Causa CLI `cs`, checkout [its repository](https://github.com/causa-io/cli).

## ➕ Requirements

The Causa CLI requires [Node.js](https://nodejs.org/) and npm (which comes bundled with Node.js). We recommend installing Node.js using a version manager, such as [asdf](https://asdf-vm.com/) and its [nodejs](https://github.com/asdf-vm/asdf-nodejs) plugin. If set, the `javascript.npm.version` and `javascript.node.version` configurations should match the installed versions of these tools. They will also be used during build operations for example.

[Docker](https://www.docker.com/) is also needed for running security checks, and when building `serviceContainer` projects.

## 🎉 Installation

Add `@causa/workspace-typescript` to your Causa configuration in `causa.modules`.

## 🔧 Configuration

For all the configuration in your Causa files related to TypeScript (but also JavaScript) look at [the schema for the `TypeScriptConfiguration`](./src/configurations/typescript.ts).

## ✨ Supported project types and commands

Projects supported by this module must have `typescript` (or in some cases `javascript` is enough) as their `project.language`. The following Causa `project.type`s are supported:

- `package`: Builds TypeScript packages using `npm run build`, and publishes both JavaScript and TypeScript packages using `npm publish`.
- `serverlessFunctions`: The TypeScript package is built using `npm run build` and archived as a ZIP file. Publishing is not implemented and depends on the `serverlessFunctions.platform`.
- `serviceContainer`: Builds a Docker image for the service using [distroless](https://github.com/GoogleContainerTools/distroless). Publishing is implemented in the [core module](https://github.com/causa-io/workspace-module-core).

Apart from `build` and `publish`, other project-level commands are supported:

- `cs init`: Runs `npm ci`, setting up the `node_modules` locally.
- `cs lint`: Runs `npm run lint`.
- `cs test`: Runs `npm run test`.
- `cs dependencies check`: Uses `npm audit` to check dependencies for vulnerabilities. See the `javascript.dependenciesCheck` configuration for more options.
- `cs dependencies update`: Uses [npm-check-updates](https://github.com/raineorshine/npm-check-updates) to update the `package.json` file, then run `npm update`.
- `cs security check`: Uses [njsscan](https://github.com/ajinabraham/njsscan) to scan for common insecure code patterns.

TypeScript event interfaces generation through `cs events generateCode` is supported for JSON events (defined using JSONSchema).
