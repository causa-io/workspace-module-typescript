import { EnumType, MapType, Sourcelike, Type, TypeKind } from 'quicktype-core';
import { SourcelikeArray } from 'quicktype-core/dist/Source.js';
import { TypeScriptDecorator } from '../decorator.js';
import {
  ClassPropertyContext,
  TypeScriptDecoratorsRenderer,
} from '../ts-decorators-renderer.js';
import { getSingleType } from '../utilities.js';

/**
 * The name of the module that exports OpenAPI decorators.
 */
const NESTJS_SWAGGER_MODULE = '@nestjs/swagger';

/**
 * The name of the Causa attribute that should be present for a class to be decorated with OpenAPI decorators.
 */
const OPENAPI_ATTRIBUTE = 'tsOpenApi';

/**
 * A map between quicktype type kinds and the corresponding JSON schema types.
 */
const TYPE_KIND_TO_JSONSCHEMA_TYPE: Partial<Record<TypeKind, string>> = {
  string: 'string',
  date: 'string',
  'date-time': 'string',
  uuid: 'string',
  integer: 'integer',
  double: 'number',
  bool: 'boolean',
  map: 'object',
};

/**
 * Generates the source code for the `@ApiProperty` decorator options for the given type.
 * This function is recursive, and will generate options for array types as well.
 *
 * @param type The type for which the decorator options should be generated.
 * @param nameForNamedType A function that can be called to fetch the name of a type.
 * @returns The source code for the decorator options.
 */
function typeToDecoratorOptions(
  type: Type,
  nameForNamedType: (type: Type) => Sourcelike,
): SourcelikeArray {
  const singleTypeInfo = getSingleType(type);
  if (!singleTypeInfo) {
    return [];
  }

  const { type: singleType, isNullable, isArray } = singleTypeInfo;
  const decoratorOptions: SourcelikeArray = [];

  if (isNullable) {
    decoratorOptions.push('nullable: true, ');
  }

  if (isArray) {
    const itemSingleType = getSingleType(singleType);
    if (itemSingleType && itemSingleType.type.kind === 'class') {
      const itemTypeName = nameForNamedType(itemSingleType.type);
      decoratorOptions.push('type: () => [', itemTypeName, '], ');
    } else {
      const itemOptions = typeToDecoratorOptions(singleType, nameForNamedType);
      decoratorOptions.push(
        `type: 'array', `,
        'items: { ',
        itemOptions,
        ' }, ',
      );
    }
    return decoratorOptions;
  }

  const jsonSchemaType = TYPE_KIND_TO_JSONSCHEMA_TYPE[singleType.kind];
  if (jsonSchemaType) {
    decoratorOptions.push(`type: '${jsonSchemaType}', `);
  }
  switch (singleType.kind) {
    case 'date':
    case 'date-time':
    case 'uuid':
      decoratorOptions.push(`format: '${singleType.kind}', `);
      break;
    case 'enum':
      const cases = [...(singleType as EnumType).cases];
      decoratorOptions.push(`enum: ${JSON.stringify(cases)}, `);
      break;
    case 'class':
      const typeName = nameForNamedType(singleType);
      decoratorOptions.push('type: () => ', typeName, ', ');
      break;
    case 'map':
      const additionalProperties = (
        singleType as MapType
      ).getAdditionalProperties();
      if (additionalProperties) {
        const options = typeToDecoratorOptions(
          additionalProperties,
          nameForNamedType,
        );
        if (options.length > 0) {
          decoratorOptions.push('additionalProperties: { ', options, ' }, ');
        } else {
          // This can for example occur if the additional properties are of type `any`.
          decoratorOptions.push('additionalProperties: true, ');
        }
      }
      break;
  }

  return decoratorOptions;
}

/**
 * A {@link TypeScriptDecoratorsRenderer} that renders NestJS OpenAPI decorators.
 * Decorators are only added if the type schema has the `tsOpenApi` Causa attribute.
 */
export class OpenApiRenderer extends TypeScriptDecoratorsRenderer {
  decoratorsForClass(): TypeScriptDecorator[] {
    return [];
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    if (!context.objectAttributes[OPENAPI_ATTRIBUTE]) {
      return [];
    }

    const descriptions = this.descriptionForClassProperty(
      context.classType,
      context.jsonName,
    );
    const description = (descriptions ?? []).join('\n').trim();

    const apiPropertySource: SourcelikeArray = ['@ApiProperty({ '];
    if (description) {
      apiPropertySource.push(`description: ${JSON.stringify(description)}, `);
    }
    apiPropertySource.push(
      typeToDecoratorOptions(context.property.type, (type) =>
        type.getCombinedName(),
      ),
    );
    apiPropertySource.push(' })');

    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'ApiProperty',
      NESTJS_SWAGGER_MODULE,
      apiPropertySource,
    );
    return decorators;
  }
}
