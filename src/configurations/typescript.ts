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

      /**
       * The version of npm to use.
       * Can be a semver version, or `latest`.
       */
      version?: string;
    };

    /**
     * Configuration related to Node.
     */
    node?: {
      /**
       * The Node version to use, for example when building Docker images.
       * Can be a semver version, or `latest`.
       */
      version?: string;
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

    /**
     * The path to the Dockerfile used to build service containers for projects in TypeScript.
     */
    serviceContainerDockerfile?: string;
  };
};
