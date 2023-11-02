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
- `cs dependencies check`: Uses `npm audit` to check dependencies for vulnerabilities. See the `javascript.dependencies.check` configuration for more options.
- `cs dependencies update`: Uses [npm-check-updates](https://github.com/raineorshine/npm-check-updates) to update the `package.json` file, then run `npm update`.
- `cs security check`: Uses [njsscan](https://github.com/ajinabraham/njsscan) to scan for common insecure code patterns.

TypeScript event interfaces generation through `cs events generateCode` is supported for JSON events (defined using JSONSchema).

### OpenAPI specification generation

OpenAPI specification generation is supported for `serviceContainer` projects using the [Causa runtime](https://github.com/causa-io/runtime-typescript) (and [NestJS](https://nestjs.com/)). After configuring the project, simply run `cs openapi genSpec`.

Generation works by extracting the OpenAPI specification while the application is running. For this, a script is injected into a Docker container for the service running locally. If the service relies on emulators or other resources, make sure they are running before generating the OpenAPI specification. If a `.env` file is present at the project's root, it will be used to configure the container's environment.

For the generation to occur, the Causa configuration must contain where the NestJS application module can be found. For example:

```yaml
javascript:
  openApi:
    # If this is not set, the generation will fail.
    applicationModule:
      # The absolute path within the Docker container.
      # By default the working directory is `/app`, and the compiled TypeScript code is copied to `/app/dist`.
      sourceFile: /app/dist/app.module.js
      # The name of the class representing the application module.
      name: AppModule
```

### Code generation for events

Code generation using `cs events generateCode` is supported for JSONSchema definitions. By default, the generated code will be written in the project to `src/model.ts`. This can be configured, along with other options, using the [TypeScript configuration](./src/configurations/typescript.ts).

In JSONSchema definitions, a custom `causa` attribute can be added to object types and their properties. This attribute can customize the generated code for the object or property:

- `tsExcludedDecorators`: Provides a list of decorators that should not be added to the class or property by decorator renderers (see below). The exclusion list at the object level in inherited by all properties.
- `tsDecorators`: A list of decorators that should be added to the class or property.
- `tsType`: Properties only. Forces the type of the property to the provided TypeScript code.
- `tsDefault`: Properties only. Uses the provided TypeScript code as the default value for the property.

For example:

```yaml
title: MyClass
type: object
causa:
  tsDecorators:
    - source: @ClassDecorator()
      imports:
        my-module: [ClassDecorator]
properties:
  myBigInt:
    type: integer
    causa:
      tsType: bigint
      tsDefault: 123n
  myString:
    type: string
    causa:
      tsExcludedDecorators: [IsString]
required:
  - myBigInt
```

By default, several decorator renderers are enabled. Those renderers automatically add decorators to classes and properties:

- `causaValidator`: Adds the `@IsNullable` and `@AllowMissing` decorators from the `@causa/runtime` package.
- `classValidator`: Adds `class-validator` and `class-transformer` decorators based on the property type.
- `openapi`: Adds `@ApiProperty` decorators from the `@nestjs/swagger` package. This is only enabled for objects with the `causa.tsOpenApi` attribute set to `true` in their JSONSchema definition.
