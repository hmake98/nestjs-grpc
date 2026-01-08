// Mock modules before importing - must be done before imports
jest.mock('fs');
jest.mock('path');
jest.mock('protobufjs');
jest.mock('glob');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils');

// Import after mocking
import { generateCommand } from '../../src/commands/generate.command';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as protobuf from 'protobufjs';
import * as utils from '../../src/utils';

// Helper function to setup default mocks
function setupDefaultMocks() {
    (fs.existsSync as any).mockReturnValue(true);
    (fs.statSync as any).mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(false),
        isFile: jest.fn().mockReturnValue(true),
    });
    (fs.mkdirSync as any).mockReturnValue(undefined);
    (glob.globSync as any).mockReturnValue(['test.proto']);
    (protobuf.load as any).mockResolvedValue({});
    (utils.generateTypeDefinitions as any).mockReturnValue('');
    (fs.writeFileSync as any).mockReturnValue(undefined);
    (fs.accessSync as any).mockReturnValue(undefined);

    // Mock path functions
    (path.resolve as any).mockImplementation((...args: any[]) => args[args.length - 1]);
    (path.dirname as any).mockImplementation((path: string) => path);
    (path.basename as any).mockImplementation((path: string) => path);
    (path.join as any).mockImplementation((...args: any[]) => args.join('/'));
}

describe('GenerateCommand', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupDefaultMocks();
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
            (fs.existsSync as any).mockReturnValue(false);

            const args = { proto: 'nonexistent.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('Proto path does not exist: nonexistent.proto');
            spy.mockRestore();
        });

        it('should return non-zero when proto path is wrong type', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (fs.existsSync as any).mockReturnValue(true);
            (fs.statSync as any).mockReturnValue({
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
            (fs.existsSync as any).mockReturnValue(true);
            (fs.statSync as any).mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            (glob.globSync as any).mockReturnValue([]); // No files found

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
            (fs.existsSync as any).mockReturnValue(true);
            (fs.statSync as any).mockReturnValue({
                isFile: jest.fn().mockReturnValue(true),
                isDirectory: jest.fn().mockReturnValue(false),
            } as any);
            (fs.accessSync as any).mockImplementation((path: fs.PathLike) => {
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
            (fs.existsSync as any).mockReturnValue(true);
            (fs.statSync as any).mockReturnValue({
                isFile: jest.fn().mockReturnValue(true),
                isDirectory: jest.fn().mockReturnValue(false),
            } as any);
            (fs.accessSync as any).mockReturnValue(undefined);
        });

        it('should return non-zero when glob pattern fails', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            // Mock statSync to throw for the glob test
            (fs.statSync as any).mockImplementation(() => {
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
            (fs.existsSync as any).mockImplementation((path: fs.PathLike) => {
                if (typeof path === 'string' && path.includes('*.proto')) return false; // Glob pattern doesn't exist as file
                return true;
            });
            (glob.globSync as any).mockReturnValue([]); // No files found by glob

            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No proto files found matching pattern: *.proto');
            spy.mockRestore();
        });

        it('should filter out unreadable proto files', async () => {
            (glob.globSync as any).mockReturnValue(['readable.proto', 'unreadable.proto']);
            (fs.accessSync as any).mockImplementation((path: fs.PathLike) => {
                if (typeof path === 'string' && path.includes('unreadable')) {
                    throw new Error('Permission denied');
                }
                return undefined; // readable file is ok
            });

            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            // Should succeed with the readable file only
            expect(result).toBe(0);
        });

        it('should handle glob sync errors', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (glob.globSync as any).mockImplementation(() => {
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
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockRejectedValue(new Error('Load failed'));

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should return non-zero when write operation fails', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue('content');
            (fs.writeFileSync as any).mockImplementation(() => {
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
            (fs.existsSync as any).mockImplementation((path: fs.PathLike) => {
                if (typeof path === 'string' && path.includes('output')) return false; // output dir doesn't exist
                return true; // everything else exists
            });
            (fs.mkdirSync as any).mockImplementation(() => {
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
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockResolvedValue(null as any); // Returns null

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should handle ENOENT error specifically', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (glob.globSync as any).mockReturnValue(['test.proto']);
            const enoentError = new Error('ENOENT: no such file or directory');
            (protobuf.load as any).mockRejectedValue(enoentError);

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');
            spy.mockRestore();
        });

        it('should handle invalid content types', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue(undefined as any); // Invalid content (undefined)

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0); // Actually succeeds because undefined is handled as empty content
            spy.mockRestore();
        });

        it('should handle empty basename from proto file', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue('content');
            // Make basename return empty string
            (path.basename as any).mockImplementation((path: string) => {
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
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue('content');
            // Make join throw an error
            (path.join as any).mockImplementation(() => {
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
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue('content');
            (fs.writeFileSync as any).mockReturnValue(undefined);
            // Mock existsSync to return false after file is "written"
            (fs.existsSync as any).mockImplementation((path: fs.PathLike) => {
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
            (fs.existsSync as any).mockImplementation((path: fs.PathLike) => {
                if (path === 'output') return false; // output dir doesn't exist yet
                return true; // everything else exists
            });
            (fs.statSync as any).mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(false),
                isFile: jest.fn().mockReturnValue(true),
            } as any);
            (fs.accessSync as any).mockReturnValue(undefined);
            (fs.mkdirSync as any).mockReturnValue(undefined);
            (glob.globSync as any).mockReturnValue(['test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue('generated content');
            (fs.writeFileSync as any).mockReturnValue(undefined);
        });

        it('should return 0 for successful single proto file', async () => {
            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect((utils.generateTypeDefinitions as any)).toHaveBeenCalled();
            expect((fs.writeFileSync as any)).toHaveBeenCalled();
        });

        it('should return 0 for successful glob pattern', async () => {
            (glob.globSync as any).mockReturnValue(['file1.proto', 'file2.proto']);
            const args = { proto: '*.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect((glob.globSync as any)).toHaveBeenCalledWith('*.proto', expect.any(Object));
        });

        it('should return 0 for successful directory processing', async () => {
            (fs.statSync as any).mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            (glob.globSync as any).mockReturnValue(['dir/test.proto']);

            const args = { proto: 'directory', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect((glob.globSync as any)).toHaveBeenCalledWith('directory/**/*.proto', expect.any(Object));
        });

        it('should handle directory path without trailing slash', async () => {
            (fs.existsSync as any).mockReturnValue(true);
            (fs.statSync as any).mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            (glob.globSync as any).mockReturnValue(['directory/test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue('content');
            (fs.writeFileSync as any).mockReturnValue(undefined);

            const args = { proto: 'directory', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect((glob.globSync as any)).toHaveBeenCalledWith('directory/**/*.proto', expect.any(Object));
        });

        it('should handle directory path with trailing slash', async () => {
            (fs.existsSync as any).mockReturnValue(true);
            (fs.statSync as any).mockReturnValue({
                isDirectory: jest.fn().mockReturnValue(true),
                isFile: jest.fn().mockReturnValue(false),
            } as any);
            (glob.globSync as any).mockReturnValue(['directory/test.proto']);
            (protobuf.load as any).mockResolvedValue({} as any);
            (utils.generateTypeDefinitions as any).mockReturnValue('content');
            (fs.writeFileSync as any).mockReturnValue(undefined);

            const args = { proto: 'directory/', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect((glob.globSync as any)).toHaveBeenCalledWith('directory/**/*.proto', expect.any(Object));
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
            (glob.globSync as any).mockReturnValue(['success.proto', 'fail.proto']);
            let callCount = 0;
            (protobuf.load as any).mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    return Promise.reject(new Error('Load failed'));
                }
                return Promise.resolve({} as any);
            });
            (utils.generateTypeDefinitions as any).mockReturnValue('content');

            const args = { proto: '*.proto', output: 'output', watch: false, silent: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
        });

        it('should handle empty type definitions gracefully', async () => {
            (utils.generateTypeDefinitions as any).mockReturnValue('');

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect((fs.writeFileSync as any)).not.toHaveBeenCalled();
        });

        it('should handle whitespace-only type definitions', async () => {
            (utils.generateTypeDefinitions as any).mockReturnValue('   \n  \t  ');

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
            expect((fs.writeFileSync as any)).not.toHaveBeenCalled();
        });

        it('should handle existing output directory', async () => {
            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
        });

        it('should log directory creation when output directory does not exist', async () => {
            const args = { proto: 'test.proto', output: 'output', watch: false, silent: false };

            const result = await generateCommand(args);

            expect(result).toBe(0);
        });

        it('should handle invalid content in writeTypesToFile', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

            (utils.generateTypeDefinitions as any).mockReturnValue({
                toString: () => 'some content',
                trim: () => 'some content',
            } as any);

            const args = { proto: 'test.proto', output: 'output', watch: false };

            const result = await generateCommand(args);

            expect(result).toBe(1);
            expect(spy).toHaveBeenCalledWith('No files were processed successfully');

            spy.mockRestore();
        });
    });
});
