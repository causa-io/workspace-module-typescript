import {
  ArrayType,
  EnumType,
  Name,
  type Sourcelike,
  Type,
  type TypeKind,
} from 'quicktype-core';
import { removeNullFromType } from 'quicktype-core/dist/Type/index.js';
import type { TypeScriptDecorator } from '../decorator.js';
import {
  type ClassPropertyContext,
  TypeScriptDecoratorsRenderer,
} from '../ts-decorators-renderer.js';
import { typeScriptSourceForObject } from '../utilities.js';

/**
 * The name of the class validator module, used to import the validation decorators.
 */
const CLASS_VALIDATOR_MODULE = 'class-validator';

/**
 * The name of the class transformer module, used to import the type decorator.
 */
const CLASS_TRANSFORMER_MODULE = 'class-transformer';

/**
 * The definition for a class validator decorator.
 */
type DecoratorDefinition = {
  /**
   * The name of the decorator.
   */
  name: string;

  /**
   * A function that generates the source for the decorator from the type of the property and from standard class
   * validator decorator options.
   * If not provided, the decorator is rendered as `@<name>(<options>)`.
   */
  source?: (type: Type, options: Sourcelike) => Sourcelike;
};

/**
 * A map between schema types and the class validator decorators that should be added to properties of this type.
 */
const TYPE_KIND_TO_DECORATORS: Partial<
  Record<TypeKind, DecoratorDefinition[]>
> = {
  class: [{ name: 'ValidateNested', source: () => '@ValidateNested()' }],
  date: [{ name: 'IsDate' }],
  'date-time': [{ name: 'IsDate' }],
  uuid: [
    {
      name: 'IsUUID',
      // The first argument is the UUID version, which is not specified in the schema.
      source: (_, opts) => ['@IsUUID(undefined', opts ? ', ' : '', opts, ')'],
    },
  ],
  string: [{ name: 'IsString' }],
  enum: [
    {
      name: 'IsIn',
      source: (type, opts) => [
        '@IsIn(',
        JSON.stringify([...(type as EnumType).cases]),
        opts ? ', ' : '',
        opts,
        ')',
      ],
    },
  ],
  integer: [{ name: 'IsInt' }],
  double: [{ name: 'IsNumber' }],
  bool: [{ name: 'IsBoolean' }],
  map: [{ name: 'IsObject' }],
};

/**
 * A {@link TypeScriptDecoratorsRenderer} that adds `class-validator` and `class-transformer` decorators to the
 * properties of a class.
 */
export class ClassValidatorTransformerPropertyDecoratorsRenderer extends TypeScriptDecoratorsRenderer {
  decoratorsForClass(): TypeScriptDecorator[] {
    return [];
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    if (context.propertyAttributes.tsType) {
      return [];
    }

    const propertyType = removeNullFromType(context.property.type)[1];
    if (propertyType.size < 1) {
      const decorators: TypeScriptDecorator[] = [];
      this.addDecoratorToList(
        decorators,
        context,
        'Equals',
        CLASS_VALIDATOR_MODULE,
        '@Equals(null)',
      );
      return decorators;
    }
    if (propertyType.size > 1) {
      return [];
    }

    const decorators: TypeScriptDecorator[] = [];
    let typeName: Name | string | null = null;
    let singleType = [...propertyType][0];

    let arrayOptions: Sourcelike = '';
    if (singleType.kind === 'array') {
      singleType = (singleType as ArrayType).items;

      arrayOptions = typeScriptSourceForObject({ each: true });
      this.addDecoratorToList(
        decorators,
        context,
        'IsArray',
        CLASS_VALIDATOR_MODULE,
        '@IsArray()',
      );
    }

    // From here, `singleType` is the type of the property without the array wrapper nor nullability information.
    // All decorators below this point only care about this "single type".

    TYPE_KIND_TO_DECORATORS[singleType.kind]?.forEach((definition) => {
      this.addDecoratorToList(
        decorators,
        context,
        definition.name,
        CLASS_VALIDATOR_MODULE,
        (
          definition.source ??
          ((_, opts) => [`@${definition.name}(`, opts, ')'])
        )(singleType, arrayOptions),
      );
    });

    switch (singleType.kind) {
      case 'class':
        typeName = this.nameForNamedType(singleType);

        if (!context.property.isOptional) {
          // Contrary to base types, by default a nested type won't throw an error if it's not defined.
          this.addDecoratorToList(
            decorators,
            context,
            'IsDefined',
            CLASS_VALIDATOR_MODULE,
            '@IsDefined()',
          );
        }
        break;
      case 'date':
      case 'date-time':
        typeName = 'Date';
        break;
    }

    if (typeName) {
      this.addDecoratorToList(
        decorators,
        context,
        'Type',
        CLASS_TRANSFORMER_MODULE,
        ['@Type(() => ', typeName, ')'],
      );
    }

    return decorators;
  }
}
