import { Test } from '@nestjs/testing';
import { GrpcModule } from '../grpc.module';
import { GrpcClientFactory } from '../services/grpc-client.service';
import { GRPC_OPTIONS } from '../constants';
import { join } from 'path';
import { APP_FILTER } from '@nestjs/core';
import { GrpcExceptionFilter } from '../exceptions/grpc.exception-filter';
import { GrpcOptions, GrpcModuleAsyncOptions } from '../interfaces';

describe('GrpcModule', () => {
    describe('forRoot', () => {
        it('should provide the GrpcClientFactory', async () => {
            const module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRoot({
                        protoPath: join(__dirname, '../fixtures/test.proto'),
                        package: 'test',
                        url: 'localhost:5000',
                    }),
                ],
            }).compile();

            const grpcClientFactory = module.get<GrpcClientFactory>(GrpcClientFactory);
            expect(grpcClientFactory).toBeInstanceOf(GrpcClientFactory);
        });

        it('should register the GRPC_OPTIONS provider', async () => {
            const options: GrpcOptions = {
                protoPath: join(__dirname, '../fixtures/test.proto'),
                package: 'test',
                url: 'localhost:5000',
            };

            const module = await Test.createTestingModule({
                imports: [GrpcModule.forRoot(options)],
            }).compile();

            const grpcOptions = module.get<GrpcOptions>(GRPC_OPTIONS);
            expect(grpcOptions).toEqual(options);
        });

        it('should register the exception filter', async () => {
            const module = await Test.createTestingModule({
                imports: [
                    GrpcModule.forRoot({
                        protoPath: join(__dirname, '../fixtures/test.proto'),
                        package: 'test',
                    }),
                ],
            }).compile();

            const appFilter = module.get<{ useClass: any }>(APP_FILTER);
            expect(appFilter.useClass).toBe(GrpcExceptionFilter);
        });
    });

    describe('forRootAsync', () => {
        it('should provide the GrpcClientFactory asynchronously', async () => {
            const options: GrpcModuleAsyncOptions = {
                useFactory: () => ({
                    protoPath: join(__dirname, '../fixtures/test.proto'),
                    package: 'test',
                    url: 'localhost:5000',
                }),
            };

            const module = await Test.createTestingModule({
                imports: [GrpcModule.forRootAsync(options)],
            }).compile();

            const grpcClientFactory = module.get<GrpcClientFactory>(GrpcClientFactory);
            expect(grpcClientFactory).toBeInstanceOf(GrpcClientFactory);
        });

        it('should use inject options', async () => {
            // Create a service that provides configuration
            class ConfigService {
                getProtoPath() {
                    return join(__dirname, '../fixtures/test.proto');
                }

                getPackage() {
                    return 'test';
                }

                getUrl() {
                    return 'localhost:5000';
                }
            }

            const options: GrpcModuleAsyncOptions = {
                inject: [ConfigService],
                useFactory: (configService: ConfigService) => ({
                    protoPath: configService.getProtoPath(),
                    package: configService.getPackage(),
                    url: configService.getUrl(),
                }),
            };

            const module = await Test.createTestingModule({
                imports: [GrpcModule.forRootAsync(options)],
                providers: [ConfigService],
            }).compile();

            const grpcOptions = module.get<GrpcOptions>(GRPC_OPTIONS);
            expect(grpcOptions.protoPath).toContain('test.proto');
            expect(grpcOptions.package).toBe('test');
            expect(grpcOptions.url).toBe('localhost:5000');
        });
    });
});
