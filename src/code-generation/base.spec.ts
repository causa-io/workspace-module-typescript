import type { Schema } from '@causa/workspace-core';
import { assignSchemaNames } from './base.js';

describe('assignSchemaNames', () => {
  it('should deduplicate colliding PascalCase names and constraint aliases stably across path orderings', () => {
    // Two distinct paths whose names PascalCase to the same identifier ("Thing").
    const PATH_A = '/folder1/identical.yaml';
    const PATH_B = '/folder2/identical.yaml';
    // Object whose name collides with a constraint alias ("Foo").
    const FOO_PATH = '/foo.yaml';
    const FOO_CONSTRAINT_PATH = '/foo-constraint.yaml';
    // Triple collision after PascalCase.
    const ENUM_C1 = '/c/one.yaml#/$defs/Status';
    const ENUM_C2 = '/c/two.yaml#/$defs/Status';
    const ENUM_C3 = '/c/three.yaml#/$defs/Status';
    const schemas: Record<string, Schema> = {
      [PATH_A]: {
        kind: 'object',
        name: 'thing',
        path: PATH_A,
        extensions: {},
        databases: [],
        properties: [],
      },
      [PATH_B]: {
        kind: 'object',
        name: 'Thing',
        path: PATH_B,
        extensions: {},
        databases: [],
        properties: [],
      },
      [FOO_PATH]: {
        kind: 'object',
        name: 'Foo',
        path: FOO_PATH,
        extensions: {},
        databases: [],
        properties: [],
      },
      [FOO_CONSTRAINT_PATH]: {
        kind: 'object',
        name: 'FooConstraint',
        path: FOO_CONSTRAINT_PATH,
        extensions: { constraintFor: FOO_PATH },
        databases: [],
        properties: [],
      },
      [ENUM_C1]: {
        kind: 'enum',
        type: 'string',
        name: 'status',
        path: ENUM_C1,
        extensions: {},
        values: ['a'],
      },
      [ENUM_C2]: {
        kind: 'enum',
        type: 'string',
        name: 'Status',
        path: ENUM_C2,
        extensions: {},
        values: ['b'],
      },
      [ENUM_C3]: {
        kind: 'enum',
        type: 'string',
        name: 'STATUS',
        path: ENUM_C3,
        extensions: {},
        values: ['c'],
      },
    };

    const deduped = assignSchemaNames(schemas);

    expect(deduped[ENUM_C1].name).toBe('Status');
    expect(deduped[ENUM_C2].name).toBe('Status_3');
    expect(deduped[ENUM_C3].name).toBe('Status_2');
    expect(deduped[FOO_PATH].name).toBe('Foo_2');
    expect(deduped[FOO_CONSTRAINT_PATH].name).toBe('FooConstraint');
    expect(deduped[PATH_A].name).toBe('Thing');
    expect(deduped[PATH_B].name).toBe('Thing_2');

    // Stability: shuffling the input order yields the same result.
    const shuffled: Record<string, Schema> = {
      [PATH_B]: schemas[PATH_B],
      [ENUM_C3]: schemas[ENUM_C3],
      [FOO_CONSTRAINT_PATH]: schemas[FOO_CONSTRAINT_PATH],
      [PATH_A]: schemas[PATH_A],
      [ENUM_C2]: schemas[ENUM_C2],
      [FOO_PATH]: schemas[FOO_PATH],
      [ENUM_C1]: schemas[ENUM_C1],
    };

    const dedupedShuffled = assignSchemaNames(shuffled);

    expect(dedupedShuffled).toEqual(deduped);
  });

  it('should deduplicate against existingSchemas names', () => {
    const NEW_PATH = '/new.yaml';
    const EXISTING_PATH = '/existing.yaml';
    const schemas: Record<string, Schema> = {
      [NEW_PATH]: {
        kind: 'object',
        name: 'Shared',
        path: NEW_PATH,
        extensions: {},
        databases: [],
        properties: [],
      },
    };

    const deduped = assignSchemaNames(schemas, {
      existingSchemas: {
        [EXISTING_PATH]: { name: 'Shared', file: '/existing.ts' },
      },
    });

    expect(deduped[NEW_PATH].name).toBe('Shared_2');
  });

  it('should strip the constraint suffix before PascalCasing so custom suffixes are preserved', () => {
    // Schema named with the custom suffix verbatim; PascalCase-then-strip would mangle "_rule".
    const SUFFIX_PATH = '/foo.yaml';
    const SCHEMA_PATH = '/foo_rule.yaml';
    const schemas: Record<string, Schema> = {
      [SUFFIX_PATH]: {
        kind: 'object',
        name: 'foo',
        path: SUFFIX_PATH,
        extensions: {},
        databases: [],
        properties: [],
      },
      [SCHEMA_PATH]: {
        kind: 'object',
        name: 'foo_rule',
        path: SCHEMA_PATH,
        extensions: { constraintFor: SUFFIX_PATH },
        databases: [],
        properties: [],
      },
    };

    const deduped = assignSchemaNames(schemas, {
      constraintSuffix: '_rule',
    });

    expect(deduped[SUFFIX_PATH].name).toBe('Foo_2');
    expect(deduped[SCHEMA_PATH].name).toBe('Foo_rule');
  });
});
