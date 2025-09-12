import logger from "./logger";

/**
 * Map source configuration interface
 * @interface
 * @property {string} name - Display name of the map source
 * @property {string} description - Description of the map source
 * @property {string} urlTemplate - URL template with {z}, {x}, {y}, {s} placeholders
 * @property {number} maxZoom - Maximum zoom level supported
 * @property {string} cachePrefix - S3 cache prefix for this map source
 * @property {string[]} [subdomains] - Subdomain list for URL rotation
 * @property {Record<string, string>} [headers] - Additional HTTP headers
 */
export interface MapSource {
  name: string;
  description: string;
  urlTemplate: string;
  maxZoom: number;
  cachePrefix: string;
  subdomains?: string[];
  headers?: Record<string, string>;
}

/**
 * Complete configuration interface
 * @interface
 * @property {Record<string, MapSource>} maps - Map sources configuration
 */
export interface Config {
  maps: Record<string, MapSource>;
}

/**
 * Map configuration manager
 * Handles loading and managing map source configurations
 */
export class MapConfig {
  private static instance: MapConfig;
  private config: Config | null = null;

  /**
   * Get singleton instance
   * @returns {MapConfig} Configuration manager instance
   */
  public static getInstance(): MapConfig {
    if (!MapConfig.instance) {
      MapConfig.instance = new MapConfig();
    }
    return MapConfig.instance;
  }

  /**
   * Load configuration from JSON file
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
      logger.info(`Loaded ${Object.keys(this.config!.maps).length} map sources from ${configPath}`);
    }
    catch (error) {
      logger.error(`Failed to load configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Get map source configuration by ID
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
   * Get all available map sources
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
   * Check if map source exists
   * @param {string} mapId - Map source identifier
   * @returns {boolean} True if map source exists
   */
  public hasMapSource(mapId: string): boolean {
    return this.getMapSource(mapId) !== null;
  }

  /**
   * Get available map source IDs
   * @returns {string[]} List of available map source identifiers
   */
  public getAvailableSources(): string[] {
    if (!this.config) {
      return [];
    }
    return Object.keys(this.config.maps);
  }
}

// Export singleton instance
export const mapConfig = MapConfig.getInstance();
