# nestjs-grpc — Copilot instructions (concise)

## Quick context (what this library is)

- A NestJS package that provides **type-safe gRPC** provider (server) and
  consumer (client) functionality, using decorators and metadata to wire
  protobuf definitions to NestJS controllers and methods.

## Essential commands

- Build: `npm run build` (SWC compile + declarations + CLI copy)
- Tests: `npm run test` (Jest). NOTE: run tests with `--maxWorkers=1` locally to
  avoid gRPC port conflicts
- Lint / Format: `npm run lint` / `npm run format`
- Docs: `npm run docs` and `npm run docs:serve`
- Generate types from .proto: `npx nestjs-grpc generate`
- Prepublish/Validate: `npm run validate` (runs lint/format/test and checks CLI)

Notes:

- Node engine: >= 18.0.0

## Big picture

- Dual-mode module: `GrpcModule.forProvider(...)` (server) and
  `GrpcModule.forConsumer(...)` (client).
- Core services: `GrpcProtoService` (proto parsing & caching),
  `GrpcProviderService` (server lifecycle & routing), `GrpcClientService`
  (client pooling, retry, `call()` / `serverStream()`).

Important patterns & conventions

- Decorators + metadata: `@GrpcController('Name')`, `@GrpcMethod('RpcName')`,
  `@GrpcStream('RpcName')` (metadata keys live in `src/constants.ts`).
- Controllers must match proto services exactly (method names are
  case-sensitive) and be registered in the `controllers` array when using
  `forProvider()`.
- Server streaming returns RxJS `Observable`.
- Use `GrpcClientService.call<Request, Response>(service, method, payload)` for
  typed client calls; clients are cached per connection key (TTL ≈ 5 minutes).
- Error handling: prefer `GrpcException` factories for standard statuses.

Testing & dev notes (must follow)

- Global test setup: `test/setup.ts` imports `reflect-metadata`, sets timers,
  and mocks heavy deps (`@grpc/grpc-js`, `@grpc/proto-loader`, `protobufjs`).
  See `test/__mocks__/` for mocks.
- Run tests locally with `npm run test -- --maxWorkers=1` to avoid port
  conflicts; use `safeCleanupTimers()` and `jest.clearAllMocks()` in tests.

## Key Files

- `src/grpc.module.ts` — core module
- `src/services/grpc-provider.service.ts` — server lifecycle & routing
- `src/services/grpc-client.service.ts` — client pooling, retry,
  call()/streaming
- `src/decorators/` — decorator implementations and metadata
- `src/constants.ts` — metadata keys and defaults
- `test/setup.ts` — test bootstrap and global mocks

## Where to look for specifics

- `src/decorators/` — decorator implementations and metadata keys
- `src/services/` — provider/client/discovery/registry implementations
- `src/cli/` — codegen CLI (protobuf parsing & generation)
- `test/` & `test/__mocks__/` — how tests mock gRPC and clean up
- `docs/` — generated typedoc output

---

If any section is unclear or you want me to expand specific examples (e.g.,
testing patterns, a typical PR checklist, or the generator's CLI flags), tell me
which area and I’ll iterate. ✅
