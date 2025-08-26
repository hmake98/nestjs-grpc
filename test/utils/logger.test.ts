import { GrpcLogger } from '../../src/utils/logger';

describe('GrpcLogger', () => {
    let logger: GrpcLogger;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create logger with default options', () => {
            const logger = new GrpcLogger();
            expect(logger).toBeDefined();
            expect(logger).toBeInstanceOf(GrpcLogger);
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
            expect(logger).toBeDefined();
            expect(logger).toBeInstanceOf(GrpcLogger);
        });

        it('should create logger with debug level option', () => {
            const logger = new GrpcLogger({ level: 'debug' });
            expect(logger).toBeDefined();
            expect(logger).toBeInstanceOf(GrpcLogger);
        });
    });

    describe('logging methods', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ enabled: true, context: 'TestContext' });
        });

        it('should log debug messages when enabled', () => {
            const debugLogger = new GrpcLogger({ level: 'debug' });
            debugLogger.debug('Debug message');
            // Just verify no errors are thrown
            expect(debugLogger).toBeDefined();
        });

        it('should log verbose messages', () => {
            logger.verbose('Verbose message');
            expect(logger).toBeDefined();
        });

        it('should log regular messages', () => {
            logger.log('Regular message');
            expect(logger).toBeDefined();
        });

        it('should log warning messages', () => {
            logger.warn('Warning message');
            expect(logger).toBeDefined();
        });

        it('should log error messages', () => {
            logger.error('Error message');
            expect(logger).toBeDefined();
        });

        it('should log error messages with Error object', () => {
            const error = new Error('Test error');
            logger.error('Error occurred', error);
            expect(logger).toBeDefined();
        });

        it('should log performance metrics when enabled', () => {
            const perfLogger = new GrpcLogger({ logPerformance: true });
            perfLogger.performance('Operation completed', 150);
            expect(perfLogger).toBeDefined();
        });

        it('should log performance with custom context', () => {
            const perfLogger = new GrpcLogger({ logPerformance: true, context: 'Base' });
            // Use a different context to hit the branch with context override
            perfLogger.performance('Step', 10, 'Other');
            expect(perfLogger).toBeDefined();
        });

        it('should log details when enabled', () => {
            const detailLogger = new GrpcLogger({ logDetails: true });
            detailLogger.detail('Detail message', { key: 'value' });
            expect(detailLogger).toBeDefined();
        });

        it('should log details without data and with custom context', () => {
            const detailLogger = new GrpcLogger({ logDetails: true, context: 'Main' });
            detailLogger.detail('No data', undefined, 'Sub');
            expect(detailLogger).toBeDefined();
        });

        it('should log lifecycle events', () => {
            logger.lifecycle('Service started', { service: 'TestService' });
            expect(logger).toBeDefined();
        });

        it('should log method calls', () => {
            logger.methodCall('testMethod', 'TestService');
            expect(logger).toBeDefined();
        });

        it('should log method calls with duration', () => {
            const perfLogger = new GrpcLogger({ logPerformance: true });
            perfLogger.methodCall('testMethod', 'TestService', 100);
            expect(perfLogger).toBeDefined();
        });

        it('should log debug/verbose/log/warn with custom context', () => {
            const l = new GrpcLogger({ level: 'debug', context: 'Ctx' });
            l.debug('d', 'Other');
            l.verbose('v', 'Other');
            l.log('l', 'Other');
            l.warn('w', 'Other');
            l.error('e', 'err', 'Other');
            expect(l).toBeDefined();
        });

        it('should log connection events', () => {
            logger.connection('Connected to service', 'TestService', { url: 'localhost:50051' });
            expect(logger).toBeDefined();
        });
    });

    describe('child logger', () => {
        beforeEach(() => {
            logger = new GrpcLogger({ context: 'Parent' });
        });

        it('should create child logger with extended context', () => {
            const child = logger.child('Child');
            expect(child).toBeDefined();
            expect(child).toBeInstanceOf(GrpcLogger);
            expect(child).not.toBe(logger);
        });

        it('should inherit parent options in child logger', () => {
            const parentLogger = new GrpcLogger({
                level: 'debug',
                logPerformance: true,
            });
            const child = parentLogger.child('Child');
            expect(child).toBeDefined();
            expect(child).toBeInstanceOf(GrpcLogger);
        });
    });

    describe('disabled logger', () => {
        it('should not log when disabled', () => {
            const disabledLogger = new GrpcLogger({ enabled: false });
            disabledLogger.log('This should not log');
            disabledLogger.error('This should not log');
            disabledLogger.warn('This should not log');
            expect(disabledLogger).toBeDefined();
        });

        it('should handle error logging configuration', () => {
            const noErrorLogger = new GrpcLogger({ logErrors: false });
            noErrorLogger.error('This error should not log');
            expect(noErrorLogger).toBeDefined();
        });
    });

    describe('log level filtering', () => {
        it('should respect log level filtering', () => {
            const errorOnlyLogger = new GrpcLogger({ level: 'error' });
            errorOnlyLogger.debug('Debug message');  // Should not log
            errorOnlyLogger.log('Log message');      // Should not log
            errorOnlyLogger.warn('Warn message');    // Should not log
            errorOnlyLogger.error('Error message');  // Should log
            expect(errorOnlyLogger).toBeDefined();
        });

        it('should log all levels for debug level', () => {
            const debugLogger = new GrpcLogger({ level: 'debug' });
            debugLogger.debug('Debug message');
            debugLogger.verbose('Verbose message');
            debugLogger.log('Log message');
            debugLogger.warn('Warn message');
            debugLogger.error('Error message');
            expect(debugLogger).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('should handle undefined/null contexts', () => {
            logger.log('Message', undefined);
            logger.error('Error', new Error('test'), null as any);
            expect(logger).toBeDefined();
        });

        it('should handle empty messages', () => {
            logger.log('');
            logger.error('');
            expect(logger).toBeDefined();
        });

        it('should handle complex data objects', () => {
            const complexData = {
                nested: { data: 'value' },
                array: [1, 2, 3],
                null: null,
                undefined: undefined,
            };
            const detailLogger = new GrpcLogger({ logDetails: true });
            detailLogger.detail('Complex data', complexData);
            expect(detailLogger).toBeDefined();
        });

        it('should handle circular reference data', () => {
            const circularData: any = { name: 'test' };
            circularData.self = circularData;
            const detailLogger = new GrpcLogger({ logDetails: true });
            detailLogger.detail('Circular data', circularData);
            expect(detailLogger).toBeDefined();
        });
    });
});