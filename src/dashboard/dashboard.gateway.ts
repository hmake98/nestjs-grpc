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
import { DashboardService, LogEntry, GrpcConnection, StatsData } from './dashboard.service';
import { Logger, Inject, OnModuleDestroy } from '@nestjs/common';

@WebSocketGateway({
    namespace: 'grpc-dashboard',
    cors: {
        origin: '*',
    },
})
export class DashboardGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
    @WebSocketServer() server: Server;
    private logger = new Logger('DashboardGateway');
    private logUnsubscribe: (() => void) | null = null;
    private connectionUnsubscribe: (() => void) | null = null;
    private statsUnsubscribe: (() => void) | null = null;
    private clientCount = 0;

    constructor(
        private readonly dashboardService: DashboardService,
        @Inject('DASHBOARD_OPTIONS')
        private readonly options: { cors: { origin: string | string[] | boolean } },
    ) {}

    afterInit(server: Server) {
        // Set CORS options safely
        try {
            // Check if server and server.engine exist before accessing
            if (server && server.engine && typeof server.engine.on === 'function') {
                server.engine.on('connection', socket => {
                    if (socket && socket.handshake && socket.handshake.headers) {
                        socket.handshake.headers.origin = this.options.cors.origin;
                    }
                });
            } else {
                // Alternative approach for newer Socket.io versions
                this.logger.log('Setting CORS options through gateway configuration');
                // CORS is now configured through the @WebSocketGateway decorator
            }
        } catch (error) {
            this.logger.error('Error setting CORS options: ' + error.message);
        }

        this.logger.log('Dashboard WebSocket Gateway initialized');

        // Subscribe to logs
        try {
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
        } catch (error) {
            this.logger.error('Error subscribing to dashboard events: ' + error.message);
        }
    }

    handleConnection(client: Socket) {
        this.clientCount++;
        this.logger.log(`Client connected: ${client.id}, total clients: ${this.clientCount}`);

        try {
            // Send initial data
            client.emit('services', this.dashboardService.getServices());
            client.emit('connections', this.dashboardService.getConnections());
            client.emit('stats', this.dashboardService.getStats());
        } catch (error) {
            this.logger.error('Error sending initial data to client: ' + error.message);
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
            client.emit('logs', logs);
            return logs;
        } catch (error) {
            this.logger.error('Error retrieving logs: ' + error.message);
            return { error: error.message };
        }
    }

    @SubscribeMessage('getServices')
    handleGetServices(@ConnectedSocket() client: Socket) {
        try {
            const services = this.dashboardService.getServices();
            client.emit('services', services);
            return services;
        } catch (error) {
            this.logger.error('Error retrieving services: ' + error.message);
            return { error: error.message };
        }
    }

    @SubscribeMessage('getConnections')
    handleGetConnections(@ConnectedSocket() client: Socket) {
        try {
            const connections = this.dashboardService.getConnections();
            client.emit('connections', connections);
            return connections;
        } catch (error) {
            this.logger.error('Error retrieving connections: ' + error.message);
            return { error: error.message };
        }
    }

    @SubscribeMessage('getStats')
    handleGetStats(@ConnectedSocket() client: Socket) {
        try {
            const stats = this.dashboardService.getStats();
            client.emit('stats', stats);
            return stats;
        } catch (error) {
            this.logger.error('Error retrieving stats: ' + error.message);
            return { error: error.message };
        }
    }

    // Make sure we clean up when the gateway is destroyed
    onModuleDestroy() {
        try {
            if (this.logUnsubscribe) {
                this.logUnsubscribe();
            }
            if (this.connectionUnsubscribe) {
                this.connectionUnsubscribe();
            }
            if (this.statsUnsubscribe) {
                this.statsUnsubscribe();
            }
            this.logger.log('WebSocket Gateway cleanup completed');
        } catch (error) {
            this.logger.error('Error during gateway cleanup: ' + error.message);
        }
    }
}
