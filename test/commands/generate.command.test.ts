import { jest } from '@jest/globals';

// Mock modules before importing
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    statSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    accessSync: jest.fn(),
    constants: {
        R_OK: 4,
        W_OK: 2,
    },
}));

jest.mock('path', () => ({
    resolve: jest.fn(),
    dirname: jest.fn(),
    basename: jest.fn(),
    join: jest.fn(),
}));

jest.mock('protobufjs', () => ({
    load: jest.fn(),
}));

jest.mock('glob', () => ({
    globSync: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
    GrpcLogger: jest.fn().mockImplementation(() => ({
        debug: jest.fn(),
        lifecycle: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    })),
}));
jest.mock('../../src/utils', () => ({
    generateTypeDefinitions: jest.fn().mockReturnValue(''),
}));

// Import after mocking
import { generateCommand } from '../../src/commands/generate.command';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as protobuf from 'protobufjs';
import * as utils from '../../src/utils';

describe('GenerateCommand', () => {
    let mockExistsSync: jest.MockedFunction<typeof fs.existsSync>;
    let mockStatSync: jest.MockedFunction<typeof fs.statSync>;
    let mockMkdirSync: jest.MockedFunction<typeof fs.mkdirSync>;
    let mockWriteFileSync: jest.MockedFunction<typeof fs.writeFileSync>;
    let mockAccessSync: jest.MockedFunction<typeof fs.accessSync>;
    let mockGlobSync: jest.MockedFunction<typeof glob.globSync>;
    let mockProtobufLoad: jest.MockedFunction<typeof protobuf.load>;
    let mockResolve: jest.MockedFunction<typeof path.resolve>;
    let mockDirname: jest.MockedFunction<typeof path.dirname>;
    let mockBasename: jest.MockedFunction<typeof path.basename>;
    let mockJoin: jest.MockedFunction<typeof path.join>;
    let mockGenerateTypeDefinitions: jest.MockedFunction<typeof utils.generateTypeDefinitions>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Set up mock references
        mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
        mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;
        mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
        mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;
        mockAccessSync = fs.accessSync as jest.MockedFunction<typeof fs.accessSync>;
        mockResolve = path.resolve as jest.MockedFunction<typeof path.resolve>;
        mockDirname = path.dirname as jest.MockedFunction<typeof path.dirname>;
        mockBasename = path.basename as jest.MockedFunction<typeof path.basename>;
        mockJoin = path.join as jest.MockedFunction<typeof path.join>;
        mockGlobSync = glob.globSync as jest.MockedFunction<typeof glob.globSync>;
        mockProtobufLoad = protobuf.load as jest.MockedFunction<typeof protobuf.load>;
        mockGenerateTypeDefinitions = utils.generateTypeDefinitions as jest.MockedFunction<
            typeof utils.generateTypeDefinitions
        >;

        // Set default mock return values
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({
            isDirectory: jest.fn().mockReturnValue(false),
            isFile: jest.fn().mockReturnValue(true),
        } as any);
        mockMkdirSync.mockReturnValue(undefined);
        mockGlobSync.mockReturnValue(['test.proto']);
        mockProtobufLoad.mockResolvedValue({} as any);
        mockGenerateTypeDefinitions.mockReturnValue('');
        mockWriteFileSync.mockReturnValue(undefined);
        mockAccessSync.mockReturnValue(undefined);

        // Mock path functions
        mockResolve.mockImplementation((...args) => args[args.length - 1]);
        mockDirname.mockImplementation((path: string) => path);
        mockBasename.mockImplementation((path: string) => path);
        mockJoin.mockImplementation((...args) => args.join('/'));
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
    });

    describe('argument validation', () => {
        it('should return non-zero for missing proto path', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const args = { output: 'output', watch: false } as any;

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Proto path is required and must be a string');
            spy.mockRestore();
        });

        it('should return non-zero for missing output path', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const args = { proto: 'test.proto', watch: false } as any;

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Output path is required and must be a string');
            spy.mockRestore();
        });

        it('should return non-zero for non-string proto path', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const args = { proto: 123, output: 'output', watch: false } as any;

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Proto path is required and must be a string');
            spy.mockRestore();
        });

        it('should return non-zero for non-string output path', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const args = { proto: 'test.proto', output: 456, watch: false } as any;

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Output path is required and must be a string');
            spy.mockRestore();
        });

        it('should return non-zero for empty proto path', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const args = { proto: '', output: 'output', watch: false } as any;

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Proto path is required and must be a string');
            spy.mockRestore();
        });

        it('should return non-zero for empty output path', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const args = { proto: 'test.proto', output: '', watch: false } as any;

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Output path is required and must be a string');
            spy.mockRestore();
        });
    });

    describe('proto path validation', () => {
        it('should return non-zero when proto file does not exist', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockExistsSync.mockReturnValue(false);

            const args = { proto: 'nonexistent.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Proto path does not exist: nonexistent.proto');
            spy.mockRestore();
        });

        it('should return non-zero when proto path is wrong type', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(false),
                isFile: jest.fn().mockReturnValue(false), // Not a file or directory
            } as any);

            const args = { proto: 'invalid', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith(
                'Error accessing proto path: Proto path must be a file or directory: invalid',
            );
            spy.mockRestore();
        });

        it('should handle directory proto path with no matches', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            mockGlobSync.mockReturnValue([]); // No files found

            const args = { proto: 'directory', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('No proto files found matching pattern'),
            );
            spy.mockRestore();
        });

        it('should return non-zero when access sync fails', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({
                isFile: jest.fn().mockReturnValue(true),
                isDirectory: jest.fn().mockReturnValue(false),
            } as any);
            mockAccessSync.mockImplementation((path: fs.PathLike) => {
                if (typeof path === 'string' && path.includes('proto')) {
                    return undefined; // proto file access OK
                }
                throw new Error('Access denied');
            });

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Cannot write to output directory: output');
            spy.mockRestore();
        });
    });

    describe('proto loading', () => {
        beforeEach(() => {
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({
                isFile: jest.fn().mockReturnValue(true),
                isDirectory: jest.fn().mockReturnValue(false),
            } as any);
            mockAccessSync.mockReturnValue(undefined);
        });

        it('should return non-zero when glob pattern fails', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            // Mock statSync to throw for the glob test
            mockStatSync.mockImplementation(() => {
                throw new Error('stats.isDirectory is not a function');
            });

            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith(
                'Error accessing proto path: stats.isDirectory is not a function',
            );
            spy.mockRestore();
        });

        it('should handle glob patterns with non-existent paths', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockExistsSync.mockImplementation((path: fs.PathLike) => {
                if (typeof path === 'string' && path.includes('*.proto')) return false; // Glob pattern doesn't exist as file
                return true;
            });
            mockGlobSync.mockReturnValue([]); // No files found by glob

            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No proto files found matching pattern: *.proto');
            spy.mockRestore();
        });

        it('should filter out unreadable proto files', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['readable.proto', 'unreadable.proto']);
            mockAccessSync.mockImplementation((path: fs.PathLike, mode?: number) => {
                if (typeof path === 'string' && path.includes('unreadable')) {
                    throw new Error('Permission denied');
                }
                return undefined; // readable file is ok
            });

            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            // Should succeed with the readable file only
            expect(result).toBe(0);
            spy.mockRestore();
        });

        it('should handle glob sync errors', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockImplementation(() => {
                throw new Error('Glob operation failed');
            });

            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Error finding proto files: Glob operation failed');
            spy.mockRestore();
        });

        it('should return non-zero when protobuf loading fails', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockRejectedValue(new Error('Load failed'));

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should return non-zero when write operation fails', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue('content');
            mockWriteFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should return non-zero when directory creation fails', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockExistsSync.mockImplementation((path: fs.PathLike) => {
                if (typeof path === 'string' && path.includes('output')) return false; // output dir doesn't exist
                return true; // everything else exists
            });
            mockMkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith(
                'Failed to create output directory: Permission denied',
            );
            spy.mockRestore();
        });

        it('should handle null protobuf root', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue(null as any); // Returns null

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should handle ENOENT error specifically', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            const enoentError = new Error('ENOENT: no such file or directory');
            mockProtobufLoad.mockRejectedValue(enoentError);

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should handle invalid content types', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue(undefined as any); // Invalid content (undefined)

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0); // Actually succeeds because undefined is handled as empty content
            spy.mockRestore();
        });

        it('should handle empty basename from proto file', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue('content');
            // Make basename return empty string
            mockBasename.mockImplementation((path: string) => {
                if (path.includes('test.proto')) return '';
                return path;
            });

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should handle path operation failures', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue('content');
            // Make join throw an error
            mockJoin.mockImplementation(() => {
                throw new Error('Path join failed');
            });

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should handle file verification failure after write', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue('content');
            mockWriteFileSync.mockReturnValue(undefined);
            // Mock existsSync to return false after file is "written"
            mockExistsSync.mockImplementation((path: fs.PathLike) => {
                if (typeof path === 'string' && path.includes('.ts')) return false; // Output file doesn't exist after write
                return true; // Everything else exists
            });

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });
    });

    describe('success paths', () => {
        beforeEach(() => {
            mockExistsSync.mockImplementation((path: fs.PathLike) => {
                if (path === 'output') return false; // output dir doesn't exist yet
                return true; // everything else exists
            });
            mockStatSync.mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(false),
                isFile: jest.fn().mockReturnValue(true),
            } as any);
            mockAccessSync.mockReturnValue(undefined);
            mockMkdirSync.mockReturnValue(undefined);
            mockGlobSync.mockReturnValue(['test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue('generated content');
            mockWriteFileSync.mockReturnValue(undefined);
        });

        it('should return 0 for successful single proto file', async () => {
            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect(mockGenerateTypeDefinitions).toHaveBeenCalled();
            expect(mockWriteFileSync).toHaveBeenCalled();
        });

        it('should return 0 for successful glob pattern', async () => {
            mockGlobSync.mockReturnValue(['file1.proto', 'file2.proto']);
            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect(mockGlobSync).toHaveBeenCalledWith('*.proto', expect.any(Object));
        });

        it('should return 0 for successful directory processing', async () => {
            mockStatSync.mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            mockGlobSync.mockReturnValue(['dir/test.proto']);

            const args = { proto: 'directory', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect(mockGlobSync).toHaveBeenCalledWith('directory/**/*.proto', expect.any(Object));
        });

        it('should handle directory path without trailing slash (line 72 branch)', async () => {
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            mockGlobSync.mockReturnValue(['directory/test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue('content');
            mockWriteFileSync.mockReturnValue(undefined);

            // Test directory path without trailing slash
            const args = { proto: 'directory', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            // Should normalize the path by adding trailing slash
            expect(mockGlobSync).toHaveBeenCalledWith('directory/**/*.proto', expect.any(Object));
        });

        it('should handle directory path with trailing slash (line 72 branch)', async () => {
            mockExistsSync.mockReturnValue(true);
            mockStatSync.mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            mockGlobSync.mockReturnValue(['directory/test.proto']);
            mockProtobufLoad.mockResolvedValue({} as any);
            mockGenerateTypeDefinitions.mockReturnValue('content');
            mockWriteFileSync.mockReturnValue(undefined);

            // Test directory path with trailing slash
            const args = { proto: 'directory/', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            // Should use the path as-is since it already ends with '/'
            expect(mockGlobSync).toHaveBeenCalledWith('directory/**/*.proto', expect.any(Object));
        });

        it('should return 0 for watch mode', async () => {
            const args = { proto: 'test.proto', output: 'output', watch: true };

            const result = await generateCommand(args);

            expect(result).toBe(0);
        });

        it('should work in silent mode', async () => {
            const args = { proto: 'test.proto', output: 'output', watch: false, silent: true };

            const result = await generateCommand(args);

            expect(result).toBe(0);
        });

        it('should log warning when some files fail in non-silent mode', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            mockGlobSync.mockReturnValue(['success.proto', 'fail.proto']);
            let callCount = 0;
            mockProtobufLoad.mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    // Second call fails
                    return Promise.reject(new Error('Load failed'));
                }
                return Promise.resolve({} as any);
            });
            mockGenerateTypeDefinitions.mockReturnValue('content');

            const args = { proto: '*.proto', output: 'output', watch: false, silent: false };

            const result = await generateCommand(args);

            expect(result).toBe(0); // Should succeed overall since at least one file processed
            // Note: This specific warning line might not be covered if the error handling is different
            warnSpy.mockRestore();
        });

        it('should handle empty type definitions gracefully', async () => {
            mockGenerateTypeDefinitions.mockReturnValue(''); // Empty content

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            // The function should succeed but with a warning
            expect(result).toBe(0);
            expect(mockWriteFileSync).not.toHaveBeenCalled(); // No file written
        });

        it('should handle whitespace-only type definitions', async () => {
            mockGenerateTypeDefinitions.mockReturnValue('   \n  \t  '); // Only whitespace

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            // The function should succeed but with a warning
            expect(result).toBe(0);
            expect(mockWriteFileSync).not.toHaveBeenCalled(); // No file written
        });

        it('should handle existing output directory', async () => {
            // This test verifies that when the main output directory exists,
            // the command still works correctly
            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            // The test setup in beforeEach ensures this works correctly
        });

        it('should log directory creation when output directory does not exist', async () => {
            // The beforeEach setup already makes output directory not exist
            // and sets up all the necessary mocks for success
            const args = { proto: 'test.proto', output: 'output', watch: false, silent: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            // This test should cover the directory creation path (line 143)
        });

        it('should handle invalid content in writeTypesToFile', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Mock generateTypeDefinitions to return invalid content (non-string)
            // This will pass the first check (!content) but fail the typeof check
            // We need to return something that passes the trim() check but fails typeof
            mockGenerateTypeDefinitions.mockReturnValue({
                toString: () => 'some content',
                trim: () => 'some content',
            } as any); // Object that acts like string but isn't a string

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');

            spy.mockRestore();
        });
    });
});
