export interface GrpcMethodOptions {
    /**
     * Method name as defined in the proto file
     * If not provided, the method name will be used
     */
    methodName?: string;

    /**
     * Request type name as defined in the proto file
     */
    requestType?: string;

    /**
     * Response type name as defined in the proto file
     */
    responseType?: string;

    /**
     * Whether the method is a server streaming method
     */
    streaming?: boolean;
}
