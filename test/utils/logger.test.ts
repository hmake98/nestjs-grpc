import { GrpcLogger } from '../../src/utils/logger';
import { Logger } from '@nestjs/common';

// Mock the NestJS Logger
jest.mock('@nestjs/common', () => ({
    ...jest.requireActual('@nestjs/common'),
    Logger: jest.fn().mockImplementation(() => ({
        debug: jest.fn(),
        verbose: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    })),
}));

describe('GrpcLogger', () => {
    let mockLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        // Create a fresh mock for each test
        mockLogger = {
            debug: jest.fn(),
            verbose: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        } as any;

        (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create logger with default options', () => {
            const logger = new GrpcLogger();
            expect(logger.getOptions()).toMatchObject({
                enabled: true,
                level: 'log',
                context: 'GrpcModule',
                debug: false,
                logErrors: true,
                logPerformance: false,
                logDetails: false,
            });
        });

        it('should create logger with custom options', () => {
            const options = {
                enabled: false,
                level: 'debug' as const,
                context: 'TestModule',
                logErrors: false,
                logPerformance: true,
                logDetails: true,
            };

            const logger = new GrpcLogger(options);
            expect(logger.getOptions()).toMatchObject(options);
        });

        it('should handle legacy debug option', () => {
            const logger = new GrpcLogger({ debug: true });
            expect(logger.getOptions().level).toBe('debug');
        });
    });

    describe('logging methods', () => {
        it('should log debug messages when level is debug', () => {
            const logger = new GrpcLogger({ level: 'debug' });
            logger.debug('Test debug message');

            expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message', undefined);
        });

        it('should not log debug messages when level is log', () => {
            const logger = new GrpcLogger({ level: 'log' });
            logger.debug('Test debug message');

            // Should not log debug when level is higher
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });

        it('should log error messages when logErrors is true', () => {
            const logger = new GrpcLogger({ logErrors: true });
            logger.error('Test error message');

            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should not log error messages when logErrors is false', () => {
            const logger = new GrpcLogger({ logErrors: false });
            logger.error('Test error message');

            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should not log when disabled', () => {
            const logger = new GrpcLogger({ enabled: false });
            logger.log('Test message');
            logger.error('Test error');
            logger.warn('Test warning');

            expect(mockLogger.log).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('performance logging', () => {
        it('should log performance when enabled', () => {
            const logger = new GrpcLogger({
                logPerformance: true,
                level: 'verbose',
            });

            logger.performance('Test operation', 100);
            expect(mockLogger.verbose).toHaveBeenCalled();
        });

        it('should not log performance when disabled', () => {
            const logger = new GrpcLogger({ logPerformance: false });
            logger.performance('Test operation', 100);
            expect(mockLogger.verbose).not.toHaveBeenCalled();
        });
    });

    describe('detailed logging', () => {
        it('should log details when enabled and level is debug', () => {
            const logger = new GrpcLogger({
                logDetails: true,
                level: 'debug',
            });

            logger.detail('Test detail', { key: 'value' });
            expect(mockLogger.debug).toHaveBeenCalled();
        });

        it('should not log details when disabled', () => {
            const logger = new GrpcLogger({
                logDetails: false,
                level: 'debug',
            });

            logger.detail('Test detail', { key: 'value' });
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('child logger', () => {
        it('should create child logger with extended context', () => {
            const parent = new GrpcLogger({ context: 'Parent' });
            const child = parent.child('Child');

            expect(child.getOptions().context).toBe('Parent:Child');
        });

        it('should inherit parent options', () => {
            const parent = new GrpcLogger({
                level: 'debug',
                logPerformance: true,
            });
            const child = parent.child('Child');

            expect(child.getOptions().level).toBe('debug');
            expect(child.getOptions().logPerformance).toBe(true);
        });
    });

    describe('utility methods', () => {
        it('should return correct enabled status', () => {
            const enabledLogger = new GrpcLogger({ enabled: true });
            const disabledLogger = new GrpcLogger({ enabled: false });

            expect(enabledLogger.isEnabled()).toBe(true);
            expect(disabledLogger.isEnabled()).toBe(false);
        });

        it('should return correct error logging status', () => {
            const logger = new GrpcLogger({ logErrors: false });
            expect(logger.isErrorLoggingEnabled()).toBe(false);
        });

        it('should return correct performance logging status', () => {
            const logger = new GrpcLogger({ logPerformance: true });
            expect(logger.isPerformanceLoggingEnabled()).toBe(true);
        });

        it('should return correct detail logging status', () => {
            const logger = new GrpcLogger({ logDetails: true });
            expect(logger.isDetailLoggingEnabled()).toBe(true);
        });
    });
});
