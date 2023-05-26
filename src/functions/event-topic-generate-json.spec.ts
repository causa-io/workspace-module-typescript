import { WorkspaceContext } from '@causa/workspace';
import {
  EventTopicDefinition,
  EventTopicGenerateCode,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { dump } from 'js-yaml';
import { JSONSchema } from 'json-schema-to-typescript';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventTopicGenerateCodeForTypeScriptAndJsonEvents } from './event-topic-generate-json.js';

describe('EventTopicGenerateCodeForTypeScriptAndJsonEvents', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let definitions: EventTopicDefinition[];

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        events: { format: 'json' },
      },
      functions: [EventTopicGenerateCodeForTypeScriptAndJsonEvents],
    }));
    definitions = [
      {
        id: 'my-event',
        formatParts: {
          domain: 'some-domain',
          topic: 'my-event',
          version: 'v1',
        },
        schemaFilePath: join(tmpDir, 'someFile.yaml'),
      },
      {
        id: 'my-other-event',
        formatParts: {
          domain: 'some-other-domain',
          topic: 'my-other-event',
          version: 'v2',
        },
        schemaFilePath: join(tmpDir, 'someFile.json'),
      },
    ];
    await writeFile(
      definitions[0].schemaFilePath,
      dump({
        title: 'MyEvent',
        type: 'object',
        description: 'Some description',
        properties: {
          firstProperty: { type: 'string', description: 'First property' },
          secondProperty: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
            description: 'Second property',
          },
        },
        required: ['firstProperty'],
      } as JSONSchema),
    );
    await writeFile(
      definitions[1].schemaFilePath,
      JSON.stringify({
        title: 'MyOtherEvent',
        type: 'object',
        properties: {
          firstProperty: { type: 'string' },
          secondProperty: { type: 'integer' },
        },
      } as JSONSchema),
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not handle projects with unsupported languages', async () => {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'python',
        },
        events: { format: 'json' },
      },
      functions: [EventTopicGenerateCodeForTypeScriptAndJsonEvents],
    }));

    expect(() =>
      context.call(EventTopicGenerateCode, { definitions: [] }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not handle a workspace with events in a format different than JSON', async () => {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        events: { format: 'avro' },
      },
      functions: [EventTopicGenerateCodeForTypeScriptAndJsonEvents],
    }));

    expect(() =>
      context.call(EventTopicGenerateCode, { definitions: [] }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should generate code for all events', async () => {
    await context.call(EventTopicGenerateCode, { definitions });

    const actualMyEvent = (
      await readFile(join(tmpDir, 'src/events/some-domain/my-event.v1.ts'))
    ).toString();
    expect(actualMyEvent).toContain('export interface MyEvent');
    expect(actualMyEvent).toContain('firstProperty: string');
    expect(actualMyEvent).toContain('secondProperty?: string | null');
    const actualMyOtherEvent = (
      await readFile(
        join(tmpDir, 'src/events/some-other-domain/my-other-event.v2.ts'),
      )
    ).toString();
    expect(actualMyOtherEvent).toContain('export interface MyOtherEvent');
    expect(actualMyOtherEvent).toContain('firstProperty?: string');
    expect(actualMyOtherEvent).toContain('secondProperty?: number');
  });
});
