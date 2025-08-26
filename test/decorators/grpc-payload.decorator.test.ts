import { ExecutionContext } from '@nestjs/common';

// Mock createParamDecorator to return the factory directly for easy testing
jest.mock('@nestjs/common', () => {
    const actual = jest.requireActual('@nestjs/common');
    return {
        ...actual,
        createParamDecorator: (factory: any) => factory,
    };
});

// Import after mock
import { GrpcPayload, GrpcStreamPayload } from '../../src/decorators/grpc-payload.decorator';

describe('GrpcPayload decorators', () => {
    const mockExecutionContext = (data: any): ExecutionContext => {
        return {
            switchToRpc: () => ({ getData: () => data }) as any,
        } as any;
    };

    it('GrpcPayload extracts unary payload', () => {
        const result = (GrpcPayload as any)(null, mockExecutionContext({ foo: 'bar' }));
        expect(result).toEqual({ foo: 'bar' });
    });

    it('GrpcStreamPayload extracts stream payload', () => {
        const result = (GrpcStreamPayload as any)(null, mockExecutionContext({ chunk: 1 }));
        expect(result).toEqual({ chunk: 1 });
    });
});

