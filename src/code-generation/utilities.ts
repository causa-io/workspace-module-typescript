import { ArrayType, type Sourcelike, Type } from 'quicktype-core';
import { removeNullFromType } from 'quicktype-core/dist/Type/index.js';

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

/**
 * Removes the null type from the given type, and extracts the items type for array types.
 *
 * @param type The type for which the single type should be extracted.
 * @returns Information about the single type, or `null` if the type is not a single type.
 */
export function getSingleType(type: Type): {
  /**
   * The single type.
   */
  type: Type;

  /**
   * Whether the original type was nullable.
   */
  isNullable: boolean;

  /**
   * Whether the original type was an array.
   */
  isArray: boolean;
} | null {
  const [nullType, propertyType] = removeNullFromType(type);
  if (propertyType.size !== 1) {
    return null;
  }

  const isNullable = nullType !== null;
  const nonNullType = [...propertyType][0];
  const isArray = nonNullType.kind === 'array';

  if (isArray) {
    return { type: (nonNullType as ArrayType).items, isNullable, isArray };
  }

  return { type: nonNullType, isNullable, isArray };
}
