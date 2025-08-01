#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all test files that need migration
const testFiles = execSync('find src -name "*.test.ts" -o -name "*.unit.test.ts"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(file => file.length > 0);

console.log(`Found ${testFiles.length} test files to migrate`);

// Migration patterns
const migrations = [
  // Import statements
  {
    pattern: /^(import.*from.*['"].*lead-calculation['"];?)$/m,
    replacement: (match, importStmt) => `${importStmt}\nimport { CutDirection, LeadType } from '../types/direction';`
  },
  {
    pattern: /^(import.*from.*['"].*\.\.\/algorithms\/lead-calculation['"];?)$/m,
    replacement: (match, importStmt) => `${importStmt}\nimport { CutDirection, LeadType } from '../types/direction';`
  },
  {
    pattern: /^(import.*from.*['"].*\.\.\/\.\.\/lib\/algorithms\/lead-calculation['"];?)$/m,
    replacement: (match, importStmt) => `${importStmt}\nimport { CutDirection, LeadType } from '../../lib/types/direction';`
  },
  
  // LeadType enum replacements
  { pattern: /type:\s*['"]arc['"]/g, replacement: "type: LeadType.ARC" },
  { pattern: /type:\s*['"]line['"]/g, replacement: "type: LeadType.LINE" },
  { pattern: /type:\s*['"]none['"]/g, replacement: "type: LeadType.NONE" },
  { pattern: /leadInType:\s*['"]arc['"]/g, replacement: "leadInType: LeadType.ARC" },
  { pattern: /leadInType:\s*['"]line['"]/g, replacement: "leadInType: LeadType.LINE" },
  { pattern: /leadInType:\s*['"]none['"]/g, replacement: "leadInType: LeadType.NONE" },
  { pattern: /leadOutType:\s*['"]arc['"]/g, replacement: "leadOutType: LeadType.ARC" },
  { pattern: /leadOutType:\s*['"]line['"]/g, replacement: "leadOutType: LeadType.LINE" },
  { pattern: /leadOutType:\s*['"]none['"]/g, replacement: "leadOutType: LeadType.NONE" },
  
  // CutDirection enum replacements
  { pattern: /cutDirection:\s*['"]clockwise['"]/g, replacement: "cutDirection: CutDirection.CLOCKWISE" },
  { pattern: /cutDirection:\s*['"]counterclockwise['"]/g, replacement: "cutDirection: CutDirection.COUNTERCLOCKWISE" },
  { pattern: /cutDirection:\s*['"]none['"]/g, replacement: "cutDirection: CutDirection.NONE" },
  
  // Function call parameters
  { pattern: /calculateLeads\((.*?),\s*['"]clockwise['"]([,)])/g, replacement: "calculateLeads($1, CutDirection.CLOCKWISE$2" },
  { pattern: /calculateLeads\((.*?),\s*['"]counterclockwise['"]([,)])/g, replacement: "calculateLeads($1, CutDirection.COUNTERCLOCKWISE$2" },
  { pattern: /calculateLeads\((.*?),\s*['"]none['"]([,)])/g, replacement: "calculateLeads($1, CutDirection.NONE$2" },
  
  // String literal comparisons
  { pattern: /===\s*['"]clockwise['"]/g, replacement: "=== CutDirection.CLOCKWISE" },
  { pattern: /===\s*['"]counterclockwise['"]/g, replacement: "=== CutDirection.COUNTERCLOCKWISE" },
  { pattern: /===\s*['"]none['"]/g, replacement: "=== CutDirection.NONE" },
  { pattern: /!==\s*['"]clockwise['"]/g, replacement: "!== CutDirection.CLOCKWISE" },
  { pattern: /!==\s*['"]counterclockwise['"]/g, replacement: "!== CutDirection.COUNTERCLOCKWISE" },
  { pattern: /!==\s*['"]none['"]/g, replacement: "!== CutDirection.NONE" },
];

let totalFiles = 0;
let migratedFiles = 0;

testFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let hasChanges = false;
    
    // Skip files that already import the enums
    if (content.includes('from \'../types/direction\'') || 
        content.includes('from \'../../lib/types/direction\'') ||
        content.includes('from \'$lib/types/direction\'')) {
      console.log(`⏭️  Skipping ${filePath} (already migrated)`);
      return;
    }
    
    totalFiles++;
    
    // Apply all migrations
    migrations.forEach(migration => {
      const newContent = content.replace(migration.pattern, migration.replacement);
      if (newContent !== content) {
        content = newContent;
        hasChanges = true;
      }
    });
    
    // Add import if we made enum-related changes and don't already have the import
    if (hasChanges && !content.includes('from \'../types/direction\'') && 
        !content.includes('from \'../../lib/types/direction\'') &&
        !content.includes('from \'$lib/types/direction\'')) {
      
      // Determine the correct import path based on file location
      let importPath;
      if (filePath.includes('src/components/')) {
        importPath = '$lib/types/direction';
      } else if (filePath.includes('src/lib/algorithms/')) {
        importPath = '../types/direction';
      } else if (filePath.includes('src/lib/')) {
        importPath = './types/direction';
      } else {
        importPath = '../types/direction';
      }
      
      // Find the last import statement and add our import after it
      const importRegex = /^import.*?;$/gm;
      const imports = content.match(importRegex);
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const importIndex = content.lastIndexOf(lastImport);
        const insertIndex = importIndex + lastImport.length;
        content = content.slice(0, insertIndex) + 
          `\nimport { CutDirection, LeadType } from '${importPath}';` + 
          content.slice(insertIndex);
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      fs.writeFileSync(filePath, content);
      migratedFiles++;
      console.log(`✅ Migrated ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed for ${filePath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}: ${error.message}`);
  }
});

console.log(`\n📊 Migration Summary:`);
console.log(`📁 Total test files processed: ${totalFiles}`);
console.log(`✅ Files migrated: ${migratedFiles}`);
console.log(`⏭️  Files skipped: ${totalFiles - migratedFiles}`);

console.log(`\n🔍 Running type check to verify migration...`);
try {
  execSync('npm run validate:svelte', { stdio: 'inherit' });
  console.log(`\n✅ Migration completed successfully!`);
} catch (error) {
  console.log(`\n⚠️  Migration completed but there may be remaining type errors to fix manually.`);
}