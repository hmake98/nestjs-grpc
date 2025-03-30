import {
    Catch,
    RpcExceptionFilter,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Inject,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { status, Metadata } from '@grpc/grpc-js';
import { GrpcException } from './grpc.exception';
import { GrpcErrorCode, GRPC_LOGGER } from '../constants';
import { GrpcLogger } from '../interfaces/logger.interface';

/**
 * Exception filter that handles gRPC exceptions and converts them to the appropriate gRPC status with metadata
 */
@Catch(RpcException)
export class GrpcExceptionFilter implements RpcExceptionFilter<RpcException> {
    constructor(@Inject(GRPC_LOGGER) private readonly logger: GrpcLogger) {}

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

            this.logger.debug(
                `Transformed gRPC exception: [${statusCode}] ${message}`,
                'GrpcExceptionFilter',
            );
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

                this.logger.debug(
                    `Transformed HTTP exception: [${error.getStatus()} → ${statusCode}] ${message}`,
                    'GrpcExceptionFilter',
                );
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

                this.logger.debug(
                    `Transformed generic exception: [${statusCode}] ${message}`,
                    'GrpcExceptionFilter',
                );
            }
        }

        // Create gRPC error object
        const grpcError: any = {
            code: statusCode,
            message,
            details,
            metadata,
        };

        // Log the error at an appropriate level based on the status code
        if (
            statusCode === GrpcErrorCode.INTERNAL ||
            statusCode === GrpcErrorCode.UNKNOWN ||
            statusCode === GrpcErrorCode.DATA_LOSS
        ) {
            // Server errors are logged as errors
            this.logger.error(
                `gRPC error: [${statusCode}] ${message}`,
                'GrpcExceptionFilter',
                details ? JSON.stringify(details) : undefined,
            );
        } else if (
            statusCode === GrpcErrorCode.INVALID_ARGUMENT ||
            statusCode === GrpcErrorCode.FAILED_PRECONDITION ||
            statusCode === GrpcErrorCode.OUT_OF_RANGE
        ) {
            // Client errors related to invalid input are logged as warnings
            this.logger.warn(`gRPC error: [${statusCode}] ${message}`, 'GrpcExceptionFilter');
        } else {
            // Other client errors are logged as info
            this.logger.info(`gRPC error: [${statusCode}] ${message}`, 'GrpcExceptionFilter');
        }

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
