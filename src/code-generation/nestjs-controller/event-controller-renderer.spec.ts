import { renderEventControllerFile } from './event-controller-renderer.js';
import type { EventController } from './types.js';

describe('renderEventControllerFile', () => {
  it('should render an event controller file', () => {
    const controller: EventController = {
      name: 'Cars',
      basePath: 'cars',
      methods: [
        {
          name: 'handleCarForProcessing',
          subPath: 'handleCarForProcessing',
          description: 'Handles car events for processing.',
          eventSchema: {
            name: 'CarEvent',
            file: '/project/service/src/model/generated.ts',
          },
          decorators: [
            {
              source: '@MyUseEventHandler(MY_HANDLER_ID)',
              imports: { 'my-module': ['MyUseEventHandler', 'MY_HANDLER_ID'] },
            },
          ],
        },
        {
          name: 'staleCarCleanup',
          subPath: 'staleCarCleanup',
          eventSchema: undefined,
          decorators: [],
        },
      ],
    };

    const result = renderEventControllerFile(
      controller,
      '/project/service/src/api/cars.events.controller.ts',
    );

    // Contract interface.
    expect(result).toMatch(/export interface CarsEventsContract/);
    expect(result).toMatch(/Handles car events for processing\./);
    expect(result).toMatch(
      /handleCarForProcessing\(\s*event: CarEvent,\s*\.\.\.rest: any\[\]\s*\): Promise<void>;/,
    );
    expect(result).toMatch(/Handles the 'staleCarCleanup' trigger\./);
    expect(result).toMatch(
      /staleCarCleanup\(\s*event: object,\s*\.\.\.rest: any\[\]\s*\): Promise<void>;/,
    );

    // Decorator factory.
    expect(result).toMatch(/export function AsCarsEventsController\(\)/);
    expect(result).toMatch(/_NestjsCommonController\('cars'\)\(constructor\)/);
    expect(result).toMatch(
      /_NestjsCommonPost\('handleCarForProcessing'\)\([^)]+, 'handleCarForProcessing'/,
    );
    expect(result).toMatch(
      /_NestjsCommonHttpCode\(_NestjsCommonHttpStatus\.OK\)\([^)]+, 'handleCarForProcessing'/,
    );
    expect(result).toMatch(
      /MyUseEventHandler\(MY_HANDLER_ID\)\([^)]+, 'handleCarForProcessing'/,
    );
    expect(result).toMatch(
      /_CausaRuntimeEventBody\(\)\(constructor\.prototype, 'handleCarForProcessing', 0\)/,
    );
    expect(result).toMatch(
      /_NestjsCommonPost\('staleCarCleanup'\)\([^)]+, 'staleCarCleanup'/,
    );
    expect(result).toMatch(
      /_CausaRuntimeEventBody\(\)\(constructor\.prototype, 'staleCarCleanup', 0\)/,
    );

    // `design:paramtypes` metadata for the typed handler, guarded by `hasOwnMetadata`.
    expect(result).toMatch(
      /Reflect\.defineMetadata\(\s*['"]design:paramtypes['"],\s*\[CarEvent\],\s*constructor\.prototype,\s*'handleCarForProcessing',?\s*\)/,
    );
    // The untyped handler falls back to `Object`, so `EventBody` can index into the metadata without throwing.
    expect(result).toMatch(
      /Reflect\.defineMetadata\(\s*['"]design:paramtypes['"],\s*\[Object\],\s*constructor\.prototype,\s*'staleCarCleanup',?\s*\)/,
    );

    // Imports. The event class is imported as a value (not type-only), so it can be referenced at runtime.
    expect(result).toMatch(
      /import \{ CarEvent \} from '\.\.\/model\/generated\.js';/,
    );
    expect(result).toMatch(
      /import \{[^}]*EventBody as _CausaRuntimeEventBody[^}]*\} from '@causa\/runtime\/nestjs';/,
    );
    expect(result).toMatch(
      /import \{[^}]*MY_HANDLER_ID[^}]*MyUseEventHandler[^}]*\} from 'my-module';/,
    );
  });
});
