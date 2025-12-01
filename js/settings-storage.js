/**
 * Settings Storage Module
 * Manages persistent font settings using IndexedDB
 */

import { get, set } from './lib/idb-keyval.js';

export class SettingsStorage {
  constructor() {
    this.GLOBAL_SETTINGS_KEY = '2x4:global-settings';
    this.CALIBRATION_KEY = '2x4:display-calibration';
  }

  /**
   * Get settings for a specific file (by filename)
   * Falls back to global settings if no file-specific settings exist
   * @param {string} filename - File identifier (EPUB filename or Arxiv ID)
   * @returns {Promise<Object|null>} Settings object or null
   */
  async getSettingsForFile(filename) {
    const fileKey = `2x4:file:${filename}`;
    const fileSettings = await get(fileKey);

    if (fileSettings) {
      return fileSettings;
    }

    // Fallback to global settings
    return await this.getGlobalSettings();
  }

  /**
   * Get global default settings
   * @returns {Promise<Object|null>}
   */
  async getGlobalSettings() {
    return await get(this.GLOBAL_SETTINGS_KEY);
  }

  /**
   * Save settings for a specific file
   * Also updates global settings as "last used"
   * @param {string} filename - File identifier
   * @param {Object} settings - { fontFamily, fontSize, lineHeight }
   */
  async saveSettingsForFile(filename, settings) {
    const fileKey = `2x4:file:${filename}`;
    const settingsToSave = {
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      lastUpdated: Date.now()
    };

    // Save file-specific settings
    await set(fileKey, settingsToSave);

    // Also update global settings as "last used"
    await set(this.GLOBAL_SETTINGS_KEY, settingsToSave);
  }

  /**
   * Save only global settings (when no file is loaded)
   * @param {Object} settings - { fontFamily, fontSize, lineHeight }
   */
  async saveGlobalSettings(settings) {
    const settingsToSave = {
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      lastUpdated: Date.now()
    };

    await set(this.GLOBAL_SETTINGS_KEY, settingsToSave);
  }

  /**
   * Get display calibration scale
   * @returns {Promise<number>} Scale percentage (default: 100)
   */
  async getCalibrationScale() {
    const scale = await get(this.CALIBRATION_KEY);
    return scale || 100;
  }

  /**
   * Save display calibration scale
   * @param {number} scale - Scale percentage (e.g., 100, 115, 120)
   */
  async saveCalibrationScale(scale) {
    await set(this.CALIBRATION_KEY, scale);
  }
}
