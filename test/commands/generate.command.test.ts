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
    });
});
