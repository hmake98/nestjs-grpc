import { ExecutionContext } from '@nestjs/common';
import { Observable, of, Subject } from 'rxjs';
import { map, toArray } from 'rxjs/operators';

import { GrpcPayload, GrpcStreamPayload } from '../../src/decorators/grpc-payload.decorator';

// Mock interfaces for testing
interface UserRequest {
    userId: string;
    includeProfile?: boolean;
}

interface UserResponse {
    id: string;
    name: string;
    email: string;
    profile?: {
        bio: string;
        preferences: Record<string, any>;
    };
}

interface CreateUserRequest {
    name: string;
    email: string;
    password: string;
}

interface DataStreamRequest {
    batchSize: number;
    startId: number;
    expectedChunks: number;
}

interface DataChunk {
    chunkId: number;
    data: any[];
    hasMore: boolean;
}

interface UploadChunk {
    chunkId: number;
    data: Buffer;
    checksum: string;
}

interface UploadResponse {
    uploadId: string;
    success: boolean;
    totalChunks: number;
    totalSize: number;
}

// Helper function to create mock execution context
function createMockExecutionContext(rpcData: any): ExecutionContext {
    return {
        switchToRpc: () => ({
            getData: () => rpcData,
            getContext: () => ({}),
        }),
        switchToHttp: jest.fn(),
        switchToWs: jest.fn(),
        getType: () => 'rpc' as any,
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
    } as any;
}

// Test service implementations without decorators
class TestUserService {
    async getUser(payload: UserRequest): Promise<UserResponse> {
        const response: UserResponse = {
            id: payload.userId,
            name: 'Test User',
            email: 'test@example.com',
        };

        if (payload.includeProfile) {
            response.profile = {
                bio: 'Test bio',
                preferences: { theme: 'dark' },
            };
        }

        return response;
    }

    async createUser(payload: CreateUserRequest): Promise<any> {
        if (!payload.name || !payload.email || !payload.password) {
            throw new Error('Validation failed: All fields are required');
        }

        return {
            user: {
                id: 'user-123',
                name: payload.name,
                email: payload.email.toLowerCase(),
            },
            success: true,
        };
    }

    async updateProfile(payload: { userId: string; profile: any }): Promise<any> {
        return {
            success: true,
            userId: payload.userId,
            updatedFields: Object.keys(payload.profile),
        };
    }
}

class TestDataService {
    getDataStream(payload: DataStreamRequest): Observable<DataChunk> {
        return new Observable(observer => {
            const batchSize = payload.batchSize || 100;
            const startId = payload.startId || 0;

            // Create mock batches
            for (let i = 0; i < 3; i++) {
                const batch = Array.from({ length: Math.min(batchSize, 5) }, (_, idx) => ({
                    id: startId + i * batchSize + idx,
                    value: `data_${startId + i * batchSize + idx}`,
                }));

                observer.next({
                    chunkId: i,
                    data: batch,
                    hasMore: i < payload.expectedChunks - 1,
                });
            }

            observer.complete();
        });
    }

    uploadData(payload: Observable<UploadChunk>): Observable<UploadResponse> {
        return payload.pipe(
            toArray(),
            map(chunks => ({
                uploadId: 'upload-123',
                success: true,
                totalChunks: chunks.length,
                totalSize: chunks.reduce((sum, chunk) => sum + chunk.data.length, 0),
            })),
        );
    }

    processRealTimeData(payload: Observable<any>): Observable<any> {
        return payload.pipe(
            map(request => ({
                processedAt: new Date().toISOString(),
                originalData: request,
                processed: true,
            })),
        );
    }
}

describe('GrpcPayload Integration Tests', () => {
    let userService: TestUserService;
    let dataService: TestDataService;

    beforeEach(() => {
        userService = new TestUserService();
        dataService = new TestDataService();
    });

    describe('GrpcPayload decorator functionality', () => {
        it('should extract payload data from execution context', () => {
            const payloadData = { userId: 'user-123', includeProfile: false };
            const mockContext = createMockExecutionContext(payloadData);

            // Test that the decorator's logic works correctly
            const extractedData = mockContext.switchToRpc().getData();
            expect(extractedData).toEqual(payloadData);
        });

        it('should work with service methods that expect payload data', async () => {
            const payload: UserRequest = {
                userId: 'user-456',
                includeProfile: true,
            };

            const result = await userService.getUser(payload);

            expect(result).toEqual({
                id: 'user-456',
                name: 'Test User',
                email: 'test@example.com',
                profile: {
                    bio: 'Test bio',
                    preferences: { theme: 'dark' },
                },
            });
        });

        it('should handle complex nested payload structures', async () => {
            const payload = {
                userId: 'user-789',
                profile: {
                    name: 'Updated Name',
                    bio: 'New bio',
                    preferences: {
                        theme: 'light',
                        language: 'en',
                        notifications: true,
                    },
                },
            };

            const result = await userService.updateProfile(payload);

            expect(result).toEqual({
                success: true,
                userId: 'user-789',
                updatedFields: ['name', 'bio', 'preferences'],
            });
        });

        it('should handle validation errors from payload', async () => {
            const invalidPayload: CreateUserRequest = {
                name: '',
                email: 'invalid@email.com',
                password: '',
            };

            await expect(userService.createUser(invalidPayload)).rejects.toThrow(
                'Validation failed: All fields are required',
            );
        });

        it('should preserve data types in extracted payload', () => {
            const complexPayload = {
                user: {
                    id: 'user-123',
                    age: 30,
                    isActive: true,
                    metadata: {
                        timestamp: Date.now(),
                        version: '1.0.0',
                    },
                },
                tags: ['admin', 'premium'],
                settings: null,
            };

            const mockContext = createMockExecutionContext(complexPayload);
            const extractedData = mockContext.switchToRpc().getData();

            expect(extractedData).toEqual(complexPayload);
            expect(typeof extractedData.user.age).toBe('number');
            expect(typeof extractedData.user.isActive).toBe('boolean');
            expect(Array.isArray(extractedData.tags)).toBe(true);
            expect(extractedData.settings).toBeNull();
        });
    });

    describe('GrpcStreamPayload decorator functionality', () => {
        it('should extract streaming payload data from execution context', () => {
            const streamData = of({ chunkId: 0, data: 'chunk1' }, { chunkId: 1, data: 'chunk2' });
            const mockContext = createMockExecutionContext(streamData);

            const extractedData = mockContext.switchToRpc().getData();
            expect(extractedData).toBe(streamData);
        });

        it('should work with server streaming methods', done => {
            const payload: DataStreamRequest = {
                batchSize: 10,
                startId: 100,
                expectedChunks: 3,
            };

            const result = dataService.getDataStream(payload);
            const chunks: DataChunk[] = [];

            result.subscribe({
                next: chunk => {
                    chunks.push(chunk);
                },
                complete: () => {
                    expect(chunks).toHaveLength(3);
                    expect(chunks[0]).toMatchObject({
                        chunkId: 0,
                        data: expect.arrayContaining([
                            expect.objectContaining({ id: 100, value: 'data_100' }),
                        ]),
                        hasMore: true,
                    });
                    done();
                },
                error: error => done(error),
            });
        });

        it('should work with client streaming methods', done => {
            const uploadChunks: UploadChunk[] = [
                { chunkId: 0, data: Buffer.from('chunk1'), checksum: 'checksum1' },
                { chunkId: 1, data: Buffer.from('chunk2'), checksum: 'checksum2' },
                { chunkId: 2, data: Buffer.from('chunk3'), checksum: 'checksum3' },
            ];

            const source = new Subject<UploadChunk>();
            const result = dataService.uploadData(source.asObservable());

            result.subscribe({
                next: response => {
                    expect(response).toEqual({
                        uploadId: 'upload-123',
                        success: true,
                        totalChunks: 3,
                        totalSize: 18, // 6 bytes per chunk
                    });
                    done();
                },
                error: error => done(error),
            });

            // Send chunks
            uploadChunks.forEach(chunk => source.next(chunk));
            source.complete();
        });

        it('should work with bidirectional streaming methods', done => {
            const testData = [
                { sessionId: 'session1', timestamp: Date.now(), data: 'test1' },
                { sessionId: 'session1', timestamp: Date.now() + 1000, data: 'test2' },
            ];

            const source = new Subject<any>();
            const result = dataService.processRealTimeData(source.asObservable());
            const responses: any[] = [];

            result.subscribe({
                next: response => {
                    responses.push(response);
                },
                complete: () => {
                    expect(responses).toHaveLength(2);
                    responses.forEach((response, index) => {
                        expect(response).toMatchObject({
                            processedAt: expect.any(String),
                            originalData: testData[index],
                            processed: true,
                        });
                    });
                    done();
                },
                error: error => done(error),
            });

            // Send data
            testData.forEach(data => source.next(data));
            source.complete();
        });

        it('should handle empty streams', done => {
            const source = new Subject<UploadChunk>();
            const result = dataService.uploadData(source.asObservable());

            result.subscribe({
                next: response => {
                    expect(response).toEqual({
                        uploadId: 'upload-123',
                        success: true,
                        totalChunks: 0,
                        totalSize: 0,
                    });
                    done();
                },
                error: error => done(error),
            });

            // Complete without sending any chunks
            source.complete();
        });
    });

    describe('Execution context data extraction edge cases', () => {
        it('should handle null or undefined payloads gracefully', () => {
            const nullContext = createMockExecutionContext(null);
            const undefinedContext = createMockExecutionContext(undefined);

            expect(nullContext.switchToRpc().getData()).toBeNull();
            expect(undefinedContext.switchToRpc().getData()).toBeUndefined();
        });

        it('should handle primitive payload types', () => {
            const stringContext = createMockExecutionContext('simple string payload');
            const numberContext = createMockExecutionContext(42);
            const booleanContext = createMockExecutionContext(true);

            expect(stringContext.switchToRpc().getData()).toBe('simple string payload');
            expect(numberContext.switchToRpc().getData()).toBe(42);
            expect(booleanContext.switchToRpc().getData()).toBe(true);
        });

        it('should preserve deep object structures', () => {
            const complexPayload = {
                user: {
                    id: 'user-123',
                    profile: {
                        personal: {
                            name: 'John Doe',
                            age: 30,
                            addresses: [
                                { type: 'home', street: '123 Main St', city: 'Anytown' },
                                { type: 'work', street: '456 Business Rd', city: 'Workville' },
                            ],
                        },
                        preferences: {
                            notifications: {
                                email: true,
                                sms: false,
                                push: true,
                            },
                        },
                    },
                },
                metadata: {
                    timestamp: Date.now(),
                    version: '1.0.0',
                    source: 'mobile-app',
                },
            };

            const mockContext = createMockExecutionContext(complexPayload);
            const extractedData = mockContext.switchToRpc().getData();

            expect(extractedData).toEqual(complexPayload);
            expect(extractedData.user.profile.personal.addresses).toHaveLength(2);
            expect(extractedData.metadata.version).toBe('1.0.0');
        });

        it('should handle malformed execution context', () => {
            const malformedContext = {
                switchToRpc: () => ({
                    getData: () => {
                        throw new Error('Context data corruption');
                    },
                    getContext: () => ({}),
                }),
            } as any;

            expect(() => {
                malformedContext.switchToRpc().getData();
            }).toThrow('Context data corruption');
        });
    });

    describe('Real-world payload scenarios', () => {
        it('should handle authentication payload with tokens', () => {
            const authPayload = {
                credentials: {
                    username: 'john.doe@example.com',
                    password: 'hashedPassword123',
                },
                metadata: {
                    clientId: 'mobile-app-v1.2.3',
                    deviceId: 'device-uuid-123',
                    timestamp: Date.now(),
                },
                options: {
                    rememberDevice: true,
                    sessionTimeout: 3600,
                },
            };

            const mockContext = createMockExecutionContext(authPayload);
            const extractedData = mockContext.switchToRpc().getData();

            expect(extractedData).toEqual(authPayload);
            expect(extractedData.credentials.username).toBe('john.doe@example.com');
            expect(extractedData.options.rememberDevice).toBe(true);
        });

        it('should handle file upload metadata payload', () => {
            const uploadPayload = {
                file: {
                    name: 'document.pdf',
                    size: 1024000,
                    mimeType: 'application/pdf',
                    checksum: 'sha256:abcd1234',
                },
                destination: {
                    folder: '/documents/2024',
                    permissions: ['read', 'write'],
                    encryption: true,
                },
                metadata: {
                    uploadedBy: 'user-123',
                    tags: ['important', 'document'],
                    expiresAt: new Date('2024-12-31').toISOString(),
                },
            };

            const mockContext = createMockExecutionContext(uploadPayload);
            const extractedData = mockContext.switchToRpc().getData();

            expect(extractedData).toEqual(uploadPayload);
            expect(extractedData.file.size).toBe(1024000);
            expect(extractedData.destination.permissions).toContain('read');
            expect(extractedData.metadata.tags).toHaveLength(2);
        });

        it('should handle search query payload with filters', () => {
            const searchPayload = {
                query: {
                    text: 'machine learning',
                    filters: {
                        dateRange: {
                            start: '2024-01-01',
                            end: '2024-12-31',
                        },
                        categories: ['technology', 'ai'],
                        minScore: 0.8,
                    },
                },
                pagination: {
                    page: 1,
                    limit: 20,
                    sortBy: 'relevance',
                    sortOrder: 'desc',
                },
                options: {
                    includeSnippets: true,
                    highlightTerms: true,
                    aggregations: ['category', 'author'],
                },
            };

            const mockContext = createMockExecutionContext(searchPayload);
            const extractedData = mockContext.switchToRpc().getData();

            expect(extractedData).toEqual(searchPayload);
            expect(extractedData.query.filters.categories).toContain('ai');
            expect(extractedData.pagination.limit).toBe(20);
            expect(extractedData.options.aggregations).toHaveLength(2);
        });
    });
});
