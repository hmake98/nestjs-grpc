import { ExecutionContext } from '@nestjs/common';
import { GrpcPayload, GrpcStreamPayload } from '../../src/decorators/grpc-payload.decorator';

describe('GrpcPayload decorators', () => {
    const mockExecutionContext = (data: any): ExecutionContext => {
        return {
            switchToRpc: () => ({ getData: () => data }) as any,
        } as any;
    };

    it('GrpcPayload extracts unary payload', () => {
        const factory = (GrpcPayload as any).factory || GrpcPayload;
        const result = factory(null, mockExecutionContext({ foo: 'bar' }));
        expect(result).toEqual({ foo: 'bar' });
    });

    it('GrpcStreamPayload extracts stream payload', () => {
        const factory = (GrpcStreamPayload as any).factory || GrpcStreamPayload;
        const result = factory(null, mockExecutionContext({ chunk: 1 }));
        expect(result).toEqual({ chunk: 1 });
    });
});

