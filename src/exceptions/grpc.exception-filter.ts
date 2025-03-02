import { Catch, RpcExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { GrpcException } from './grpc.exception';
import { GrpcErrorCode } from '../constants';

/**
 * Exception filter that handles gRPC exceptions and converts them to the appropriate gRPC status
 */
@Catch(RpcException)
export class GrpcExceptionFilter implements RpcExceptionFilter<RpcException> {
    catch(exception: RpcException, host: ArgumentsHost): Observable<any> {
        let statusCode: number;
        let message: string;
        let details: any = null;
        let metadata: Record<string, string> = {};

        if (exception instanceof GrpcException) {
            statusCode = exception.getCode();
            message = exception.message;
            details = exception.getDetails();
            metadata = exception.getMetadata();
        } else {
            // Generic RPC exception handling
            const error = exception.getError();

            // Check if it's an HttpException to map the status code
            if (error instanceof HttpException) {
                statusCode = this.mapHttpToGrpcStatus(error.getStatus());
                message = error.message;
            } else {
                statusCode = GrpcErrorCode.UNKNOWN;
                message =
                    typeof error === 'object' && error !== null
                        ? (error as { message?: string }).message || 'Unknown error'
                        : error.toString();

                // Check if error contains a status property (which might be an HTTP status code)
                if (typeof error === 'object' && error !== null && 'status' in error) {
                    const httpStatus = Number(error.status);
                    if (!isNaN(httpStatus)) {
                        statusCode = this.mapHttpToGrpcStatus(httpStatus);
                    }
                }
            }
        }

        // Create gRPC error object
        const grpcError: any = {
            code: statusCode,
            message,
            details,
            metadata,
        };

        return throwError(() => grpcError);
    }

    /**
     * Maps HTTP status code to gRPC status code
     * @param status HTTP status code
     * @returns gRPC status code
     */
    private mapHttpToGrpcStatus(httpStatus: number): number {
        switch (httpStatus) {
            case 400:
                return status.INVALID_ARGUMENT;
            case 401:
                return status.UNAUTHENTICATED;
            case 403:
                return status.PERMISSION_DENIED;
            case 404:
                return status.NOT_FOUND;
            case 409:
                return status.ALREADY_EXISTS;
            case 429:
                return status.RESOURCE_EXHAUSTED;
            case 500:
                return status.INTERNAL;
            case 501:
                return status.UNIMPLEMENTED;
            case 502:
            case 503:
            case 504:
                return status.UNAVAILABLE;
            case 408:
                return status.DEADLINE_EXCEEDED;
            case 412:
                return status.FAILED_PRECONDITION;
            case 413:
                return status.RESOURCE_EXHAUSTED;
            default:
                return status.UNKNOWN;
        }
    }
}
