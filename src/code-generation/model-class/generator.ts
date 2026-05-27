import type {
  EnumSchema,
  GeneratedSchemas,
  ObjectSchema,
  Property,
  PropertyType,
  Schema,
  UnionSchema,
} from '@causa/workspace-core';
import {
  BaseTypeScriptCodeGenerator,
  collectRefs,
  DEFAULT_CONSTRAINT_SUFFIX,
  enumCaseNames,
  getConstraintBaseObject,
  getConstraintBasePath,
  stripConstraintSuffix,
  topologicalSort,
} from '../base.js';

/**
 * A decorator that can be added to a class or property.
 */
export type TypeScriptDecorator = {
  /**
   * The source code for the decorator.
   */
  source: string;

  /**
   * The imports that are required for the decorator. Keys are modules or absolute file paths; values are the names of
   * the symbols to import.
   */
  imports: Record<string, string[]>;
};

/**
 * Decorators to add to a single object schema and its properties.
 */
export type ModelClassSchemaDecorators = {
  /**
   * Decorators added to the class.
   */
  class: TypeScriptDecorator[];

  /**
   * Decorators added to each property, keyed by the JSON property name.
   */
  properties: Record<string, TypeScriptDecorator[]>;
};

/**
 * Options for {@link TypeScriptModelClassGenerator}.
 */
export type TypeScriptModelClassGeneratorOptions = Partial<
  Pick<
    TypeScriptModelClassGenerator,
    'constraintSuffix' | 'decorators' | 'existingSchemas'
  >
>;

/**
 * Generates TypeScript model classes from a set of {@link Schema}s and writes the formatted output to disk.
 *
 * Decorators must be pre-computed by the caller and passed via {@link decorators}.
 */
export class TypeScriptModelClassGenerator extends BaseTypeScriptCodeGenerator {
  /**
   * The alias name used for constraint classes (suffix stripped), keyed by schema path.
   */
  private readonly constraintAliasNames: Record<string, string> = {};

  /**
   * The TypeScript identifier used for each schema (PascalCased), keyed by schema path.
   */
  private readonly classNames: Record<string, string> = {};

  /**
   * The suffix used to identify constraint classes.
   * Defaults to `Constraint`.
   */
  readonly constraintSuffix: string;

  /**
   * Pre-computed decorators for each object schema and its properties, keyed by schema path.
   */
  readonly decorators: Record<string, ModelClassSchemaDecorators>;

  /**
   * Schemas that were already emitted by a previous generator run, keyed by absolute schema path. Paths in this map
   * are not re-emitted; references to them resolve to the {@link GeneratedSchema.name} and add an import from
   * {@link GeneratedSchema.file}. The full {@link Schema} for these paths should still be present in `schemas` so
   * decorator builders can introspect their kind.
   */
  readonly existingSchemas: GeneratedSchemas;

  /**
   * Creates a new generator.
   *
   * @param outputPath Absolute path of the file the rendered source will be written to.
   * @param schemas The schemas to render, indexed by their absolute source path.
   * @param options Options.
   */
  constructor(
    outputPath: string,
    readonly schemas: Record<string, Schema>,
    readonly options: TypeScriptModelClassGeneratorOptions = {},
  ) {
    super(outputPath);
    this.constraintSuffix =
      options.constraintSuffix ?? DEFAULT_CONSTRAINT_SUFFIX;
    this.decorators = options.decorators ?? {};
    this.existingSchemas = options.existingSchemas ?? {};

    for (const [path, schema] of Object.entries(schemas)) {
      if (this.existingSchemas[path]) {
        continue;
      }

      this.classNames[path] = schema.name;

      if (getConstraintBasePath(schema) !== undefined) {
        this.constraintAliasNames[path] = stripConstraintSuffix(
          schema.name,
          this.constraintSuffix,
        );
      }
    }
    for (const [path, existing] of Object.entries(this.existingSchemas)) {
      this.classNames[path] = existing.name;
    }
  }

  /**
   * Renders all schemas, formats the output with prettier, and writes it to {@link outputPath}.
   * Populates {@link generatedSchemas}.
   */
  async generate(): Promise<void> {
    const schemaBlocks = this.topologicalSort().map((s) => this.emitSchema(s));
    await this.renderFile(schemaBlocks.join('\n\n'));
  }

  /**
   * Returns the TypeScript identifier used to reference the given schema. Throws when the schema was not registered
   * with the generator at construction time.
   */
  private getSchemaName(schema: Schema): string {
    const name = this.classNames[schema.path];
    if (name === undefined) {
      throw new Error(`No registered class name for schema '${schema.path}'.`);
    }
    return name;
  }

  /**
   * Topologically sorts the schemas so that dependencies are emitted before their dependents. Ties are broken by
   * emit-name (alphabetical), then by path for determinism.
   *
   * Constraint classes do NOT depend on their `constraintFor` base, since the type alias may forward-reference it.
   */
  private topologicalSort(): Schema[] {
    const paths = Object.keys(this.schemas).filter(
      (p) => !this.existingSchemas[p],
    );
    const sorted = topologicalSort(
      paths,
      (p) => {
        const schema = this.schemas[p];
        const deps = new Set<string>();
        if (schema.kind === 'object') {
          for (const property of schema.properties) {
            collectRefs(property.type, deps);
            const enumHint = property.extensions.enumHint;
            if (typeof enumHint === 'string') {
              deps.add(enumHint);
            }
          }
        } else if (schema.kind === 'union') {
          for (const t of schema.types) {
            collectRefs(t, deps);
          }
        }
        return deps;
      },
      (p) =>
        this.constraintAliasNames[p] ?? this.getSchemaName(this.schemas[p]),
    );
    return sorted.map((p) => this.schemas[p]);
  }

  /**
   * Emits a single schema and returns the emitted block.
   */
  private emitSchema(schema: Schema): string {
    switch (schema.kind) {
      case 'enum':
        return this.emitEnum(schema);
      case 'union':
        return this.emitUnion(schema);
      case 'object':
        return this.emitObject(schema);
    }
  }

  /**
   * Emits the source for an enum schema.
   */
  private emitEnum(schema: EnumSchema): string {
    const name = this.getSchemaName(schema);
    this.generatedSchemas[schema.path] = { name, file: this.outputPath };

    const lines: string[] = [];
    lines.push(this.formatJsdoc(schema.description));
    lines.push(`export enum ${name} {`);
    const caseNames = enumCaseNames(schema);
    for (const [index, value] of schema.values.entries()) {
      const caseName = caseNames[index];
      lines.push(`  ${caseName} = ${JSON.stringify(value)},`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Emits the source for a top-level union schema.
   */
  private emitUnion(schema: UnionSchema): string {
    const name = this.getSchemaName(schema);
    this.generatedSchemas[schema.path] = { name, file: this.outputPath };

    const members = schema.types
      .map((t) => this.sourceForPropertyType(t))
      .join(' | ');

    const lines: string[] = [];
    lines.push(this.formatJsdoc(schema.description));
    lines.push(`export type ${name} = ${members};`);
    return lines.join('\n');
  }

  /**
   * Emits the source for an object schema, including the constraint type alias when applicable.
   */
  private emitObject(schema: ObjectSchema): string {
    const constraintForPath = getConstraintBasePath(schema);
    const aliasName =
      constraintForPath !== undefined
        ? this.constraintAliasNames[schema.path]
        : null;
    const className = this.getSchemaName(schema);

    this.generatedSchemas[schema.path] = {
      name: aliasName ?? className,
      file: this.outputPath,
    };

    const lines: string[] = [];

    if (aliasName && constraintForPath !== undefined) {
      const baseSchema = this.schemas[constraintForPath];
      if (!baseSchema) {
        throw new Error(
          `Constraint '${className}' references unknown base schema '${constraintForPath}'.`,
        );
      }
      lines.push(this.formatJsdoc(schema.description));
      lines.push(
        `export type ${aliasName} = ${this.getSchemaName(baseSchema)} & ${className};`,
      );
      lines.push('');
    }

    lines.push(this.formatJsdoc(schema.description));

    const schemaDecorators = this.decorators[schema.path];
    const extClassDecorators = (schema.extensions.tsDecorators ??
      []) as TypeScriptDecorator[];
    for (const decorator of [
      ...extClassDecorators,
      ...(schemaDecorators?.class ?? []),
    ].toSorted((a, b) => a.source.localeCompare(b.source))) {
      this.addImports(decorator.imports);
      lines.push(decorator.source);
    }

    lines.push(`export class ${className} {`);
    lines.push(`constructor(init: ${className}) {`);
    lines.push(`Object.assign(this, init);`);
    lines.push(`}`);

    for (const property of schema.properties) {
      lines.push('');
      lines.push(...this.emitProperty(schema, property, schemaDecorators));
    }

    const { additionalProperties } = schema;
    if (additionalProperties !== false) {
      const valueType =
        additionalProperties === true
          ? 'any'
          : `${this.sourceForPropertyType(additionalProperties)} | any`;
      lines.push('');
      lines.push(`[key: string]: ${valueType};`);
    }

    lines.push(`}`);

    return lines.join('\n');
  }

  /**
   * Emits the lines for a single property within a class, including its description, decorators and field declaration.
   */
  private emitProperty(
    schema: ObjectSchema,
    property: Property,
    schemaDecorators: ModelClassSchemaDecorators | undefined,
  ): string[] {
    const lines: string[] = [];
    lines.push(this.formatJsdoc(property.description));

    const extDecorators = (property.extensions.tsDecorators ??
      []) as TypeScriptDecorator[];
    const propertyDecorators =
      schemaDecorators?.properties[property.name] ?? [];
    for (const decorator of [...extDecorators, ...propertyDecorators].toSorted(
      (a, b) => a.source.localeCompare(b.source),
    )) {
      this.addImports(decorator.imports);
      lines.push(decorator.source);
    }

    const { tsType, tsDefault } = property.extensions;
    const typeSource =
      typeof tsType === 'string'
        ? tsType
        : this.sourceForProperty(schema, property);

    const marker = tsDefault ? '' : property.required ? '!' : '?';
    const assignment = tsDefault ? ` = ${tsDefault}` : '';
    const namePart = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(property.name)
      ? property.name
      : JSON.stringify(property.name);
    lines.push(`readonly ${namePart}${marker}: ${typeSource}${assignment};`);

    return lines;
  }

  /**
   * Returns the TypeScript type source for a property, applying the property-level nullability and `enumHint`.
   */
  private sourceForProperty(schema: ObjectSchema, property: Property): string {
    if (property.type.kind === 'const') {
      const baseSchema = getConstraintBaseObject(schema, this.schemas);
      if (baseSchema) {
        const baseProperty = baseSchema.properties.find(
          (p) => p.name === property.name,
        );
        if (baseProperty?.type.kind === 'ref') {
          const baseEnum = this.schemas[baseProperty.type.ref];
          if (baseEnum?.kind === 'enum') {
            const constValue = property.type.value;
            const caseName =
              enumCaseNames(baseEnum)[
                baseEnum.values.findIndex((v) => v === constValue)
              ];
            if (caseName) {
              return `${this.getSchemaName(baseEnum)}.${caseName}`;
            }
          }
        }
      }
    }

    let base = this.sourceForPropertyType(property.type);

    const enumHint = property.extensions.enumHint;
    if (typeof enumHint === 'string') {
      const enumSchema = this.schemas[enumHint];
      if (enumSchema && enumSchema.kind === 'enum') {
        const enumName = this.getSchemaName(enumSchema);
        const existing = this.existingSchemas[enumHint];
        if (existing && existing.file !== this.outputPath) {
          this.addImports({ [existing.file]: [existing.name] });
        }
        if (property.type.kind === 'array') {
          const itemSource = this.sourceForPropertyType(property.type.items);
          const itemBase = property.type.itemNullable
            ? `${itemSource} | null`
            : itemSource;
          base = `(${itemBase} | ${enumName})[]`;
        } else {
          base = `${base} | ${enumName}`;
        }
      }
    }

    if (property.nullable) {
      base = `${base} | null`;
    }

    return base;
  }

  /**
   * Returns the TypeScript type source for a property type (without property-level nullability or enum hint applied).
   */
  private sourceForPropertyType(type: PropertyType): string {
    switch (type.kind) {
      case 'primitive':
        switch (type.type) {
          case 'string':
          case 'uuid':
            return 'string';
          case 'integer':
          case 'number':
            return 'number';
          case 'boolean':
            return 'boolean';
          case 'datetime':
            return 'Date';
        }
      case 'null':
        return 'null';
      case 'const':
        return JSON.stringify(type.value);
      case 'ref': {
        const existing = this.existingSchemas[type.ref];
        if (existing) {
          if (existing.file !== this.outputPath) {
            this.addImports({ [existing.file]: [existing.name] });
          }
          return existing.name;
        }
        const target = this.schemas[type.ref];
        if (!target) {
          throw new Error(`Unknown schema reference '${type.ref}'.`);
        }
        return this.getSchemaName(target);
      }
      case 'array': {
        const inner = this.sourceForPropertyType(type.items);
        const item = type.itemNullable ? `${inner} | null` : inner;
        return `(${item})[]`;
      }
      case 'map': {
        if (type.items === 'any') {
          return 'Record<string, any>';
        }
        return `Record<string, ${this.sourceForPropertyType(type.items)}>`;
      }
    }
  }

  /**
   * Returns the JSDoc block for a description, or an empty string when the description is empty.
   */
  private formatJsdoc(description: string | undefined): string {
    if (!description) {
      return '';
    }
    return [
      '/**',
      ...description
        .split('\n')
        .map((l) => l.trimEnd())
        .map((l) => ` * ${l}`),
      ' */',
    ].join('\n');
  }
}
