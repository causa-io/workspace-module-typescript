import {
  ArrayType,
  EnumType,
  PrimitiveType,
  type Sourcelike,
  Type,
} from 'quicktype-core';
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
 * This also handles the case of non-string constants, which are enum types (but from which a primitive type must be
 * removed).
 *
 * @param type The type for which the single type should be extracted.
 * @returns Information about the single type.
 */
export function getSingleType(type: Type): {
  /**
   * The single type, or `null` if there are multiple non-null types.
   */
  type: Type | null;

  /**
   * Whether the original type was nullable.
   */
  isNullable: boolean;

  /**
   * Whether the original type was an array.
   */
  isArray: boolean;
} {
  const [nullType, propertyType] = removeNullFromType(type);
  const isNullable = nullType !== null;

  if (propertyType.size > 1) {
    const typesWithoutPrimitives = [...propertyType].filter(
      (t) => !(t instanceof PrimitiveType),
    );
    if (
      typesWithoutPrimitives.length === 1 &&
      typesWithoutPrimitives[0] instanceof EnumType
    ) {
      return {
        type: typesWithoutPrimitives[0],
        isNullable,
        isArray: false,
      };
    }
  }

  if (propertyType.size !== 1) {
    return { type: null, isNullable, isArray: false };
  }

  const nonNullType = [...propertyType][0];
  const isArray = nonNullType.kind === 'array';

  return {
    type: isArray ? (nonNullType as ArrayType).items : nonNullType,
    isNullable,
    isArray,
  };
}
