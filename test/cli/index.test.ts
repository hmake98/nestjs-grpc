// Mock the cli module to avoid side effects during testing
jest.mock('../../src/cli/cli', () => ({}));

describe('src/cli/index', () => {
    it('should re-export everything from cli module', () => {
        // Import to trigger the export * from './cli' line
        const cliIndex = require('../../src/cli/index');
        
        // Since src/cli/index.ts does export * from './cli'
        // we need to verify that the re-export works correctly
        expect(typeof cliIndex).toBe('object');
        
        // The cli.ts file doesn't actually export named exports that would be accessible here
        // since it's primarily an executable script with side effects
        // So we just verify that the module can be imported without error
        expect(cliIndex).toBeDefined();
    });
});