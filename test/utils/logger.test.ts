import { Logger } from '@nestjs/common';
import { GrpcLogger } from '../../src/utils/logger';
import { GrpcLoggerOptions } from '../../src/interfaces';

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
                level: 'debug',
                context: 'CustomService',
                logErrors: false,
                logPerformance: true,
                logDetails: true,
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
            logger = new GrpcLogger({ level: 'debug', context: 'TestService' });
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
            const highLevelLogger = new GrpcLogger({ level: 'error' });
            highLevelLogger.debug('Should not log');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });

        it('should not log when disabled', () => {
            const disabledLogger = new GrpcLogger({ enabled: false, level: 'debug' });
            disabledLogger.debug('Should not log');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('verbose method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: 'verbose', context: 'TestService' });
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
            const highLevelLogger = new GrpcLogger({ level: 'warn' });
            highLevelLogger.verbose('Should not log');

            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
        });
    });

    describe('log method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: 'log', context: 'TestService' });
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
            const highLevelLogger = new GrpcLogger({ level: 'error' });
            highLevelLogger.log('Should not log');

            expect(mockNestLogger.log).not.toHaveBeenCalled();
        });
    });

    describe('warn method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: 'warn', context: 'TestService' });
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
            const highLevelLogger = new GrpcLogger({ level: 'error' });
            highLevelLogger.warn('Should not log');

            expect(mockNestLogger.warn).not.toHaveBeenCalled();
        });
    });

    describe('error method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: 'error', logErrors: true, context: 'TestService' });
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

        it('should not log when logErrors is disabled', () => {
            const noErrorLogger = new GrpcLogger({ logErrors: false });
            noErrorLogger.error('Should not log');

            expect(mockNestLogger.error).not.toHaveBeenCalled();
        });

        it('should not log when disabled globally', () => {
            const disabledLogger = new GrpcLogger({ enabled: false });
            disabledLogger.error('Should not log');

            expect(mockNestLogger.error).not.toHaveBeenCalled();
        });
    });

    describe('performance method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({
                level: 'verbose',
                logPerformance: true,
                context: 'TestService',
            });
        });

        it('should log performance message without context', () => {
            logger.performance('Database query', 150);

            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Database query (150ms)');
        });

        it('should log performance message with context', () => {
            logger.performance('Database query', 150, 'DatabaseService');

            expect(mockNestLogger.verbose).toHaveBeenCalledWith(
                'Database query (150ms)',
                'DatabaseService',
            );
        });

        it('should not log when logPerformance is disabled', () => {
            const noPerfLogger = new GrpcLogger({ level: 'verbose', logPerformance: false });
            noPerfLogger.performance('Should not log', 100);

            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
        });

        it('should not log when level is too high', () => {
            const highLevelLogger = new GrpcLogger({ level: 'warn', logPerformance: true });
            highLevelLogger.performance('Should not log', 100);

            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
        });

        it('should not log when disabled globally', () => {
            const disabledLogger = new GrpcLogger({ enabled: false, logPerformance: true });
            disabledLogger.performance('Should not log', 100);

            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
        });
    });

    describe('detail method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({
                level: 'debug',
                logDetails: true,
                context: 'TestService',
            });
        });

        it('should log detail message without data', () => {
            logger.detail('Processing request');

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Processing request');
        });

        it('should log detail message with data', () => {
            const data = { userId: 123, action: 'login' };
            logger.detail('Request received', data);

            const expectedMessage = 'Request received: {\n  "userId": 123,\n  "action": "login"\n}';
            expect(mockNestLogger.debug).toHaveBeenCalledWith(expectedMessage);
        });

        it('should log detail message with data and context', () => {
            const data = { userId: 123 };
            logger.detail('Request received', data, 'AuthService');

            const expectedMessage = 'Request received: {\n  "userId": 123\n}';
            expect(mockNestLogger.debug).toHaveBeenCalledWith(expectedMessage, 'AuthService');
        });

        it('should log detail message without data but with context', () => {
            logger.detail('Processing request', undefined, 'AuthService');

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Processing request', 'AuthService');
        });

        it('should not log when logDetails is disabled', () => {
            const noDetailLogger = new GrpcLogger({ level: 'debug', logDetails: false });
            noDetailLogger.detail('Should not log');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });

        it('should not log when level is too high', () => {
            const highLevelLogger = new GrpcLogger({ level: 'warn', logDetails: true });
            highLevelLogger.detail('Should not log');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('lifecycle method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: 'log', context: 'TestService' });
        });

        it('should log lifecycle event without details', () => {
            logger.lifecycle('Service started');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Service started');
        });

        it('should log lifecycle event with details', () => {
            const details = { port: 50051, protocol: 'gRPC' };
            logger.lifecycle('Service started', details);

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Service started {"port":50051,"protocol":"gRPC"}',
            );
        });

        it('should log lifecycle event with context', () => {
            logger.lifecycle('Service started', undefined, 'CustomContext');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Service started', 'CustomContext');
        });

        it('should log lifecycle event with details and context', () => {
            const details = { port: 50051 };
            logger.lifecycle('Service started', details, 'CustomContext');

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Service started {"port":50051}',
                'CustomContext',
            );
        });
    });

    describe('methodCall method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({
                level: 'debug',
                logPerformance: true,
                context: 'TestService',
            });
        });

        it('should log method call without duration', () => {
            logger.methodCall('login', 'AuthService');

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Method call: AuthService.login');
        });

        it('should log method call with duration and performance enabled', () => {
            logger.methodCall('login', 'AuthService', 150);

            expect(mockNestLogger.verbose).toHaveBeenCalledWith(
                'Method call: AuthService.login (150ms)',
            );
        });

        it('should log method call with context', () => {
            logger.methodCall('login', 'AuthService', undefined, 'CustomContext');

            expect(mockNestLogger.debug).toHaveBeenCalledWith(
                'Method call: AuthService.login',
                'CustomContext',
            );
        });

        it('should log method call with duration but performance disabled', () => {
            const noPerfLogger = new GrpcLogger({ level: 'debug', logPerformance: false });
            noPerfLogger.methodCall('login', 'AuthService', 150);

            expect(mockNestLogger.debug).toHaveBeenCalledWith(
                'Method call: AuthService.login (150ms)',
            );
        });

        it('should log method call with duration and context', () => {
            logger.methodCall('login', 'AuthService', 150, 'CustomContext');

            expect(mockNestLogger.verbose).toHaveBeenCalledWith(
                'Method call: AuthService.login (150ms)',
                'CustomContext',
            );
        });
    });

    describe('connection method', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ level: 'log', context: 'TestService' });
        });

        it('should log connection event without details', () => {
            logger.connection('Connected', 'localhost:50051');

            expect(mockNestLogger.log).toHaveBeenCalledWith('Connected to localhost:50051');
        });

        it('should log connection event with details', () => {
            const details = { secure: true, timeout: 5000 };
            logger.connection('Connected', 'localhost:50051', details);

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Connected to localhost:50051 {"secure":true,"timeout":5000}',
            );
        });

        it('should log connection event with context', () => {
            logger.connection('Connected', 'localhost:50051', undefined, 'ConnectionManager');

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Connected to localhost:50051',
                'ConnectionManager',
            );
        });

        it('should log connection event with details and context', () => {
            const details = { secure: true };
            logger.connection('Connected', 'localhost:50051', details, 'ConnectionManager');

            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Connected to localhost:50051 {"secure":true}',
                'ConnectionManager',
            );
        });
    });

    describe('shouldLog private method', () => {
        it('should return false when logger is disabled', () => {
            const disabledLogger = new GrpcLogger({ enabled: false });

            expect((disabledLogger as any).shouldLog('error')).toBe(false);
        });

        it('should respect log level hierarchy', () => {
            const warnLogger = new GrpcLogger({ level: 'warn' });

            expect((warnLogger as any).shouldLog('debug')).toBe(false);
            expect((warnLogger as any).shouldLog('verbose')).toBe(false);
            expect((warnLogger as any).shouldLog('log')).toBe(false);
            expect((warnLogger as any).shouldLog('warn')).toBe(true);
            expect((warnLogger as any).shouldLog('error')).toBe(true);
        });

        it('should handle debug level correctly', () => {
            const debugLogger = new GrpcLogger({ level: 'debug' });

            expect((debugLogger as any).shouldLog('debug')).toBe(true);
            expect((debugLogger as any).shouldLog('verbose')).toBe(true);
            expect((debugLogger as any).shouldLog('log')).toBe(true);
            expect((debugLogger as any).shouldLog('warn')).toBe(true);
            expect((debugLogger as any).shouldLog('error')).toBe(true);
        });

        it('should handle error level correctly', () => {
            const errorLogger = new GrpcLogger({ level: 'error' });

            expect((errorLogger as any).shouldLog('debug')).toBe(false);
            expect((errorLogger as any).shouldLog('verbose')).toBe(false);
            expect((errorLogger as any).shouldLog('log')).toBe(false);
            expect((errorLogger as any).shouldLog('warn')).toBe(false);
            expect((errorLogger as any).shouldLog('error')).toBe(true);
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
                level: 'debug',
                logPerformance: true,
                logDetails: true,
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
        it('should handle complex logging scenario with all features', () => {
            const mainLogger = new GrpcLogger({
                level: 'debug',
                context: 'GrpcService',
                logPerformance: true,
                logDetails: true,
                logErrors: true,
            });

            const authLogger = mainLogger.child('Auth');

            // Test various logging methods
            authLogger.debug('Starting authentication');
            authLogger.detail('User data', { id: 123, role: 'admin' });
            authLogger.performance('Database lookup', 45);
            authLogger.methodCall('authenticate', 'AuthService', 120);
            authLogger.connection('Connected', 'auth-db:5432', { pool: true });
            authLogger.lifecycle('Authentication completed', { userId: 123 });

            expect(mockNestLogger.debug).toHaveBeenCalledWith('Starting authentication');
            expect(mockNestLogger.debug).toHaveBeenCalledWith(
                'User data: {\n  "id": 123,\n  "role": "admin"\n}',
            );
            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Database lookup (45ms)');
            expect(mockNestLogger.verbose).toHaveBeenCalledWith(
                'Method call: AuthService.authenticate (120ms)',
            );
            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Connected to auth-db:5432 {"pool":true}',
            );
            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Authentication completed {"userId":123}',
            );
        });

        it('should handle disabled features correctly', () => {
            const restrictedLogger = new GrpcLogger({
                level: 'warn',
                logPerformance: false,
                logDetails: false,
                logErrors: false,
            });

            // These should not log
            restrictedLogger.debug('Debug message');
            restrictedLogger.verbose('Verbose message');
            restrictedLogger.log('Log message');
            restrictedLogger.performance('Performance', 100);
            restrictedLogger.detail('Details', { data: 'test' });
            restrictedLogger.error('Error message');

            // Only warn should log
            restrictedLogger.warn('Warning message');

            expect(mockNestLogger.debug).not.toHaveBeenCalled();
            expect(mockNestLogger.verbose).not.toHaveBeenCalled();
            expect(mockNestLogger.log).not.toHaveBeenCalled();
            expect(mockNestLogger.error).not.toHaveBeenCalled();
            expect(mockNestLogger.warn).toHaveBeenCalledWith('Warning message');
        });

        it('should log performance metrics when enabled', () => {
            const perfLogger = new GrpcLogger({ logPerformance: true, level: 'verbose' });
            perfLogger.performance('Operation completed', 150);
            expect(mockNestLogger.verbose).toHaveBeenCalledWith('Operation completed (150ms)');
        });

        it('should log details when enabled', () => {
            const detailLogger = new GrpcLogger({ logDetails: true, level: 'debug' });
            detailLogger.detail('Detail message', { key: 'value' });
            expect(mockNestLogger.debug).toHaveBeenCalledWith(
                'Detail message: {\n  "key": "value"\n}',
            );
        });

        it('should log lifecycle events', () => {
            const lifecycleLogger = new GrpcLogger({ context: 'TestService' });
            lifecycleLogger.lifecycle('Service started', { service: 'TestService' });
            expect(mockNestLogger.log).toHaveBeenCalledWith(
                'Service started {"service":"TestService"}',
            );
        });
    });
});
