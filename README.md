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

### Code generation

Code generation using `cs model generateCode` is supported. Several generators are provided by this package. In JSONSchema definitions, a custom `causa` attribute can be added to object types and their properties. This attribute can customize the generated code. See below for customization of each generator.

#### Common generator configuration

All generators' inputs and outputs are configured in the same way, as presented in this section. Then, each generator may have its own customization configuration.

```yaml
model:
  codeGenerators:
    - generator: <Generator name>

      # Whether event schemas should automatically be added to the list of schemas to generate.
      # This uses triggers (inputs) and event topic outputs from the project definition to find relevant topics.
      # This is optional and defaults to `false`.
      includeEvents: true

      # Globs that will match schema files to generate, provided in addition to or in replacement of `includeEvents`. Those are relative to the project directory.
      # This is optional and defaults to an empty array.
      globs:
        - ../entities/*.yaml
        - ../firestore/*.yaml

      # The generated file, relative to the project directory.
      # This must be provided.
      output: src/generated.ts

      # The suffix that must be present on all schema names that are constraints on other schemas
      # (using the `constraintFor` Causa attribute).
      # This is optional and defaults to `Constraint`.
      constraintSuffix: Constraint
```

#### `typescriptModelClass` generator

This is the main code generator, which produces a `class` for each object schema, and an `enum` for each enum schema.

Many decorators are added to the classes and properties, and other Causa workspace packages may plug themselves to this generator to add other decorators. The following decorators are generated automatically:

- `class-validator` and `class-transformer` decorators based on the property type.
- The `@IsNullable` and `@AllowMissing` decorators from the `@causa/runtime` package.
- `@ApiProperty` decorators from the `@nestjs/swagger` package. This is only enabled for objects with the `causa.tsOpenApi` attribute set to `true` in their JSONSchema definition.

The behavior of this generator can be customized for each object and properties by using the `causa` attribute (e.g. in JSONSchema definitions):

- `tsExcludedDecorators`: Provides a list of decorators that should not be added to the class or property by decorator renderers (see below). The exclusion list at the object level is inherited by all properties.
- `tsDecorators`: A list of custom decorators that should be added to the class or property.
- `tsType`: Properties only. Forces the type of the property to the provided TypeScript code.
- `tsDefault`: Properties only. Uses the provided TypeScript code as the default value for the property.

For example:

```yaml
title: MyClass
type: object
causa:
  tsDecorators:
    - source: '@ClassDecorator()'
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

#### `typescriptTestObject` generator

This generator produces a function for each object schema that creates an instance of the corresponding class from a partial object (or from nothing at all). Default values are inferred from the properties' types, and can be overridden using the `testObjectDefaultValue` Causa attribute on the property.

For constraints (using the `constraintFor` Causa attribute), the constraint suffix is removed from the function name, and a base object that satisfies the constraint is created.

Example generated code:

```typescript
export function makeMyEntity(data: Partial<MyEntity> = {}): MyEntity {
  return new MyEntity({
    createdAt: new Date(),
    deletedAt: null,
    id: randomUUID(),
    result: null,
    updatedAt: new Date(),
    ...data,
  });
}
```

#### `typescriptTestExpectation` generator

This generator produces several "expectation functions" that can be used in tests, to assert the state of entities, or that events have been published. Here is an example of each type of function:

```typescript
// Only generated if the schema matches the `entitiesGlobs`.
export async function expectEntity(
  runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,
  expected: Partial<Entity>,
): Promise<Entity> {
  const actual = await runner.run((t) => t.get(Entity, expected));
  expect(actual).toEqual({
    property: expect.any(String),
    ...expected,
  });
  return actual as Entity;
}

// Only generated if the schema matches the `entitiesGlobs`.
export async function expectEntityNotToExist(
  runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,
  key: Partial<Entity>,
): Promise<void> {
  const actual = await runner.run((t) => t.get(Entity, key));
  expect(actual).toEqual(null);
}

// Only generated if the schema is an event topic (based on the event configuration).
export async function expectEvent(
  eventFixture: EventFixture,
  expected: Partial<Event> = {},
): Promise<void> {
  await eventFixture.expectEvent('topic-id', {
    data: expect.any(Entity),
    id: expect.any(String),
    name: expect.any(String),
    producedAt: expect.any(Date),
    ...expected,
  });
}

// Only generated if the schema is an event topic (based on the event configuration).
export async function expectNoEvent(eventFixture: EventFixture): Promise<void> {
  await eventFixture.expectNoEvent('topic-id');
}

// Only generated if the schema is an event topic and it has the `entityEvent: true` Causa attribute.
export async function expectEntityNotMutated(
  fixture: AppFixture,
  entity: Entity,
  tests: { expectNoEvent?: boolean } = {},
): Promise<void> {
  await fixture.get(VersionedEntityFixture).expectNoMutation(entity, {
    expectNoEventInTopic: tests.expectNoEvent ? 'topic-id' : undefined,
  });
}

// Only generated if the schema has the `entityMutationFrom` Causa attribute.
// It should be a constraint for a base event schema.
export async function expectMutationEvent(
  fixture: AppFixture,
  before: Partial<Entity>,
  updates: Partial<EntityWithConstraint> = {},
  tests: {
    matchesHttpResponse?: object;
    eventAttributes?: EventAttributes;
  } = {},
): Promise<Entity> {
  return await fixture.get(VersionedEntityFixture).expectMutated(
    { type: Entity, entity: before },
    {
      expectedEntity: {
        someUnchangedProperty: expect.any(String),
        ...before,
        somePropertyExpectedToChange: expect.any(String),
        ...updates,
      },
      expectedEvent: {
        topic: 'topic-id',
        name: expect.toBeOneOf(['eventName']),
        attributes: tests.eventAttributes,
      },
      matchesHttpResponse: tests.matchesHttpResponse,
    },
  );
}
```

As mentioned in the example code, the generator can take an additional configuration parameter:

```yaml
model:
  codeGenerators:
    - generator: typescriptTestExpectation

      # ...Common configuration...

      # Globs that should match schema files for which entity expectations should be produced.
      entitiesGlobs:
        - ../entities/*.yaml
        - ../firestore/*.yaml
```
