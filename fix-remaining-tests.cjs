#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Get files with remaining errors
const errorFiles = [
  'src/lib/cam/path-generator.test.ts',
  'src/lib/stores/chains.test.ts', 
  'src/lib/utils/geometric-operations.ellipse.test.ts'
];

console.log('Fixing import path issues...');

errorFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix incorrect import paths
    content = content.replace(/from '\.\/types\/direction'/g, "from '../types/direction'");
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${filePath}`);
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
  }
});

// Now fix the function signature issues in lead test files
const leadTestFiles = [
  'src/lib/algorithms/lead-adler-part5.test.ts',
  'src/lib/algorithms/lead-calculation.test.ts',
  'src/lib/algorithms/lead-concave-fix.test.ts',
  'src/lib/algorithms/lead-solid-area-improved.test.ts',
  'src/lib/algorithms/lead-solid-area.test.ts',
  'src/lib/algorithms/lead-tangency.test.ts',
  'src/lib/algorithms/lead-debug-geometry.test.ts'
];

console.log('\nFixing function signature issues...');

leadTestFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    // Fix calculateLeads calls that have part in wrong position
    // Pattern: calculateLeads(chain, leadIn, leadOut, part)
    // Should be: calculateLeads(chain, leadIn, leadOut, CutDirection.NONE, part)
    
    const regex = /calculateLeads\(([^,]+),\s*([^,]+),\s*([^,]+),\s*(part[^,)]*)\)/g;
    const newContent = content.replace(regex, 'calculateLeads($1, $2, $3, CutDirection.NONE, $4)');
    
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`✅ Fixed function signatures in ${filePath}`);
    }
    
    if (hasChanges) {
      fs.writeFileSync(filePath, content);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
  }
});

// Fix the string array issue
console.log('\nFixing string array issues...');

const stringArrayFiles = [
  'src/lib/algorithms/lead-adler-cut-direction.test.ts'
];

stringArrayFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the cutDirections array
    content = content.replace(
      /const cutDirections = \['clockwise', 'counterclockwise'\]/g,
      'const cutDirections = [CutDirection.CLOCKWISE, CutDirection.COUNTERCLOCKWISE]'
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed string arrays in ${filePath}`);
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
  }
});

// Fix the SimulateStage test type issue
console.log('\nFixing SimulateStage test type issues...');

try {
  let content = fs.readFileSync('src/components/stages/SimulateStage.cut-direction.test.ts', 'utf8');
  
  // Fix the incorrect type assignment
  content = content.replace(/type: LeadType\.LINE/g, "type: 'line'");
  
  fs.writeFileSync('src/components/stages/SimulateStage.cut-direction.test.ts', content);
  console.log(`✅ Fixed SimulateStage test type issue`);
} catch (error) {
  console.error(`❌ Error fixing SimulateStage test: ${error.message}`);
}

console.log('\n🔍 Running type check to verify fixes...');
try {
  execSync('npm run validate:svelte', { stdio: 'inherit' });
  console.log(`\n✅ All test migration fixes completed successfully!`);
} catch (error) {
  console.log(`\n⚠️  Some errors may remain. Check the output above for details.`);
}