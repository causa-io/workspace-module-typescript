import { SourcelikeArray } from 'quicktype-core/dist/Source.js';
import { typeScriptSourceForObject } from './utilities.js';

describe('utilities', () => {
  describe('typeScriptSourceForObject', () => {
    it('should return an empty string for an empty object', () => {
      const obj = {};

      const actualSource = typeScriptSourceForObject(obj);

      expect(actualSource).toEqual('');
    });

    it('should encode regular types as JSON', () => {
      const obj = { str: '🍦', number: 123, array: ['🪴'] };

      const actualSource = typeScriptSourceForObject(obj);

      expect((actualSource as SourcelikeArray).join('')).toEqual(
        '{ str: "🍦", number: 123, array: ["🪴"], }',
      );
    });

    it('should allow custom encoding and omitting properties', () => {
      const obj = {
        str: '🍦',
        custom: 'Value',
        omit: '🙈',
      };

      const actualSource = typeScriptSourceForObject(obj, {
        encoder: (key, value) => {
          if (key === 'custom') {
            return value;
          }

          if (key === 'omit') {
            return undefined;
          }

          return JSON.stringify(value);
        },
      });

      expect((actualSource as SourcelikeArray).join('')).toEqual(
        '{ str: "🍦", custom: Value, }',
      );
    });
  });
});
