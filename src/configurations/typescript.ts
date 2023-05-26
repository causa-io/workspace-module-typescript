/**
 * Configuration for TypeScript projects.
 */
export type TypeScriptConfiguration = {
  /**
   * Configuration for JavaScript-related tools, usually for TypeScript projects.
   */
  javascript?: {
    /**
     * Configuration for running npm commands.
     */
    npm?: {
      /**
       * Environment variables to set when running npm.
       * Supports formatting.
       */
      environment?: Record<string, string>;
    };
  };

  /**
   * Configuration for TypeScript projects.
   */
  typescript?: {
    /**
     * Configuration related to the handling of events in TypeScript code.
     */
    events?: {
      /**
       * The format string used to generate the file path for event schema definition files.
       * The path is relative to the project's root.
       */
      definitionFileFormat?: string;
    };
  };
};
