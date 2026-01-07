import { Logger } from '@nestjs/common';
import { GrpcLogger } from '../../src/utils/logger';
import { GrpcLoggerOptions, GrpcLogLevel } from '../../src/interfaces';

// Mock the NestJS Logger
jest.mock('@nestjs/common', () => ({
    Logger: jest.fn().mockImplementation(() => ({
        debug: jest.fn(),
        verbose: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    })),
}));

describe('GrpcLogger - Comprehensive Tests', () => {
    let logger: GrpcLogger;
    let mockNestLogger: jest.Mocked<Logger>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockNestLogger = {
            debug: jest.fn(),
            verbose: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        } as any;
        (Logger as jest.MockedClass<typeof Logger>).mockReturnValue(mockNestLogger);
    });

    describe('constructor', () => {
        it('should create logger with default options', () => {
            logger = new GrpcLogger();

            expect(Logger).toHaveBeenCalledWith('GrpcModule');
            expect(logger).toBeDefined();
        });

        it('should create logger with custom options', () => {
            const options: GrpcLoggerOptions = {
                enabled: true,
                level: GrpcLogLevel.DEBUG,
                context: 'CustomService',
            };

            logger = new GrpcLogger(options);

            expect(Logger).toHaveBeenCalledWith('CustomService');
        });

        it('should use default values for undefined options', () => {
            const options: GrpcLoggerOptions = {
                context: 'TestService',
                // Other options left undefined
            };

            logger = new GrpcLogger(options);

            expect(Logger).toHaveBeenCalledWith('TestService');
        });

        it('should handle empty options object', () => {
            logger = new GrpcLogger({});

            expect(Logger).toHaveBeenCalledWith('GrpcModule');
        });
    });

    describe('debug method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: GrpcLogLevel.DEBUG, context: 'TestService' });
        });

        it('should log debug message without context', () => {
            logger.debug('Debug message');

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Debug message');
        });

        it('should log debug message with same context', () => {
            logger.debug('Debug message', 'TestService');

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Debug message');
        });

        it('should log debug message with different context', () => {
            logger.debug('Debug message', 'DifferentService');

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Debug message', 'DifferentService');
        });

        it('should not log when level is too high', () => {
            const highLevelLogger = new GrpcLogger({ level: GrpcLogLevel.ERROR });
            highLevelLogger.debug('Should not log');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });

        it('should not log when disabled', () => {
            const disabledLogger = new GrpcLogger({ enabled: false, level: GrpcLogLevel.DEBUG });
            disabledLogger.debug('Should not log');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('verbose method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: GrpcLogLevel.VERBOSE, context: 'TestService' });
        });

        it('should log verbose message without context', () => {
            logger.verbose('Verbose message');

            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Verbose message');
        });

        it('should log verbose message with different context', () => {
            logger.verbose('Verbose message', 'DifferentService');

            expect(mockNestLogger.verbose).toHaveBeenCalledWith(
                'Verbose message',
                'DifferentService',
            );
        });

        it('should not log when level is too high', () => {
            const highLevelLogger = new GrpcLogger({ level: GrpcLogLevel.WARN });
            highLevelLogger.verbose('Should not log');

            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
        });
    });

    describe('log method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: GrpcLogLevel.LOG, context: 'TestService' });
        });

        it('should log message without context', () => {
            logger.log('Log message');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Log message');
        });

        it('should log message with different context', () => {
            logger.log('Log message', 'DifferentService');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Log message', 'DifferentService');
        });

        it('should not log when level is too high', () => {
            const highLevelLogger = new GrpcLogger({ level: GrpcLogLevel.ERROR });
            highLevelLogger.log('Should not log');

            expect(mockNestLogger.log).not.toHaveBeenCalled();
        });
    });

    describe('warn method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: GrpcLogLevel.WARN, context: 'TestService' });
        });

        it('should log warning message without context', () => {
            logger.warn('Warning message');

            expect(mockNestLogger.warn).toHaveBeenCalledWith('Warning message');
        });

        it('should log warning message with different context', () => {
            logger.warn('Warning message', 'DifferentService');

            expect(mockNestLogger.warn).toHaveBeenCalledWith('Warning message', 'DifferentService');
        });

        it('should not log when level is too high', () => {
            const highLevelLogger = new GrpcLogger({ level: GrpcLogLevel.ERROR });
            highLevelLogger.warn('Should not log');

            expect(mockNestLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('error method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: GrpcLogLevel.ERROR, context: 'TestService' });
        });

        it('should log error message without error object', () => {
            logger.error('Error message');

            expect(mockNestLogger.error).toHaveBeenCalledWith('Error message', undefined);
        });

        it('should log error message with Error object', () => {
            const error = new Error('Test error');
            logger.error('Error message', error);

            expect(mockNestLogger.error).toHaveBeenCalledWith('Error message', error.stack);
        });

        it('should log error message with string error', () => {
            logger.error('Error message', 'String error');

            expect(mockNestLogger.error).toHaveBeenCalledWith('Error message', 'String error');
        });

        it('should log error with different context and Error object', () => {
            const error = new Error('Test error');
            logger.error('Error message', error, 'DifferentService');

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Error message',
                error.stack,
                'DifferentService',
            );
        });

        it('should log error with different context and string error', () => {
            logger.error('Error message', 'String error', 'DifferentService');

            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Error message',
                'String error',
                'DifferentService',
            );
        });

        it('should not log when disabled globally', () => {
            const disabledLogger = new GrpcLogger({ enabled: false });
            disabledLogger.error('Should not log');

            expect(mockNestLogger.error).not.toHaveBeenCalled();
        });
    });


    describe('shouldLog private method', () => {
        it('should return false when logger is disabled', () => {
            const disabledLogger = new GrpcLogger({ enabled: false });

            expect((disabledLogger as any).shouldLog(GrpcLogLevel.ERROR)).toBe(false);
        });

        it('should respect log level hierarchy', () => {
            const warnLogger = new GrpcLogger({ level: GrpcLogLevel.WARN });

            expect((warnLogger as any).shouldLog(GrpcLogLevel.DEBUG)).toBe(false);
            expect((warnLogger as any).shouldLog(GrpcLogLevel.VERBOSE)).toBe(false);
            expect((warnLogger as any).shouldLog(GrpcLogLevel.LOG)).toBe(false);
            expect((warnLogger as any).shouldLog(GrpcLogLevel.WARN)).toBe(true);
            expect((warnLogger as any).shouldLog(GrpcLogLevel.ERROR)).toBe(true);
        });

        it('should handle debug level correctly', () => {
            const debugLogger = new GrpcLogger({ level: GrpcLogLevel.DEBUG });

            expect((debugLogger as any).shouldLog(GrpcLogLevel.DEBUG)).toBe(true);
            expect((debugLogger as any).shouldLog(GrpcLogLevel.VERBOSE)).toBe(true);
            expect((debugLogger as any).shouldLog(GrpcLogLevel.LOG)).toBe(true);
            expect((debugLogger as any).shouldLog(GrpcLogLevel.WARN)).toBe(true);
            expect((debugLogger as any).shouldLog(GrpcLogLevel.ERROR)).toBe(true);
        });

        it('should handle error level correctly', () => {
            const errorLogger = new GrpcLogger({ level: GrpcLogLevel.ERROR });

            expect((errorLogger as any).shouldLog(GrpcLogLevel.DEBUG)).toBe(false);
            expect((errorLogger as any).shouldLog(GrpcLogLevel.VERBOSE)).toBe(false);
            expect((errorLogger as any).shouldLog(GrpcLogLevel.LOG)).toBe(false);
            expect((errorLogger as any).shouldLog(GrpcLogLevel.WARN)).toBe(false);
            expect((errorLogger as any).shouldLog(GrpcLogLevel.ERROR)).toBe(true);
        });
    });

    describe('child method', () => {
        it('should create child logger with nested context', () => {
            const parentLogger = new GrpcLogger({ context: 'ParentService' });
            const childLogger = parentLogger.child('ChildComponent');

            expect(Logger).toHaveBeenLastCalledWith('ParentService:ChildComponent');
        });

        it('should inherit parent logger options', () => {
            const parentLogger = new GrpcLogger({
                context: 'ParentService',
                level: GrpcLogLevel.DEBUG,
            });

            const childLogger = parentLogger.child('ChildComponent');

            // Test that child inherits options by checking if it logs at debug level
            childLogger.debug('Test message');
            expect(mockNestLogger.debug).toHaveBeenCalledWith('Test message');
        });

        it('should create multiple child loggers with different contexts', () => {
            const parentLogger = new GrpcLogger({ context: 'MainService' });

            const authChild = parentLogger.child('Auth');
            const dbChild = parentLogger.child('Database');

            expect(Logger).toHaveBeenCalledWith('MainService:Auth');
            expect(Logger).toHaveBeenCalledWith('MainService:Database');
        });

        it('should handle nested child loggers', () => {
            const parentLogger = new GrpcLogger({ context: 'Service' });
            const childLogger = parentLogger.child('Component');
            const grandChildLogger = childLogger.child('SubComponent');

            expect(Logger).toHaveBeenLastCalledWith('Service:Component:SubComponent');
        });
    });

    describe('integration scenarios', () => {
        it('should handle logging with all methods in correct hierarchy', () => {
            const mainLogger = new GrpcLogger({
                level: GrpcLogLevel.DEBUG,
                context: 'GrpcService',
            });

            const authLogger = mainLogger.child('Auth');

            // Test various logging methods
            authLogger.debug('Starting authentication');
            authLogger.verbose('Processing request');
            authLogger.log('User lookup');
            authLogger.warn('No cache hit');
            authLogger.error('Authentication failed', new Error('Invalid token'));

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Starting authentication');
            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Processing request');
            expect(mockNestLogger.log).toHaveBeenCalledWith('User lookup');
            expect(mockNestLogger.warn).toHaveBeenCalledWith('No cache hit');
            expect(mockNestLogger.error).toHaveBeenCalledWith(
                'Authentication failed',
                expect.stringContaining('Invalid token'),
            );
        });

        it('should handle disabled logging correctly', () => {
            const restrictedLogger = new GrpcLogger({
                level: GrpcLogLevel.WARN,
            });

            // These should not log because they are below WARN level
            restrictedLogger.debug('Debug message');
            restrictedLogger.verbose('Verbose message');
            restrictedLogger.log('Log message');

            // Both warn and error should log because they are at or above WARN level
            restrictedLogger.warn('Warning message');
            restrictedLogger.error('Error message');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
            expect(mockNestLogger.log).not.toHaveBeenCalled();
            expect(mockNestLogger.warn).toHaveBeenCalledWith('Warning message');
            expect(mockNestLogger.error).toHaveBeenCalledWith('Error message', undefined);
        });

        it('should log at verbose level when enabled', () => {
            const verboseLogger = new GrpcLogger({ level: GrpcLogLevel.VERBOSE });
            verboseLogger.verbose('Operation in progress');
            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Operation in progress');
        });

        it('should log at debug level when enabled', () => {
            const debugLogger = new GrpcLogger({ level: GrpcLogLevel.DEBUG });
            debugLogger.debug('Debug information');
            expect(mockNestLogger.debug).toHaveBeenCalledWith('Debug information');
        });

        it('should log lifecycle events', () => {
            const lifecycleLogger = new GrpcLogger({ context: 'TestService' });
            lifecycleLogger.log('Service started');
            expect(mockNestLogger.log).toHaveBeenCalledWith('Service started');
        });
    });
});
