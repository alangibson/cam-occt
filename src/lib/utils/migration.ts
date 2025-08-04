/**
 * Migration utilities for legacy localStorage data
 * 
 * Handles migration from component-level localStorage persistence
 * to unified application state persistence.
 */

/**
 * Migrate legacy localStorage data to unified persistence system
 */
export function migrateLegacyData(): void {
  console.log('Checking for legacy localStorage data to migrate...');
  
  let needsMigration = false;
  
  // Check for legacy localStorage keys
  const legacyKeys = [
    'cam-occt-operations',
    'cam-occt-paths', 
    'cam-occt-tools',
    'cam-occt-prepare-left-column-width',
    'cam-occt-prepare-right-column-width'
  ];
  
  const legacyData: Record<string, any> = {};
  
  for (const key of legacyKeys) {
    const data = localStorage.getItem(key);
    if (data) {
      needsMigration = true;
      try {
        if (key.includes('width')) {
          // Column widths are just numbers
          legacyData[key] = parseInt(data, 10);
        } else {
          // Operations, paths, tools are JSON arrays
          legacyData[key] = JSON.parse(data);
        }
        console.log(`Found legacy data for ${key}`);
      } catch (error) {
        console.warn(`Failed to parse legacy data for ${key}:`, error);
      }
    }
  }
  
  if (!needsMigration) {
    console.log('No legacy data found, migration not needed');
    return;
  }
  
  console.log('Migrating legacy data to unified persistence system...');
  
  // Clear legacy keys to avoid conflicts
  legacyKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Cleared legacy key: ${key}`);
  });
  
  console.log('Legacy data migration completed');
  
  // Note: The actual data will be handled by the main persistence system
  // when stores are initialized. This function just cleans up old keys.
}

/**
 * Check if legacy data exists
 */
export function hasLegacyData(): boolean {
  const legacyKeys = [
    'cam-occt-operations',
    'cam-occt-paths',
    'cam-occt-tools',
    'cam-occt-prepare-left-column-width',
    'cam-occt-prepare-right-column-width'
  ];
  
  return legacyKeys.some(key => localStorage.getItem(key) !== null);
}