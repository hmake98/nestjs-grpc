import { ExecutionContext } from '@nestjs/common';
import { GrpcPayload, GrpcStreamPayload } from '../../src/decorators/grpc-payload.decorator';

// Mock the createParamDecorator to capture and test the function
jest.mock('@nestjs/common', () => {
    const actual = jest.requireActual('@nestjs/common');
    return {
        ...actual,
        createParamDecorator: jest.fn((factoryFn) => {
            // Store the factory function so we can test it
            const decorator = (...args: any[]) => {
                decorator.__factoryFn = factoryFn;
                return decorator;
            };
            decorator.__factoryFn = factoryFn;
            return decorator;
        }),
    };
});

describe('GrpcPayload Decorators', () => {
    let mockExecutionContext: jest.Mocked<ExecutionContext>;
    let mockRpcContext: any;

    beforeEach(() => {
        mockRpcContext = {
            getData: jest.fn(),
        };

        mockExecutionContext = {
            switchToRpc: jest.fn().mockReturnValue(mockRpcContext),
        } as any;
    });

    describe('GrpcPayload', () => {
        it('should be defined', () => {
            expect(GrpcPayload).toBeDefined();
            expect(typeof GrpcPayload).toBe('function');
        });

        it('should extract data from RPC context', () => {
            const testData = { userId: '123', email: 'test@example.com' };
            mockRpcContext.getData.mockReturnValue(testData);

            // Get the factory function from the mocked decorator
            const decoratorInstance = GrpcPayload();
            const factoryFn = (decoratorInstance as any).__factoryFn;
            
            // Test the factory function directly
            const result = factoryFn(undefined, mockExecutionContext);

            expect(mockExecutionContext.switchToRpc).toHaveBeenCalled();
            expect(mockRpcContext.getData).toHaveBeenCalled();
            expect(result).toBe(testData);
        });

        it('should extract data from RPC context with custom data parameter', () => {
            const testData = { userId: '456', name: 'John Doe' };
            mockRpcContext.getData.mockReturnValue(testData);
            
            // Reset mocks
            mockExecutionContext.switchToRpc.mockClear();
            mockRpcContext.getData.mockClear();

            // Get the factory function from the mocked decorator with custom data
            const decoratorInstance = GrpcPayload('customData');
            const factoryFn = (decoratorInstance as any).__factoryFn;
            
            // Test the factory function directly with custom data
            const result = factoryFn('customData', mockExecutionContext);

            expect(mockExecutionContext.switchToRpc).toHaveBeenCalled();
            expect(mockRpcContext.getData).toHaveBeenCalled();
            expect(result).toBe(testData);
        });

        it('should be usable as a parameter decorator', () => {
            expect(() => {
                class TestController {
                    testMethod(@GrpcPayload() payload: any) {
                        return payload;
                    }
                }
                expect(TestController).toBeDefined();
            }).not.toThrow();
        });

        it('should accept optional data parameter', () => {
            expect(() => {
                class TestController {
                    testMethod(@GrpcPayload('customData') payload: any) {
                        return payload;
                    }
                }
                expect(TestController).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('GrpcStreamPayload', () => {
        it('should be defined', () => {
            expect(GrpcStreamPayload).toBeDefined();
            expect(typeof GrpcStreamPayload).toBe('function');
        });

        it('should extract data from RPC context', () => {
            const streamData = { message: 'Hello stream' };
            mockRpcContext.getData.mockReturnValue(streamData);

            // Reset mocks
            mockExecutionContext.switchToRpc.mockClear();
            mockRpcContext.getData.mockClear();

            // Get the factory function from the mocked decorator
            const decoratorInstance = GrpcStreamPayload();
            const factoryFn = (decoratorInstance as any).__factoryFn;
            
            // Test the factory function directly
            const result = factoryFn(undefined, mockExecutionContext);

            expect(mockExecutionContext.switchToRpc).toHaveBeenCalled();
            expect(mockRpcContext.getData).toHaveBeenCalled();
            expect(result).toBe(streamData);
        });

        it('should extract data from RPC context with custom data parameter', () => {
            const streamData = { data: 'stream payload' };
            mockRpcContext.getData.mockReturnValue(streamData);

            // Reset mocks
            mockExecutionContext.switchToRpc.mockClear();
            mockRpcContext.getData.mockClear();

            // Get the factory function from the mocked decorator with custom data
            const decoratorInstance = GrpcStreamPayload('streamData');
            const factoryFn = (decoratorInstance as any).__factoryFn;
            
            // Test the factory function directly with custom data
            const result = factoryFn('streamData', mockExecutionContext);

            expect(mockExecutionContext.switchToRpc).toHaveBeenCalled();
            expect(mockRpcContext.getData).toHaveBeenCalled();
            expect(result).toBe(streamData);
        });

        it('should be usable as a parameter decorator', () => {
            expect(() => {
                class StreamController {
                    streamMethod(@GrpcStreamPayload() payload: any) {
                        return payload;
                    }
                }
                expect(StreamController).toBeDefined();
            }).not.toThrow();
        });

        it('should accept optional data parameter', () => {
            expect(() => {
                class StreamController {
                    streamMethod(@GrpcStreamPayload('streamData') payload: any) {
                        return payload;
                    }
                }
                expect(StreamController).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('decorator comparison', () => {
        it('should be different decorator instances', () => {
            expect(GrpcPayload).not.toBe(GrpcStreamPayload);
        });

        it('should both work on the same class', () => {
            expect(() => {
                class MixedController {
                    unaryMethod(@GrpcPayload() payload: any) {
                        return payload;
                    }

                    streamMethod(@GrpcStreamPayload() payload: any) {
                        return payload;
                    }
                }
                expect(MixedController).toBeDefined();
            }).not.toThrow();
        });
    });
});