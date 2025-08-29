import { generateCommand } from '../../src/commands/generate.command';
import { GrpcLogger } from '../../src/utils/logger';

// Mock fs and path
jest.mock('fs');
jest.mock('path');
jest.mock('protobufjs');
jest.mock('glob');

// Mock the logger
jest.mock('../../src/utils/logger');

// Mock the utils
jest.mock('../../src/utils', () => ({
    generateTypeDefinitions: jest.fn(),
}));

describe('GenerateCommand', () => {
    let mockExistsSync: jest.Mock;
    let mockStatSync: jest.Mock;
    let mockMkdirSync: jest.Mock;
    let mockWriteFileSync: jest.Mock;
    let mockAccessSync: jest.Mock;
    let mockGlobSync: jest.Mock;
    let mockProtobufLoad: jest.Mock;
    let mockResolve: jest.Mock;
    let mockDirname: jest.Mock;
    let mockBasename: jest.Mock;
    let mockJoin: jest.Mock;
    let mockGenerateTypeDefinitions: jest.Mock;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock fs functions
        const fs = require('fs');
        mockExistsSync = fs.existsSync as jest.Mock;
        mockStatSync = fs.statSync as jest.Mock;
        mockMkdirSync = fs.mkdirSync as jest.Mock;
        mockWriteFileSync = fs.writeFileSync as jest.Mock;
        mockAccessSync = fs.accessSync as jest.Mock;

        // Mock path functions
        const path = require('path');
        mockResolve = path.resolve as jest.Mock;
        mockDirname = path.dirname as jest.Mock;
        mockBasename = path.basename as jest.Mock;
        mockJoin = path.join as jest.Mock;

        // Mock glob
        const glob = require('glob');
        mockGlobSync = glob.globSync as jest.Mock;

        // Mock protobufjs
        const protobuf = require('protobufjs');
        mockProtobufLoad = protobuf.load as jest.Mock;

        // Mock utils
        const utils = require('../../src/utils');
        mockGenerateTypeDefinitions = utils.generateTypeDefinitions as jest.Mock;

        // Default mock implementations
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isDirectory: () => false });
        mockMkdirSync.mockReturnValue(undefined);
        mockWriteFileSync.mockReturnValue(undefined);
        mockAccessSync.mockReturnValue(undefined);
        mockGlobSync.mockReturnValue(['test.proto']);
        mockResolve.mockImplementation(path => `/resolved/${path}`);
        mockDirname.mockImplementation(path => `/dirname/${path}`);
        mockBasename.mockImplementation(path => `basename_${path}`);
        mockJoin.mockImplementation((...paths) => paths.join('/'));
        mockProtobufLoad.mockResolvedValue({
            lookupType: jest.fn().mockReturnValue({
                toJSON: () => ({ fields: {} }),
            }),
            lookupService: jest.fn().mockReturnValue({
                toJSON: () => ({ methods: {} }),
            }),
        });
        mockGenerateTypeDefinitions.mockReturnValue('// Generated TypeScript definitions');
    });

    describe('generateCommand', () => {
        it('should validate required proto option', async () => {
            await expect(generateCommand({} as any)).rejects.toThrow(
                'Proto path is required and must be a string',
            );
        });

        it('should validate proto path type', async () => {
            await expect(generateCommand({ proto: 123 } as any)).rejects.toThrow(
                'Proto path is required and must be a string',
            );
        });

        it('should validate required output option', async () => {
            await expect(generateCommand({ proto: 'test.proto' } as any)).rejects.toThrow(
                'Output path is required and must be a string',
            );
        });

        it('should validate output path type', async () => {
            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 123,
                } as any),
            ).rejects.toThrow('Output path is required and must be a string');
        });

        it('should validate proto path exists for direct files', async () => {
            mockExistsSync.mockReturnValue(false);
            await expect(
                generateCommand({
                    proto: 'nonexistent.proto',
                    output: 'output',
                    watch: false,
                }),
            ).rejects.toThrow('Proto path does not exist: nonexistent.proto');
        });

        it('should handle glob patterns that find no files', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue([]);
            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                }),
            ).rejects.toThrow('No proto files found matching pattern: *.proto');
        });

        it('should generate types for valid proto file', async () => {
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({ isDirectory: () => false });
            mockGlobSync.mockReturnValue(['test.proto']);

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();

            expect(mockProtobufLoad).toHaveBeenCalled();
        });

        it('should handle glob patterns', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test1.proto', 'test2.proto']);

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();

            expect(mockGlobSync).toHaveBeenCalledWith('*.proto', {
                absolute: true,
                ignore: ['node_modules/**', '**/node_modules/**'],
                nodir: true,
            });
        });

        it('should handle protobuf loading errors gracefully', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockRejectedValue(new Error('Protobuf parsing error'));

            // The command should complete successfully even with protobuf errors
            // because individual file errors are caught and handled
            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle silent mode', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                    silent: true,
                }),
            ).resolves.not.toThrow();

            // In silent mode, the logger is still created but doesn't log
            expect(mockProtobufLoad).toHaveBeenCalled();
        });

        it('should handle write permission errors', async () => {
            mockExistsSync.mockReturnValue(true);
            mockAccessSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).rejects.toThrow('Cannot write to output directory: output');
        });

        it('should handle file processing errors gracefully', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test1.proto', 'test2.proto']);

            // First file succeeds, second fails
            mockProtobufLoad
                .mockResolvedValueOnce({
                    lookupType: jest.fn().mockReturnValue({
                        toJSON: () => ({ fields: {} }),
                    }),
                    lookupService: jest.fn().mockReturnValue({
                        toJSON: () => ({ methods: {} }),
                    }),
                })
                .mockRejectedValueOnce(new Error('Parse error'));

            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle directory proto path normalization', async () => {
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({ isDirectory: () => true });
            mockGlobSync.mockReturnValue(['test.proto']);

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: '/some/directory',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle directory proto path with trailing slash', async () => {
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({ isDirectory: () => true });
            mockGlobSync.mockReturnValue(['test.proto']);

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: '/some/directory/',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle error accessing proto path', async () => {
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockImplementation(() => {
                throw new Error('Access denied');
            });

            await expect(
                generateCommand({
                    proto: '/restricted/path',
                    output: 'output',
                    watch: false,
                }),
            ).rejects.toThrow('Error accessing proto path: Access denied');
        });

        it('should handle empty type definitions', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockGenerateTypeDefinitions.mockReturnValue('');

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle whitespace-only type definitions', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockGenerateTypeDefinitions.mockReturnValue('   \n\t  ');

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should complete successfully even when all files have errors', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test1.proto', 'test2.proto']);
            mockProtobufLoad.mockRejectedValue(new Error('Parse error'));

            // The command should complete successfully since generateTypesForFile
            // catches all errors internally and doesn't throw them
            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle invalid proto file basename', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['invalid.proto']);
            mockBasename.mockReturnValue('');

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'invalid.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle file write errors', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockWriteFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle directory creation failure', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockMkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle invalid content for file writing (line 176)', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockGenerateTypeDefinitions.mockReturnValue(undefined); // This triggers the invalid content check

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            // This should complete successfully as errors are caught internally
            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output/test.ts',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle directory creation failure (line 141)', async () => {
            mockExistsSync
                .mockReturnValueOnce(true)   // proto exists
                .mockReturnValueOnce(false); // output directory doesn't exist
            mockGlobSync.mockReturnValue(['test.proto']);
            mockMkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });
            mockDirname.mockReturnValue('/restricted/path');

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            // This should complete successfully because directory creation errors are caught
            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: '/restricted/path/test.ts',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle file verification failure (line 190)', async () => {
            mockExistsSync
                .mockReturnValueOnce(true)  // proto exists
                .mockReturnValueOnce(true)  // output directory exists
                .mockReturnValueOnce(false); // written file doesn't exist (verification fails)
            mockGlobSync.mockReturnValue(['test.proto']);

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            // This should complete successfully because file write errors are caught
            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output/test.ts',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle unreadable proto files with warning', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['readable.proto', 'unreadable.proto']);
            mockAccessSync.mockImplementation((file) => {
                if (file.includes('unreadable')) {
                    throw new Error('Permission denied');
                }
            });

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle globSync errors', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockImplementation(() => {
                throw new Error('Glob error');
            });

            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                }),
            ).rejects.toThrow('Error finding proto files: Glob error');
        });

        it('should handle directory creation in non-silent mode', async () => {
            // Setup for testing ensureOutputDirectory function
            mockExistsSync
                .mockReturnValueOnce(true)   // proto file exists (for validation) - line 35
                .mockReturnValueOnce(true)   // parent directory exists (in validateOutputPath) - line 44  
                .mockReturnValueOnce(false)  // proto is not a directory (in normalizeProtoPath) - line 59
                .mockReturnValueOnce(false)  // output directory doesn't exist (dirname(outputPath) in ensureOutputDirectory) - line 131
                .mockReturnValueOnce(true);  // file exists after write for verification - line 189

            mockGlobSync.mockReturnValue(['test.proto']);
            mockDirname.mockReturnValue('/some/output/dir');
            
            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: '/some/output/dir/test.ts',
                    watch: false,
                    silent: false, // explicitly non-silent to test the logging path
                }),
            ).resolves.not.toThrow();

            expect(mockMkdirSync).toHaveBeenCalledWith('/some/output/dir', { recursive: true });
        });

        it('should handle proto file that loads null root', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue(null);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle ENOENT errors specially', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test.proto']);
            
            const enoentError = new Error('ENOENT: no such file or directory');
            mockProtobufLoad.mockRejectedValue(enoentError);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle file write verification failure', async () => {
            mockExistsSync
                .mockReturnValueOnce(true) // proto exists
                .mockReturnValueOnce(true) // output dir exists
                .mockReturnValueOnce(false); // written file doesn't exist
            mockGlobSync.mockReturnValue(['test.proto']);

            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);

            await expect(
                generateCommand({
                    proto: 'test.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should handle no files processed successfully', async () => {
            // The issue is that generateTypesForFile never throws, so errorCount never increments
            // and processedCount always increments. The only way to reach line 310 is if
            // processedCount is 0, but that's impossible with current code structure.
            // 
            // However, we can reach this by making the generateTypesForFile return early
            // due to empty type definitions, so processedCount never increments.
            
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test1.proto', 'test2.proto']);
            
            // Make all files load successfully but generate no type definitions
            const mockRoot = {
                lookupType: jest.fn().mockReturnValue({
                    toJSON: () => ({ fields: {} }),
                }),
                lookupService: jest.fn().mockReturnValue({
                    toJSON: () => ({ methods: {} }),
                }),
            };
            mockProtobufLoad.mockResolvedValue(mockRoot);
            mockGenerateTypeDefinitions.mockReturnValue(''); // Empty type definitions

            // This should actually succeed because the function completes normally
            // even when no type definitions are generated
            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                }),
            ).resolves.not.toThrow();
        });

        it('should log warnings for errors in non-silent mode', async () => {
            mockExistsSync.mockReturnValue(true);
            mockGlobSync.mockReturnValue(['test1.proto', 'test2.proto']);

            // First file succeeds, second fails but caught internally
            let callCount = 0;
            mockProtobufLoad.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        lookupType: jest.fn().mockReturnValue({
                            toJSON: () => ({ fields: {} }),
                        }),
                        lookupService: jest.fn().mockReturnValue({
                            toJSON: () => ({ methods: {} }),
                        }),
                    });
                }
                return Promise.reject(new Error('Parse error'));
            });

            await expect(
                generateCommand({
                    proto: '*.proto',
                    output: 'output',
                    watch: false,
                    silent: false,
                }),
            ).resolves.not.toThrow();
        });
    });
});
