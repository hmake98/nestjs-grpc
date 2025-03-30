export interface GrpcServiceOptions {
    /**
     * Service name as defined in the proto file
     */
    serviceName?: string;

    /**
     * The proto package name
     */
    package?: string;

    /**
     * The proto file path (relative to the application root)
     */
    protoPath?: string;
}
