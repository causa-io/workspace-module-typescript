import { EnumType, MapType, Sourcelike, Type, TypeKind } from 'quicktype-core';
import { SourcelikeArray } from 'quicktype-core/dist/Source.js';
import { TypeScriptDecorator } from '../decorator.js';
import {
  ClassContext,
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
  // Only string enums are supported by Quicktype.
  enum: 'string',
};

/**
 * Generates the source code for the `@ApiProperty` decorator options for the given type.
 * This function is recursive, and will generate options for array types as well.
 *
 * @param type The type for which the decorator options should be generated.
 * @returns The source code for the decorator options.
 */
function typeToDecoratorOptions(type: Type): SourcelikeArray {
  const singleTypeInfo = getSingleType(type);
  if (!singleTypeInfo) {
    return [];
  }

  const { type: singleType, isNullable, isArray } = singleTypeInfo;
  const decoratorOptions: SourcelikeArray = [];

  if (isArray) {
    const itemOptions = typeToDecoratorOptions(singleType);
    decoratorOptions.push(`type: 'array', `, 'items: { ', itemOptions, ' }, ');
  } else {
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
        const typeName = singleType.getCombinedName();
        const refOption: Sourcelike = `$ref: getSchemaPath(${typeName})`;
        // If the type is nullable, `oneOf` will be added before returning the decorator options.
        decoratorOptions.push(
          isNullable ? refOption : ['oneOf: [{', refOption, '}]'],
        );
        break;
      case 'map':
        const additionalProperties = (
          singleType as MapType
        ).getAdditionalProperties();
        if (additionalProperties) {
          const options = typeToDecoratorOptions(additionalProperties);
          if (options.length > 0) {
            decoratorOptions.push('additionalProperties: { ', options, ' }, ');
          } else {
            // This can for example occur if the additional properties are of type `any`.
            decoratorOptions.push('additionalProperties: true, ');
          }
        }
        break;
    }
  }

  if (isNullable) {
    return ['oneOf: [{', decoratorOptions, `}, { type: 'null' }]`];
  }

  return decoratorOptions;
}

/**
 * Returns the name of the class used by the given type, or an empty array if it is a basic type.
 *
 * @param type The property type that may be a class, or contain a class within an array.
 * @returns The list of classes used by the type.
 */
function listReferencedClasses(type: Type): string[] {
  const singleTypeInfo = getSingleType(type);
  if (!singleTypeInfo) {
    return [];
  }

  if (singleTypeInfo.isArray) {
    return listReferencedClasses(singleTypeInfo.type);
  }

  return singleTypeInfo.type.kind === 'class'
    ? [singleTypeInfo.type.getCombinedName()]
    : [];
}

/**
 * A {@link TypeScriptDecoratorsRenderer} that renders NestJS OpenAPI decorators.
 * Decorators are only added if the type schema has the `tsOpenApi` Causa attribute.
 */
export class OpenApiRenderer extends TypeScriptDecoratorsRenderer {
  decoratorsForClass(context: ClassContext): TypeScriptDecorator[] {
    if (!context.objectAttributes[OPENAPI_ATTRIBUTE]) {
      return [];
    }

    const references = new Set<string>();
    for (const propType of context.classType.getProperties().values()) {
      listReferencedClasses(propType.type).forEach((r) => references.add(r));
    }
    if (references.size === 0) {
      return [];
    }

    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'ApiExtraModels',
      NESTJS_SWAGGER_MODULE,
      ['@ApiExtraModels(', [...references].flatMap((r) => [r, ',']), ')'],
      // This will get used by `decoratorsForProperty`, when writing the `references` in the decorators.
      { imports: { '@nestjs/swagger': ['getSchemaPath'] } },
    );
    return decorators;
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
    apiPropertySource.push(typeToDecoratorOptions(context.property.type));
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
