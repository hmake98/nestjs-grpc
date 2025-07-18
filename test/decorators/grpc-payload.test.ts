import { GrpcPayload, GrpcStreamPayload } from '../../src/decorators/grpc-payload.decorator';

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
    });
});