import logger from "./logger";

/**
 * Complete configuration interface
 *
 * @interface
 * @property {Record<string, MapSource>} maps - Map sources configuration
 */
export interface Config {
  maps: Record<string, MapSource>;
}

/**
 * Map source configuration interface
 *
 * @interface
 * @property {string} name - Display name of the map source
 * @property {string} description - Description of the map source
 * @property {string} urlTemplate - URL template with {z}, {x}, {y}, {s} placeholders
 * @property {string} cachePrefix - S3 cache prefix for this map source
 * @property {string[]} [subdomains] - Subdomain list for URL rotation
 * @property {Record<string, string>} [headers] - Additional HTTP headers
 */
export interface MapSource {
  cacheMaxAge?: number;
  cachePrefix: string;
  description: string;
  headers?: Record<string, string>;
  name: string;
  retryAttempts?: number;
  subdomains?: string[];
  timeout?: number;
  urlTemplate: string;
}

/**
 * Map configuration manager
 * Handles loading and managing map source configurations
 */
export class MapConfig {
  private static instance: MapConfig;

  /**
   * Get singleton instance
   *
   * @returns {MapConfig} Configuration manager instance
   */
  public static getInstance(): MapConfig {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  private config: Config | null = null;

  /**
   * Get all available map sources
   *
   * @returns {Record<string, MapSource>} All map sources
   */
  public getAllMapSources(): Record<string, MapSource> {
    if (!this.config) {
      logger.warn("Configuration not loaded");
      return {};
    }
    return this.config.maps;
  }

  /**
   * Get available map source IDs
   *
   * @returns {string[]} List of available map source identifiers
   */
  public getAvailableSources(): string[] {
    if (!this.config) {
      return [];
    }
    return Object.keys(this.config.maps);
  }

  /**
   * Get map source configuration by ID
   *
   * @param {string} mapId - Map source identifier
   * @returns {MapSource | null} Map source configuration or null if not found
   */
  public getMapSource(mapId: string): MapSource | null {
    if (!this.config) {
      logger.warn("Configuration not loaded");
      return null;
    }
    return this.config.maps[mapId] || null;
  }

  /**
   * Check if map source exists
   *
   * @param {string} mapId - Map source identifier
   * @returns {boolean} True if map source exists
   */
  public hasMapSource(mapId: string): boolean {
    return this.getMapSource(mapId) !== null;
  }

  /**
   * Load configuration from JSON file
   *
   * @param {string} [configPath] - Path to configuration file
   * @returns {Promise<void>}
   */
  public async loadConfig(configPath: string = "config/maps.json"): Promise<void> {
    try {
      const file = Bun.file(configPath);
      if (!(await file.exists())) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      this.config = await file.json();

      // Check for duplicate cachePrefix values
      const seen = new Map<string, string>();
      for (const [id, source] of Object.entries(this.config!.maps)) {
        const existing = seen.get(source.cachePrefix);
        if (existing) {
          throw new Error(
            `Duplicate cachePrefix "${source.cachePrefix}" found in map sources "${existing}" and "${id}". Each map source must have a unique cachePrefix.`,
          );
        }
        seen.set(source.cachePrefix, id);
      }

      logger.info(`Loaded ${Object.keys(this.config!.maps).length} map sources from ${configPath}`);
    }
    catch (error) {
      logger.error(`Failed to load configuration: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const mapConfig = MapConfig.getInstance();
