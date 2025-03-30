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
        // Set CORS options from module configuration
        server.engine.on('connection', socket => {
            socket.handshake.headers.origin = this.options.cors.origin;
        });

        this.logger.log('Dashboard WebSocket Gateway initialized');

        // Subscribe to logs
        this.logUnsubscribe = this.dashboardService.onLog((log: LogEntry) => {
            this.server.emit('log', log);
        });

        // Subscribe to connection updates
        this.connectionUnsubscribe = this.dashboardService.onConnection(
            (connection: GrpcConnection) => {
                this.server.emit('connection', connection);
            },
        );

        // Subscribe to stats updates
        this.statsUnsubscribe = this.dashboardService.onStats((stats: StatsData) => {
            this.server.emit('stats', stats);
        });
    }

    handleConnection(client: Socket) {
        this.clientCount++;
        this.logger.log(`Client connected: ${client.id}, total clients: ${this.clientCount}`);

        // Send initial data
        client.emit('services', this.dashboardService.getServices());
        client.emit('connections', this.dashboardService.getConnections());
        client.emit('stats', this.dashboardService.getStats());
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
        const logs = this.dashboardService.getLogs(data.levels, data.service, data.limit);
        client.emit('logs', logs);
        return logs;
    }

    @SubscribeMessage('getServices')
    handleGetServices(@ConnectedSocket() client: Socket) {
        const services = this.dashboardService.getServices();
        client.emit('services', services);
        return services;
    }

    @SubscribeMessage('getConnections')
    handleGetConnections(@ConnectedSocket() client: Socket) {
        const connections = this.dashboardService.getConnections();
        client.emit('connections', connections);
        return connections;
    }

    @SubscribeMessage('getStats')
    handleGetStats(@ConnectedSocket() client: Socket) {
        const stats = this.dashboardService.getStats();
        client.emit('stats', stats);
        return stats;
    }

    // Make sure we clean up when the gateway is destroyed
    onModuleDestroy() {
        if (this.logUnsubscribe) {
            this.logUnsubscribe();
        }
        if (this.connectionUnsubscribe) {
            this.connectionUnsubscribe();
        }
        if (this.statsUnsubscribe) {
            this.statsUnsubscribe();
        }
    }
}
