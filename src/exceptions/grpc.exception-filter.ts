import { status, Metadata } from '@grpc/grpc-js';
import {
    Catch,
    RpcExceptionFilter,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

import { GrpcErrorCode } from '../constants';

import { GrpcException } from './grpc.exception';

/**
 * Enhanced exception filter that handles gRPC exceptions with improved error handling
 */
@Catch(RpcException)
export class GrpcExceptionFilter implements RpcExceptionFilter<RpcException> {
    private readonly logger = new Logger(GrpcExceptionFilter.name);

    catch(exception: RpcException, _host: ArgumentsHost): Observable<any> {
        try {
            const grpcError = this.processException(exception);
            return throwError(() => grpcError);
        } catch (filterError) {
            // Fallback error handling if filter itself fails
            this.logger.error('Exception filter failed:', filterError);
            return throwError(() => this.createFallbackError(exception));
        }
    }

    /**
     * Processes the exception and converts it to gRPC format
     */
    private processException(exception: RpcException): any {
        try {
            if (exception instanceof GrpcException) {
                // Handle custom GrpcException
                return this.handleGrpcException(exception);
            } else {
                // Handle generic RpcException
                return this.handleGenericRpcException(exception);
            }
        } catch (error) {
            this.logger.warn('Error processing exception, using fallback:', error.message);
            return this.createFallbackError(exception);
        }
    }

    /**
     * Handles GrpcException instances
     */
    private handleGrpcException(exception: GrpcException): any {
        try {
            const statusCode = this.validateStatusCode(exception.getCode());
            const message = this.validateMessage(exception.message);
            const details = this.sanitizeDetails(exception.getDetails());
            const metadata = this.validateMetadata(exception.toMetadata());

            return {
                code: statusCode,
                message,
                details,
                metadata,
            };
        } catch (error) {
            this.logger.warn('Error handling GrpcException:', error.message);
            return this.createFallbackError(exception);
        }
    }

    /**
     * Handles generic RpcException instances
     */
    private handleGenericRpcException(exception: RpcException): any {
        try {
            const error = exception.getError();
            let statusCode: number;
            let message: string;
            let details: any = null;
            const metadata: Metadata = new Metadata();

            if (error instanceof HttpException) {
                // Map HTTP exception to gRPC
                statusCode = this.mapHttpToGrpcStatus(error.getStatus());
                message = this.validateMessage(error.message);

                // Add HTTP status to metadata
                this.safeAddMetadata(metadata, 'http-status', error.getStatus().toString());

                // Add response data to details if available
                const response = error.getResponse();
                if (response && typeof response === 'object') {
                    details = this.sanitizeDetails(response);
                }
            } else {
                // Handle other error types
                statusCode = GrpcErrorCode.UNKNOWN;

                if (typeof error === 'object' && error !== null) {
                    // Extract message from error object
                    message = this.extractMessage(error);

                    // Check for status property
                    if ('status' in error) {
                        const httpStatus = this.parseHttpStatus(error.status);
                        if (httpStatus !== null) {
                            statusCode = this.mapHttpToGrpcStatus(httpStatus);
                            this.safeAddMetadata(metadata, 'http-status', httpStatus.toString());
                        }
                    }

                    // Include error object as details
                    details = this.sanitizeDetails(error);
                } else {
                    // Handle primitive error values
                    message = this.validateMessage(String(error));
                }
            }

            return {
                code: this.validateStatusCode(statusCode),
                message,
                details,
                metadata,
            };
        } catch (error) {
            this.logger.warn('Error handling generic RpcException:', error.message);
            return this.createFallbackError(exception);
        }
    }

    /**
     * Extracts message from error object safely
     */
    private extractMessage(error: any): string {
        if (error.message && typeof error.message === 'string') {
            return this.validateMessage(error.message);
        }

        if (error.error && typeof error.error === 'string') {
            return this.validateMessage(error.error);
        }

        return 'Unknown error';
    }

    /**
     * Parses HTTP status from various input types
     */
    private parseHttpStatus(status: any): number | null {
        if (typeof status === 'number' && Number.isInteger(status) && status > 0) {
            return status;
        }

        if (typeof status === 'string') {
            const parsed = parseInt(status, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }

        return null;
    }

    /**
     * Validates and normalizes status codes
     */
    private validateStatusCode(code: any): number {
        if (typeof code === 'number' && Object.values(GrpcErrorCode).includes(code)) {
            return code;
        }

        this.logger.warn(`Invalid gRPC status code: ${code}, using UNKNOWN`);
        return GrpcErrorCode.UNKNOWN;
    }

    /**
     * Validates and sanitizes error messages
     */
    private validateMessage(message: any): string {
        if (typeof message === 'string' && message.trim().length > 0) {
            // Truncate very long messages to prevent issues
            return message.trim().substring(0, 1000);
        }

        return 'An error occurred';
    }

    /**
     * Validates metadata object
     */
    private validateMetadata(metadata: any): Metadata {
        if (metadata instanceof Metadata) {
            return metadata;
        }

        this.logger.warn('Invalid metadata provided, using empty metadata');
        return new Metadata();
    }

    /**
     * Safely adds metadata with error handling
     */
    private safeAddMetadata(metadata: Metadata, key: string, value: string): void {
        try {
            if (key && typeof key === 'string' && value && typeof value === 'string') {
                metadata.add(key, value);
            }
        } catch (error) {
            this.logger.warn(`Error adding metadata ${key}:${value}:`, error.message);
        }
    }

    /**
     * Sanitizes details object to prevent circular references and ensure serializability
     */
    private sanitizeDetails(details: any): any {
        if (details === null || details === undefined) {
            return null;
        }

        try {
            // Test if the object can be serialized
            JSON.stringify(details);
            return details;
        } catch {
            // If serialization fails, create a safe representation
            if (typeof details === 'object') {
                try {
                    const safeDetails: any = {};

                    for (const [key, value] of Object.entries(details)) {
                        if (
                            typeof value === 'string' ||
                            typeof value === 'number' ||
                            typeof value === 'boolean'
                        ) {
                            safeDetails[key] = value;
                        } else if (value === null || value === undefined) {
                            safeDetails[key] = value;
                        } else {
                            safeDetails[key] = String(value);
                        }
                    }

                    return safeDetails;
                } catch {
                    return { error: 'Details could not be serialized' };
                }
            } else {
                return { value: String(details) };
            }
        }
    }

    /**
     * Creates a fallback error when all else fails
     */
    private createFallbackError(_exception: RpcException): any {
        return {
            code: GrpcErrorCode.INTERNAL,
            message: 'Internal server error occurred',
            details: null,
            metadata: new Metadata(),
        };
    }

    /**
     * Maps HTTP status code to gRPC status code with validation
     */
    private mapHttpToGrpcStatus(httpStatus: number): number {
        // Validate input
        if (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599) {
            this.logger.warn(`Invalid HTTP status code: ${httpStatus}`);
            return status.UNKNOWN;
        }

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
            case HttpStatus.EXPECTATION_FAILED:
                return status.FAILED_PRECONDITION;
            case HttpStatus.I_AM_A_TEAPOT:
                return status.UNIMPLEMENTED;
            case HttpStatus.MISDIRECTED:
                return status.INVALID_ARGUMENT;
            default:
                // For unknown HTTP status codes, use a sensible default based on status class
                if (httpStatus >= 400 && httpStatus < 500) {
                    return status.INVALID_ARGUMENT;
                } else if (httpStatus >= 500) {
                    return status.INTERNAL;
                } else {
                    return status.UNKNOWN;
                }
        }
    }
}
