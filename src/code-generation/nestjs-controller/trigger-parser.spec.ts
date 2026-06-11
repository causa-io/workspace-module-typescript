import type {
  EventTopicDefinition,
  GeneratedSchemas,
} from '@causa/workspace-core';
import { listHttpTriggers } from './trigger-parser.js';
import type { ServiceContainerTrigger } from './types.js';

describe('listHttpTriggers', () => {
  const projectPath = '/project';
  const schemas: GeneratedSchemas = {
    '/project/events/car-event.yaml': {
      name: 'CarEvent',
      file: '/project/src/model/generated.ts',
    },
    '/project/dtos/delete-car.dto.yaml': {
      name: 'DeleteCarDto',
      file: '/project/src/model/generated.ts',
    },
  };
  const topics: EventTopicDefinition[] = [
    {
      id: 'my-domain.car-event.v1',
      schemaFilePath: '/project/events/car-event.yaml',
      formatParts: {},
    },
  ];

  it('should list triggers with an HTTP endpoint, grouped by base path', () => {
    const triggers: Record<string, ServiceContainerTrigger> = {
      handleCarForProcessing: {
        type: 'event',
        topic: 'my-domain.car-event.v1',
        endpoint: { type: 'http', path: '/cars/handleCarForProcessing' },
      },
      staleCarCleanup: {
        type: 'cron',
        schedule: '0 * * * *',
        endpoint: { type: 'http', path: '/background-jobs/staleCarCleanup' },
      },
      handleCarDeletion: {
        type: 'task',
        queue: 'car-deletion',
        dto: 'dtos/delete-car.dto.yaml',
        endpoint: { type: 'http', path: '/v1/cars/handleCarDeletion' },
      },
      handleCarForFirestore: {
        type: 'event',
        topic: 'my-domain.car-event.v1',
        endpoint: { type: 'http', path: '/v1/cars/handleCarForFirestore' },
      },
      noEndpoint: { type: 'event', topic: 'my-domain.other-event.v1' },
      otherEndpointType: {
        type: 'my-platform.something',
        endpoint: { type: 'grpc', path: '/some/path' },
      },
    };

    const actual = listHttpTriggers(triggers, projectPath, schemas, topics);

    expect(actual).toEqual(
      new Map([
        [
          'cars',
          [
            {
              name: 'handleCarForProcessing',
              trigger: triggers.handleCarForProcessing,
              subPath: 'handleCarForProcessing',
              eventSchema: schemas['/project/events/car-event.yaml'],
            },
          ],
        ],
        [
          'background-jobs',
          [
            {
              name: 'staleCarCleanup',
              trigger: triggers.staleCarCleanup,
              subPath: 'staleCarCleanup',
              eventSchema: undefined,
            },
          ],
        ],
        [
          'v1/cars',
          [
            {
              name: 'handleCarDeletion',
              trigger: triggers.handleCarDeletion,
              subPath: 'handleCarDeletion',
              eventSchema: schemas['/project/dtos/delete-car.dto.yaml'],
            },
            {
              name: 'handleCarForFirestore',
              trigger: triggers.handleCarForFirestore,
              subPath: 'handleCarForFirestore',
              eventSchema: schemas['/project/events/car-event.yaml'],
            },
          ],
        ],
      ]),
    );
  });

  it('should throw when an HTTP endpoint has no path', () => {
    const triggers: Record<string, ServiceContainerTrigger> = {
      myTrigger: {
        type: 'cron',
        schedule: '0 * * * *',
        endpoint: { type: 'http' },
      } as any,
    };

    expect(() =>
      listHttpTriggers(triggers, projectPath, schemas, topics),
    ).toThrow(`Trigger 'myTrigger' defines an HTTP endpoint without a 'path'.`);
  });

  it('should throw when an endpoint path has fewer than two segments', () => {
    const triggers: Record<string, ServiceContainerTrigger> = {
      myTrigger: {
        type: 'event',
        topic: 'my-domain.car-event.v1',
        endpoint: { type: 'http', path: '/handleCarForProcessing' },
      },
    };

    expect(() =>
      listHttpTriggers(triggers, projectPath, schemas, topics),
    ).toThrow('must have at least two segments');
  });

  it('should throw when the definition for an event trigger topic cannot be found', () => {
    const triggers: Record<string, ServiceContainerTrigger> = {
      myTrigger: {
        type: 'event',
        topic: 'my-domain.unknown-event.v1',
        endpoint: { type: 'http', path: '/cars/handleCarForProcessing' },
      },
    };

    expect(() =>
      listHttpTriggers(triggers, projectPath, schemas, topics),
    ).toThrow(
      `The definition for event topic 'my-domain.unknown-event.v1' referenced by trigger 'myTrigger' could not be found.`,
    );
  });

  it('should throw when no class was generated for an event trigger topic', () => {
    const triggers: Record<string, ServiceContainerTrigger> = {
      myTrigger: {
        type: 'event',
        topic: 'my-domain.car-event.v1',
        endpoint: { type: 'http', path: '/cars/handleCarForProcessing' },
      },
    };

    expect(() => listHttpTriggers(triggers, projectPath, {}, topics)).toThrow(
      `No class was generated for the schema of event topic 'my-domain.car-event.v1' referenced by trigger 'myTrigger'.`,
    );
  });

  it('should throw when no class was generated for a trigger DTO', () => {
    const triggers: Record<string, ServiceContainerTrigger> = {
      myTrigger: {
        type: 'task',
        queue: 'car-deletion',
        dto: 'dtos/unknown.dto.yaml',
        endpoint: { type: 'http', path: '/cars/handleCarDeletion' },
      },
    };

    expect(() =>
      listHttpTriggers(triggers, projectPath, schemas, topics),
    ).toThrow(
      `No class was generated for the DTO schema 'dtos/unknown.dto.yaml' referenced by trigger 'myTrigger'.`,
    );
  });
});
