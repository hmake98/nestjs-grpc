import { ArgumentsHost, Catch, RpcExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

import {
    GrpcErrorCode,
    DEFAULT_MAX_ERROR_MESSAGE_LENGTH,
    DEFAULT_FALLBACK_ERROR_MESSAGE,
} from '../constants';
import { GrpcLogger } from '../utils/logger';

import { GrpcException } from './grpc.exception';

import type { GrpcExceptionFilterOptions, GrpcErrorResponse } from '../interfaces';

/**
 * Global exception filter for gRPC services
 */
@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter<any> {
    private readonly logger: GrpcLogger;
    private readonly options: Required<GrpcExceptionFilterOptions>;

    constructor(options: GrpcExceptionFilterOptions = {}) {
        this.options = {
            enableLogging: options.enableLogging ?? true,
            maxMessageLength: options.maxMessageLength ?? DEFAULT_MAX_ERROR_MESSAGE_LENGTH,
            fallbackMessage: options.fallbackMessage ?? DEFAULT_FALLBACK_ERROR_MESSAGE,
            fallbackCode: options.fallbackCode ?? GrpcErrorCode.INTERNAL,
        };

        this.logger = new GrpcLogger({
            enabled: this.options.enableLogging,
            level: 'error',
            context: 'GrpcExceptionFilter',
        });
    }

    /**
     * Catch and handle exceptions
     */
    catch(exception: any, _host: ArgumentsHost): Observable<any> {
        try {
            const error = this.normalizeError(exception);

            if (this.options.enableLogging) {
                this.logError(error, exception);
            }

            return throwError(() => error);
        } catch (filterError) {
            // Fallback if normalization fails
            const fallbackError: GrpcErrorResponse = {
                code: this.options.fallbackCode,
                message: this.options.fallbackMessage,
                details: { originalError: String(exception) },
            };

            if (this.options.enableLogging) {
                this.logger.error('Exception filter failed to process error', filterError);
                this.logger.error('Original exception', exception);
            }

            return throwError(() => fallbackError);
        }
    }

    /**
     * Normalizes different types of errors to gRPC format
     */
    private normalizeError(exception: any): GrpcErrorResponse {
        // If it's already a GrpcException, extract its data
        if (exception instanceof GrpcException) {
            return {
                code: exception.getCode(),
                message: exception.message,
                details: exception.getDetails(),
                metadata: exception.getMetadata(),
            };
        }

        // If it's a NestJS RpcException, try to extract gRPC data
        if (exception && typeof exception.getError === 'function') {
            const error = exception.getError();
            if (error && typeof error === 'object') {
                return {
                    code: error.code ?? GrpcErrorCode.INTERNAL,
                    message: error.message ?? exception.message ?? 'Internal server error',
                    details: error.details,
                    metadata: error.metadata,
                };
            }
        }

        // Handle standard Error objects
        if (exception instanceof Error) {
            return {
                code: GrpcErrorCode.INTERNAL,
                message: this.truncateMessage(exception.message),
                details: {
                    name: exception.name,
                    stack: exception.stack,
                },
            };
        }

        // Handle unknown error types
        return {
            code: GrpcErrorCode.INTERNAL,
            message: this.truncateMessage(
                typeof exception === 'string' ? exception : 'Unknown error occurred',
            ),
            details: {
                originalError: exception,
            },
        };
    }

    /**
     * Logs error information
     */
    private logError(error: GrpcErrorResponse, _originalException: any): void {
        try {
            const errorMessage = `gRPC error: ${error.message}`;
            const errorDetails = `Code: ${error.code}`;

            this.logger.error(errorMessage, errorDetails);

            // Log additional details if available
            if (error.details && typeof error.details === 'object') {
                try {
                    const detailsJson = JSON.stringify(error.details);
                    if (detailsJson.length <= this.options.maxMessageLength) {
                        this.logger.error('Error details', detailsJson);
                    }
                } catch {
                    // Ignore JSON stringify errors
                }
            }
        } catch {
            // Ignore logging errors
        }
    }

    /**
     * Truncates error messages to prevent excessive logging
     */
    private truncateMessage(message: string): string {
        if (!message || typeof message !== 'string') {
            return 'Unknown error';
        }

        const trimmed = message.trim();
        return trimmed.length > this.options.maxMessageLength
            ? `${trimmed.substring(0, this.options.maxMessageLength)}...`
            : trimmed;
    }
}
