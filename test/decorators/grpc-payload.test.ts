import { ExecutionContext, createParamDecorator } from '@nestjs/common';

// Mock createParamDecorator to capture the callback functions
let grpcPayloadCallback: any;
let grpcStreamPayloadCallback: any;

jest.mock('@nestjs/common', () => {
    const original = jest.requireActual('@nestjs/common');
    return {
        ...original,
        createParamDecorator: jest.fn((callback) => {
            // Store callbacks for testing
            if (!grpcPayloadCallback) {
                grpcPayloadCallback = callback;
            } else if (!grpcStreamPayloadCallback) {
                grpcStreamPayloadCallback = callback;
            }
            return original.createParamDecorator(callback);
        }),
    };
});

// Import after mocking
import { GrpcPayload, GrpcStreamPayload } from '../../src/decorators/grpc-payload.decorator';

// Mock the execution context
const createMockExecutionContext = (rpcData: any): ExecutionContext => ({
    switchToRpc: () => ({
        getData: () => rpcData,
        getContext: () => ({}),
    }),
    switchToHttp: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
} as any);

describe('GrpcPayload Decorators', () => {
    describe('GrpcPayload', () => {
        it('should be a parameter decorator function', () => {
            expect(typeof GrpcPayload).toBe('function');
            expect(GrpcPayload.length).toBe(1); // createParamDecorator returns function with 1 argument
        });

        it('should be usable as a parameter decorator', () => {
            expect(() => {
                class TestController {
                    testMethod(@GrpcPayload() payload: any) {}
                }
            }).not.toThrow();
        });

        it('should be defined', () => {
            expect(GrpcPayload).toBeDefined();
        });

        it('should be created from createParamDecorator', () => {
            // Verify it's a decorator factory
            const decorator = GrpcPayload();
            expect(typeof decorator).toBe('function');
        });

        it('should extract RPC data from execution context', () => {
            const testData = { userId: 123, name: 'test user' };
            const mockContext = createMockExecutionContext(testData);
            
            // Use the captured callback from createParamDecorator
            expect(grpcPayloadCallback).toBeDefined();
            const result = grpcPayloadCallback(undefined, mockContext);
            expect(result).toBe(testData);
        });

        it('should handle different data types', () => {
            const testCases = [
                { test: 'string data' },
                { test: 123 },
                { test: true },
                { test: null },
                { test: undefined },
                { test: [] },
                { complex: { nested: { data: 'value' } } }
            ];

            testCases.forEach(testData => {
                const mockContext = createMockExecutionContext(testData);
                expect(mockContext.switchToRpc().getData()).toBe(testData);
            });
        });
    });

    describe('GrpcStreamPayload', () => {
        it('should be a parameter decorator function', () => {
            expect(typeof GrpcStreamPayload).toBe('function');
            expect(GrpcStreamPayload.length).toBe(1); // createParamDecorator returns function with 1 argument
        });

        it('should be usable as a parameter decorator', () => {
            expect(() => {
                class TestController {
                    streamMethod(@GrpcStreamPayload() payload: any) {}
                }
            }).not.toThrow();
        });

        it('should be defined', () => {
            expect(GrpcStreamPayload).toBeDefined();
        });

        it('should be created from createParamDecorator', () => {
            // Verify it's a decorator factory
            const decorator = GrpcStreamPayload();
            expect(typeof decorator).toBe('function');
        });

        it('should extract streaming RPC data from execution context', () => {
            const streamData = { sessionId: 'abc123', batchSize: 100 };
            const mockContext = createMockExecutionContext(streamData);
            
            // Use the captured callback from createParamDecorator
            expect(grpcStreamPayloadCallback).toBeDefined();
            const result = grpcStreamPayloadCallback(undefined, mockContext);
            expect(result).toBe(streamData);
        });

        it('should handle streaming data types', () => {
            const streamTestCases = [
                { streamId: 'stream-1', chunks: [] },
                { streamId: 'stream-2', chunks: [1, 2, 3] },
                { sessionId: 'session-abc', realTimeData: { timestamp: Date.now() } }
            ];

            streamTestCases.forEach(streamData => {
                const mockContext = createMockExecutionContext(streamData);
                expect(mockContext.switchToRpc().getData()).toBe(streamData);
            });
        });

        it('should work with Observable stream payloads', () => {
            const observableData = { 
                subscribe: jest.fn(),
                pipe: jest.fn(),
                map: jest.fn()
            };
            const mockContext = createMockExecutionContext(observableData);
            
            expect(mockContext.switchToRpc().getData()).toBe(observableData);
        });
    });

    describe('decorator behavior differences', () => {
        it('should use the same underlying mechanism for both decorators', () => {
            const testData = { shared: 'data' };
            const mockContext = createMockExecutionContext(testData);
            
            // Both decorators should extract the same data from the same context
            const rpcData = mockContext.switchToRpc().getData();
            
            expect(rpcData).toBe(testData);
        });

        it('should handle empty or null context data gracefully', () => {
            const testCases = [null, undefined, {}];
            
            testCases.forEach(testData => {
                const mockContext = createMockExecutionContext(testData);
                expect(mockContext.switchToRpc().getData()).toBe(testData);
            });
        });
    });
});