import { Sourcelike } from 'quicktype-core';

/**
 * Constructs the TypeScript source code for the given object.
 * The default behavior is to encode values as JSON. However a custom encoder can be provided.
 *
 * @param obj The object to format.
 * @param options Options for the source code generation.
 * @returns The source code for the object.
 */
export function typeScriptSourceForObject(
  obj: Record<string, any>,
  options: {
    /**
     * A custom encoder, taking a key-value pair and returning the source code for the value.
     * If the encoder returns `undefined`, the property will be omitted.
     */
    encoder?: (key: string, value: any) => Sourcelike | undefined;
  } = {},
): Sourcelike {
  const sourceOptions = Object.entries(obj).flatMap(
    ([key, value]): Sourcelike[] => {
      const encoded = options.encoder
        ? options.encoder(key, value)
        : JSON.stringify(value);

      return encoded === undefined ? [] : [key, ': ', encoded, ', '];
    },
  );

  return sourceOptions.length > 0 ? ['{ ', ...sourceOptions, '}'] : '';
}
