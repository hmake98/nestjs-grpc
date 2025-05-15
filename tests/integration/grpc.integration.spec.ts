import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientGrpc } from '@nestjs/microservices';
import { join } from 'path';
import * as grpc from '@grpc/grpc-js';
import { GrpcModule } from '../../grpc.module';
import { GrpcService, GrpcMethod, GrpcException } from '../..';
import { lastValueFrom, Observable, toArray } from 'rxjs';

// Define interfaces for our test service
interface GetTestRequest {
    id: string;
}

interface CreateTestRequest {
    name: string;
    description: string;
}

interface StreamTestsRequest {
    count: number;
}

interface Test {
    id: string;
    name: string;
    description: string;
    status: number;
}

interface TestServiceClient {
    getTest(request: GetTestRequest): Promise<Test>;
    createTest(request: CreateTestRequest): Promise<Test>;
    streamTests(request: StreamTestsRequest): Observable<Test>;
}

// Create a test controller that implements the gRPC service
@GrpcService('TestService')
class TestController {
    private tests: Test[] = [
        {
            id: '1',
            name: 'Test 1',
            description: 'First test',
            status: 1,
        },
        {
            id: '2',
            name: 'Test 2',
            description: 'Second test',
            status: 2,
        },
    ];

    @GrpcMethod('GetTest')
    getTest(request: GetTestRequest): Test {
        const test = this.tests.find(t => t.id === request.id);
        if (!test) {
            throw GrpcException.notFound(`Test with ID ${request.id} not found`);
        }
        return test;
    }

    @GrpcMethod('CreateTest')
    createTest(request: CreateTestRequest): Test {
        const newTest: Test = {
            id: (this.tests.length + 1).toString(),
            name: request.name,
            description: request.description,
            status: 1,
        };

        this.tests.push(newTest);
        return newTest;
    }

    @GrpcMethod('StreamTests')
    streamTests(request: StreamTestsRequest): Observable<Test> {
        const { count = 3 } = request;
        return new Observable<Test>(observer => {
            const max = Math.min(count, this.tests.length);

            for (let i = 0; i < max; i++) {
                observer.next(this.tests[i]);
            }

            observer.complete();
        });
    }
}

// This is a very simplified integration test since we can't easily start real gRPC servers in a test environment
describe('gRPC Integration Test (Simplified)', () => {
    let app: INestApplication;
    let client: ClientGrpc;
    let testService: TestServiceClient;

    beforeAll(async () => {
        // Create a test module with our gRPC service
        const moduleRef = await Test.createTestingModule({
            imports: [
                GrpcModule.forRoot({
                    protoPath: join(__dirname, '../fixtures/test.proto'),
                    package: 'test',
                    url: 'localhost:5000', // This won't actually be used since we're mocking
                }),
            ],
            controllers: [TestController],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        // We would normally create a real gRPC client here, but for the test we'll mock it
        // using the TestController directly
        testService = {
            getTest: async (request: GetTestRequest) => {
                try {
                    return (app.get(TestController) as TestController).getTest(request);
                } catch (error) {
                    throw error;
                }
            },
            createTest: async (request: CreateTestRequest) => {
                return (app.get(TestController) as TestController).createTest(request);
            },
            streamTests: (request: StreamTestsRequest) => {
                return (app.get(TestController) as TestController).streamTests(request);
            },
        };
    });

    afterAll(async () => {
        await app.close();
    });

    describe('getTest', () => {
        it('should return a test by ID', async () => {
            const result = await testService.getTest({ id: '1' });

            expect(result).toBeDefined();
            expect(result.id).toBe('1');
            expect(result.name).toBe('Test 1');
        });

        it('should throw a NOT_FOUND exception for non-existent ID', async () => {
            try {
                await testService.getTest({ id: '999' });
                fail('Should have thrown an exception');
            } catch (error) {
                expect(error).toBeInstanceOf(GrpcException);
                expect((error as GrpcException).getCode()).toBe(grpc.status.NOT_FOUND);
            }
        });
    });

    describe('createTest', () => {
        it('should create a new test', async () => {
            const newTest = {
                name: 'New Test',
                description: 'A newly created test',
            };

            const result = await testService.createTest(newTest);

            expect(result).toBeDefined();
            expect(result.id).toBe('3'); // Third test
            expect(result.name).toBe('New Test');
            expect(result.description).toBe('A newly created test');
        });
    });

    describe('streamTests', () => {
        it('should stream multiple tests', async () => {
            const streamResults = await lastValueFrom(
                testService.streamTests({ count: 2 }).pipe(toArray()),
            );

            expect(streamResults).toHaveLength(2);
            expect(streamResults[0].id).toBe('1');
            expect(streamResults[1].id).toBe('2');
        });

        it('should limit the number of streamed tests', async () => {
            const streamResults = await lastValueFrom(
                testService.streamTests({ count: 1 }).pipe(toArray()),
            );

            expect(streamResults).toHaveLength(1);
            expect(streamResults[0].id).toBe('1');
        });
    });
});
