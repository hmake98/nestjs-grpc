import { Test, TestingModule } from '@nestjs/testing';
import { GRPC_OPTIONS } from '../../src/constants';
import { ProtoLoaderService } from '../../src/services/proto-loader.service';
import { GrpcOptions } from '../../src/interfaces';

describe('ProtoLoaderService', () => {
    let service: ProtoLoaderService;
    let mockOptions: GrpcOptions;

    beforeEach(async () => {
        mockOptions = {
            protoPath: '/test/path.proto',
            package: 'test.package',
            url: 'localhost:5000',
            logging: {
                level: 'log',
                debug: false,
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProtoLoaderService,
                {
                    provide: GRPC_OPTIONS,
                    useValue: mockOptions,
                },
            ],
        }).compile();

        service = module.get<ProtoLoaderService>(ProtoLoaderService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should validate options on construction', () => {
        expect(() => {
            new ProtoLoaderService(null as any);
        }).toThrow('Cannot read properties of null');
    });

    it('should throw error for missing protoPath', () => {
        expect(() => {
            new ProtoLoaderService({ package: 'test' } as any);
        }).toThrow('protoPath is required and must be a string');
    });

    it('should throw error for missing package', () => {
        expect(() => {
            new ProtoLoaderService({ protoPath: '/test.proto' } as any);
        }).toThrow('package is required and must be a string');
    });

    it('should accept valid options', () => {
        expect(() => {
            new ProtoLoaderService({
                protoPath: '/test.proto',
                package: 'test.package',
                url: 'localhost:5000',
            });
        }).not.toThrow();
    });
});
