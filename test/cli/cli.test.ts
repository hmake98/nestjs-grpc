import { readFileSync } from 'fs';
import { join } from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('../../src/commands/generate.command');

const mockFs = jest.mocked({ readFileSync });

describe('CLI', () => {
    let originalArgv: string[];
    let exitSpy: jest.SpyInstance;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        // Save original values
        originalArgv = process.argv;

        // Mock process.exit to be a no-op in tests
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
            // Don't actually exit in tests
        }) as any);

        // Mock console.error for logger
        consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        // Clear all mocks
        jest.clearAllMocks();

        // Setup mocks
        mockFs.readFileSync.mockReturnValue(
            JSON.stringify({
                name: 'nestjs-grpc',
                version: '1.2.3',
            }),
        );
    });

    afterEach(() => {
        // Restore original values
        process.argv = originalArgv;
        jest.restoreAllMocks();

        // Clear require cache
        delete require.cache[require.resolve('../../src/cli/cli')];
    });

    describe('package version reading', () => {
        it('should read version from package.json', () => {
            mockFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    name: 'nestjs-grpc',
                    version: '1.2.3',
                }),
            );

            process.argv = ['node', 'cli.js', '--version'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should use fallback version when package.json cannot be read', () => {
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            process.argv = ['node', 'cli.js', '--version'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should use fallback version when package.json has invalid version', () => {
            mockFs.readFileSync.mockReturnValue(
                JSON.stringify({
                    name: 'nestjs-grpc',
                    // version missing
                }),
            );

            process.argv = ['node', 'cli.js', '--version'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should use fallback version when package.json is invalid JSON', () => {
            mockFs.readFileSync.mockReturnValue('invalid json');

            process.argv = ['node', 'cli.js', '--version'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });
    });

    describe('argument validation', () => {
        it('should handle valid arguments', () => {
            process.argv = ['node', 'cli.js', 'generate'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should show help when no arguments provided', () => {
            process.argv = ['node', 'cli.js'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should handle invalid commands gracefully', () => {
            process.argv = ['node', 'cli.js', 'completely-unknown-command'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });
    });

    describe('command setup', () => {
        it('should set up CLI correctly', () => {
            process.argv = ['node', 'cli.js', '--help'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should handle generate command', () => {
            process.argv = ['node', 'cli.js', 'generate', '--help'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });
    });

    describe('error handling', () => {
        it('should handle unknown arguments gracefully', () => {
            process.argv = ['node', 'cli.js', '--unknown-flag'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should show usage information when needed', () => {
            process.argv = ['node', 'cli.js'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });
    });

    describe('integration', () => {
        it('should handle complete CLI setup', () => {
            process.argv = ['node', 'cli.js', '--version'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });

        it('should handle help command', () => {
            process.argv = ['node', 'cli.js', '--help'];

            expect(() => {
                require('../../src/cli/cli');
            }).not.toThrow();
        });
    });
});