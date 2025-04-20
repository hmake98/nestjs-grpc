import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, OnModuleDestroy } from '@nestjs/common';
import { GrpcDashboardOptions } from '../interfaces/grpc-dashboard-options.interface';
import { DASHBOARD_OPTIONS, DASHBOARD_SOCKET_NAMESPACE } from './dashboard.constants';
import { GrpcDashboardService } from './dashboard.service';
import { GrpcConnection, LogEntry, StatsData } from './dashboard.interface';

@WebSocketGateway({
    namespace: DASHBOARD_SOCKET_NAMESPACE,
    cors: true, // Will be configured dynamically from options
})
export class GrpcDashboardGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
    @WebSocketServer() server: Server;
    private logger = new Logger('DashboardGateway');
    private logUnsubscribe: (() => void) | null = null;
    private connectionUnsubscribe: (() => void) | null = null;
    private statsUnsubscribe: (() => void) | null = null;
    private clientCount = 0;

    constructor(
        private readonly dashboardService: GrpcDashboardService,
        @Inject(DASHBOARD_OPTIONS)
        private readonly options: Required<GrpcDashboardOptions>,
    ) {}

    afterInit(server: Server) {
        // CORS is configured through the WebSocketGateway decorator
        if (this.options.cors) {
            this.logger.log(`CORS configuration loaded: ${JSON.stringify(this.options.cors)}`);
        }

        this.logger.log('Dashboard WebSocket Gateway initialized');

        // Subscribe to event sources
        this.subscribeToEvents();
    }

    private subscribeToEvents() {
        try {
            // Subscribe to logs
            this.logUnsubscribe = this.dashboardService.onLog((log: LogEntry) => {
                if (this.server) {
                    this.server.emit('log', log);
                }
            });

            // Subscribe to connection updates
            this.connectionUnsubscribe = this.dashboardService.onConnection(
                (connection: GrpcConnection) => {
                    if (this.server) {
                        this.server.emit('connection', connection);
                    }
                },
            );

            // Subscribe to stats updates
            this.statsUnsubscribe = this.dashboardService.onStats((stats: StatsData) => {
                if (this.server) {
                    this.server.emit('stats', stats);
                }
            });

            this.logger.debug('Successfully subscribed to all event sources');
        } catch (error) {
            this.logger.error('Error subscribing to dashboard events: ' + error.message);
        }
    }

    handleConnection(client: Socket) {
        this.clientCount++;
        this.logger.log(`Client connected: ${client.id}, total clients: ${this.clientCount}`);

        // Send initial data to the new client
        this.sendInitialData(client);
    }

    private sendInitialData(client: Socket) {
        try {
            client.emit('services', this.dashboardService.getServices());
            client.emit('connections', this.dashboardService.getConnections());
            client.emit('stats', this.dashboardService.getStats());
            // Only send recent logs initially to avoid overwhelming the client
            client.emit('logs', this.dashboardService.getLogs(undefined, undefined, 50));

            this.logger.debug(`Initial data sent to client: ${client.id}`);
        } catch (error) {
            this.logger.error(
                `Error sending initial data to client ${client.id}: ${error.message}`,
            );
        }
    }

    handleDisconnect(client: Socket) {
        this.clientCount--;
        this.logger.log(
            `Client disconnected: ${client.id}, remaining clients: ${this.clientCount}`,
        );
    }

    @SubscribeMessage('getLogs')
    handleGetLogs(
        @MessageBody() data: { levels?: string[]; service?: string; limit?: number } = {},
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const logs = this.dashboardService.getLogs(data.levels, data.service, data.limit);
            return { event: 'logs', data: logs };
        } catch (error) {
            this.logger.error('Error retrieving logs: ' + error.message);
            return { event: 'error', data: { message: error.message } };
        }
    }

    @SubscribeMessage('getServices')
    handleGetServices() {
        try {
            const services = this.dashboardService.getServices();
            return { event: 'services', data: services };
        } catch (error) {
            this.logger.error('Error retrieving services: ' + error.message);
            return { event: 'error', data: { message: error.message } };
        }
    }

    @SubscribeMessage('getConnections')
    handleGetConnections() {
        try {
            const connections = this.dashboardService.getConnections();
            return { event: 'connections', data: connections };
        } catch (error) {
            this.logger.error('Error retrieving connections: ' + error.message);
            return { event: 'error', data: { message: error.message } };
        }
    }

    @SubscribeMessage('getStats')
    handleGetStats() {
        try {
            const stats = this.dashboardService.getStats();
            return { event: 'stats', data: stats };
        } catch (error) {
            this.logger.error('Error retrieving stats: ' + error.message);
            return { event: 'error', data: { message: error.message } };
        }
    }

    onModuleDestroy() {
        try {
            // Clean up all subscriptions
            [this.logUnsubscribe, this.connectionUnsubscribe, this.statsUnsubscribe]
                .filter(Boolean)
                .forEach(unsubscribe => unsubscribe && unsubscribe());

            this.logger.log('WebSocket Gateway cleanup completed');
        } catch (error) {
            this.logger.error('Error during gateway cleanup: ' + error.message);
        }
    }
}
