const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Return tests sorted by file path alphabetically
    return Array.from(tests).sort((testA, testB) => {
      // Force inventory-gl-lifecycle to run before inventory-fuzz
      const pathA = testA.path;
      const pathB = testB.path;
      
      if (pathA.includes('inventory-gl-lifecycle') && pathB.includes('inventory-fuzz')) return -1;
      if (pathB.includes('inventory-gl-lifecycle') && pathA.includes('inventory-fuzz')) return 1;
      
      return pathA > pathB ? 1 : -1;
    });
  }
}

module.exports = CustomSequencer;
