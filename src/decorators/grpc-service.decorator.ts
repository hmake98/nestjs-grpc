import { Inject } from '@nestjs/common';

import { GRPC_SERVICE_METADATA, GRPC_CLIENT_TOKEN_PREFIX } from '../constants';

import type { GrpcServiceOptions } from '../interfaces';

/**
 * Decorator that marks a class as a gRPC service client definition.
 * Used on client-side classes to automatically inject and configure gRPC service clients
 * with connection pooling, retry logic, and type safety.
 *
 * @param serviceNameOrOptions - The service name as defined in the proto file or options object
 *
 * @example
 * ```typescript
 * // Basic service client definition
 * @GrpcService('AuthService')
 * export class AuthServiceClient {
 *   // Client methods will be automatically populated from proto definition
 * }
 *
 * // Service client with custom configuration
 * @GrpcService({
 *   serviceName: 'UserService',
 *   package: 'com.example.users',
 *   url: 'user-service:50051',
 *   clientOptions: {
 *     maxRetries: 5,
 *     timeout: 10000,
 *     secure: true
 *   }
 * })
 * export class UserServiceClient {
 *   // Enhanced client with custom retry and security settings
 * }
 *
 * // Usage in business logic service
 * @Injectable()
 * export class AuthService {
 *   constructor(
 *     private readonly authClient: AuthServiceClient,
 *     private readonly userClient: UserServiceClient
 *   ) {}
 *
 *   async authenticateUser(email: string, password: string) {
 *     // Call gRPC service with automatic retry and error handling
 *     const authResult = await this.authClient.login({ email, password });
 *
 *     if (authResult.success) {
 *       // Chain multiple service calls
 *       const userProfile = await this.userClient.getProfile({
 *         userId: authResult.userId
 *       });
 *
 *       return { token: authResult.token, profile: userProfile };
 *     }
 *
 *     throw new UnauthorizedException('Invalid credentials');
 *   }
 *
 *   async refreshToken(oldToken: string) {
 *     return this.authClient.refreshToken({ token: oldToken });
 *   }
 * }
 * ```
 */
export function GrpcService(serviceNameOrOptions: string | GrpcServiceOptions): ClassDecorator {
    const options: GrpcServiceOptions =
        typeof serviceNameOrOptions === 'string'
            ? { serviceName: serviceNameOrOptions }
            : serviceNameOrOptions;

    if (!options.serviceName || typeof options.serviceName !== 'string') {
        throw new Error('Service name is required and must be a string');
    }

    if (options.serviceName.trim().length === 0) {
        throw new Error('Service name cannot be empty');
    }

    return (target: any) => {
        if (!target || typeof target !== 'function') {
            throw new Error('@GrpcService can only be applied to classes');
        }

        // Store service metadata
        Reflect.defineMetadata(GRPC_SERVICE_METADATA, options, target);

        return target;
    };
}

/**
 * Parameter decorator to inject a gRPC client for a specific service.
 * Provides direct injection without requiring a separate @GrpcService class.
 * Useful for lightweight client usage or when you need multiple service clients.
 *
 * @param serviceName - The service name as defined in the proto file
 *
 * @example
 * ```typescript
 * // Direct client injection for simple usage
 * @Injectable()
 * export class NotificationService {
 *   constructor(
 *     @InjectGrpcClient('EmailService') private emailClient: any,
 *     @InjectGrpcClient('SmsService') private smsClient: any,
 *     @InjectGrpcClient('PushService') private pushClient: any
 *   ) {}
 *
 *   async sendWelcomeNotification(userId: string, email: string, phone: string) {
 *     // Send via multiple channels concurrently
 *     const [emailResult, smsResult, pushResult] = await Promise.allSettled([
 *       this.emailClient.sendWelcomeEmail({ userId, email }),
 *       this.smsClient.sendWelcomeSms({ userId, phone }),
 *       this.pushClient.sendWelcomePush({ userId })
 *     ]);
 *
 *     return {
 *       email: emailResult.status === 'fulfilled',
 *       sms: smsResult.status === 'fulfilled',
 *       push: pushResult.status === 'fulfilled'
 *     };
 *   }
 *
 *   async sendOrderConfirmation(orderId: string, userEmail: string) {
 *     // Simple single service call
 *     return this.emailClient.sendOrderConfirmation({
 *       orderId,
 *       recipientEmail: userEmail
 *     });
 *   }
 * }
 *
 * // Mixed usage with both patterns
 * @Injectable()
 * export class OrderService {
 *   constructor(
 *     private readonly paymentClient: PaymentServiceClient, // From @GrpcService
 *     @InjectGrpcClient('InventoryService') private inventoryClient: any, // Direct injection
 *     @InjectGrpcClient('ShippingService') private shippingClient: any
 *   ) {}
 *
 *   async processOrder(orderData: CreateOrderRequest) {
 *     // Check inventory availability
 *     const inventory = await this.inventoryClient.checkAvailability({
 *       items: orderData.items
 *     });
 *
 *     if (!inventory.available) {
 *       throw new BadRequestException('Items not available');
 *     }
 *
 *     // Process payment using the injected service client
 *     const payment = await this.paymentClient.processPayment({
 *       amount: orderData.total,
 *       paymentMethod: orderData.paymentMethod
 *     });
 *
 *     // Create shipping label
 *     const shipping = await this.shippingClient.createShippingLabel({
 *       orderId: payment.orderId,
 *       address: orderData.shippingAddress
 *     });
 *
 *     return { orderId: payment.orderId, trackingNumber: shipping.trackingNumber };
 *   }
 * }
 * ```
 */
export function InjectGrpcClient(serviceName: string): ParameterDecorator {
    if (!serviceName || typeof serviceName !== 'string') {
        throw new Error('Service name is required and must be a string for @InjectGrpcClient');
    }

    if (serviceName.trim().length === 0) {
        throw new Error('Service name cannot be empty for @InjectGrpcClient');
    }

    const token = `${GRPC_CLIENT_TOKEN_PREFIX}${serviceName.trim()}`;
    return Inject(token);
}
