import { status, Metadata } from '@grpc/grpc-js';
import {
    Catch,
    RpcExceptionFilter,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

import { GrpcErrorCode } from '../constants';

import { GrpcException } from './grpc.exception';

/**
 * Exception filter that handles gRPC exceptions and converts them to the appropriate gRPC status with metadata
 */
@Catch(RpcException)
export class GrpcExceptionFilter implements RpcExceptionFilter<RpcException> {
    catch(exception: RpcException, _host: ArgumentsHost): Observable<any> {
        let statusCode: number;
        let message: string;
        let details: any = null;
        let metadata: Metadata = new Metadata();

        if (exception instanceof GrpcException) {
            statusCode = exception.getCode();
            message = exception.message;
            details = exception.getDetails();

            // Use the metadata from the exception
            metadata = exception.toMetadata();
        } else {
            // Generic RPC exception handling
            const error = exception.getError();

            // Check if it's an HttpException to map the status code
            if (error instanceof HttpException) {
                statusCode = this.mapHttpToGrpcStatus(error.getStatus());
                message = error.message;

                // Add HTTP status to metadata
                metadata.add('http-status', error.getStatus().toString());

                // Add response data to details if available
                const response = error.getResponse();
                if (typeof response === 'object' && response !== null) {
                    details = response;
                }
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
                        metadata.add('http-status', httpStatus.toString());
                    }
                }

                // If we have an object, include it as details
                if (typeof error === 'object' && error !== null) {
                    details = error;
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
     * @param httpStatus HTTP status code
     * @returns gRPC status code
     */
    private mapHttpToGrpcStatus(httpStatus: number): number {
        switch (httpStatus) {
            case HttpStatus.BAD_REQUEST:
                return status.INVALID_ARGUMENT;
            case HttpStatus.UNAUTHORIZED:
                return status.UNAUTHENTICATED;
            case HttpStatus.FORBIDDEN:
                return status.PERMISSION_DENIED;
            case HttpStatus.NOT_FOUND:
                return status.NOT_FOUND;
            case HttpStatus.CONFLICT:
                return status.ALREADY_EXISTS;
            case HttpStatus.GONE:
                return status.NOT_FOUND;
            case HttpStatus.TOO_MANY_REQUESTS:
                return status.RESOURCE_EXHAUSTED;
            case HttpStatus.INTERNAL_SERVER_ERROR:
                return status.INTERNAL;
            case HttpStatus.NOT_IMPLEMENTED:
                return status.UNIMPLEMENTED;
            case HttpStatus.BAD_GATEWAY:
            case HttpStatus.SERVICE_UNAVAILABLE:
            case HttpStatus.GATEWAY_TIMEOUT:
                return status.UNAVAILABLE;
            case HttpStatus.REQUEST_TIMEOUT:
                return status.DEADLINE_EXCEEDED;
            case HttpStatus.PRECONDITION_FAILED:
                return status.FAILED_PRECONDITION;
            case HttpStatus.PAYLOAD_TOO_LARGE:
                return status.RESOURCE_EXHAUSTED;
            case HttpStatus.UNPROCESSABLE_ENTITY:
                return status.INVALID_ARGUMENT;
            default:
                return status.UNKNOWN;
        }
    }
}
