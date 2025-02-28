import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as chalk from 'chalk';
import * as protobuf from 'protobufjs';
import * as chokidar from 'chokidar';

interface GenerateCommandOptions {
    proto: string;
    output: string;
    watch: boolean;
}

export async function generateCommand(options: GenerateCommandOptions): Promise<void> {
    try {
        const protoFiles = glob.sync(options.proto);

        if (protoFiles.length === 0) {
            console.log(chalk.yellow(`No proto files found matching pattern: ${options.proto}`));
            return;
        }

        console.log(chalk.blue(`Found ${protoFiles.length} proto file(s)`));

        // Initial generation
        for (const protoFile of protoFiles) {
            await generateTypesForFile(protoFile, options.output);
        }

        // Setup watch mode if requested
        if (options.watch) {
            console.log(chalk.blue('\nWatching for changes...'));

            const watcher = chokidar.watch(options.proto, {
                persistent: true,
                ignoreInitial: true,
            });

            watcher.on('add', async filePath => {
                console.log(chalk.green(`File added: ${filePath}`));
                await generateTypesForFile(filePath, options.output);
            });

            watcher.on('change', async filePath => {
                console.log(chalk.green(`File changed: ${filePath}`));
                await generateTypesForFile(filePath, options.output);
            });

            watcher.on('unlink', filePath => {
                const outputFile = getOutputPath(filePath, options.output);
                if (fs.existsSync(outputFile)) {
                    fs.unlinkSync(outputFile);
                    console.log(chalk.yellow(`Removed generated file: ${outputFile}`));
                }
            });

            // Keep process alive
            process.stdin.resume();
        }
    } catch (error) {
        console.error(chalk.red('Error generating types:'), error);
        process.exit(1);
    }
}

async function generateTypesForFile(protoFile: string, outputDir: string): Promise<void> {
    try {
        const outputFile = getOutputPath(protoFile, outputDir);

        // Load the proto file
        const root = await protobuf.load(protoFile);

        // Generate TypeScript interfaces
        const typeDefinitions = generateTypeDefinitions(root);

        // Write to file
        writeTypesToFile(typeDefinitions, outputFile);

        console.log(chalk.green(`Generated types for ${protoFile} → ${outputFile}`));
    } catch (error) {
        console.error(chalk.red(`Error processing ${protoFile}:`), error);
    }
}

function getOutputPath(protoFile: string, outputDir: string): string {
    const baseName = path.basename(protoFile, '.proto');
    return path.join(outputDir, `${baseName}.ts`);
}

function generateTypeDefinitions(root: protobuf.Root): string {
    const typeDefinitions = '// This file is auto-generated by nestjs-grpc\n\n';

    // Process all nested types recursively
    processNamespace(root, '', typeDefinitions);

    return typeDefinitions;
}

function processNamespace(
    namespace: protobuf.NamespaceBase,
    prefix: string,
    output: string,
): string {
    namespace.nestedArray.forEach(nested => {
        const fullName = prefix ? `${prefix}.${nested.name}` : nested.name;

        if (nested instanceof protobuf.Type) {
            output += processMessageType(nested, fullName);
        } else if (nested instanceof protobuf.Service) {
            output += processServiceType(nested, fullName);
        } else if (nested instanceof protobuf.Enum) {
            output += processEnumType(nested, fullName);
        } else if (nested instanceof protobuf.Namespace) {
            output += processNamespace(nested, fullName, '');
        }
    });

    return output;
}

function processMessageType(type: protobuf.Type, fullName: string): string {
    let definition = `export interface ${type.name} {\n`;

    type.fieldsArray.forEach(field => {
        const fieldType = mapProtoTypeToTs(field.type, field.repeated);
        const isOptional = !field.required;
        definition += `  ${field.name}${isOptional ? '?' : ''}: ${fieldType};\n`;
    });

    definition += '}\n\n';
    return definition;
}

function processServiceType(service: protobuf.Service, fullName: string): string {
    let definition = `export interface ${service.name}Client {\n`;

    service.methodsArray.forEach(method => {
        const inputType = method.requestType.split('.').pop();
        const outputType = method.responseType.split('.').pop();

        if (method.responseStream) {
            definition += `  ${method.name}(request: ${inputType}): Observable<${outputType}>;\n`;
        } else {
            definition += `  ${method.name}(request: ${inputType}): Promise<${outputType}>;\n`;
        }
    });

    definition += '}\n\n';

    // Also generate a service interface for implementing the service
    definition += `export interface ${service.name}Interface {\n`;
    service.methodsArray.forEach(method => {
        const inputType = method.requestType.split('.').pop();
        const outputType = method.responseType.split('.').pop();

        if (method.responseStream) {
            definition += `  ${method.name}(request: ${inputType}): Observable<${outputType}>;\n`;
        } else {
            definition += `  ${method.name}(request: ${inputType}): Promise<${outputType}> | ${outputType};\n`;
        }
    });
    definition += '}\n\n';

    return definition;
}

function processEnumType(enumType: protobuf.Enum, fullName: string): string {
    let definition = `export enum ${enumType.name} {\n`;

    Object.keys(enumType.values).forEach(key => {
        definition += `  ${key} = ${enumType.values[key]},\n`;
    });

    definition += '}\n\n';
    return definition;
}

function mapProtoTypeToTs(protoType: string, repeated: boolean): string {
    const typeMap: { [key: string]: string } = {
        string: 'string',
        bool: 'boolean',
        int32: 'number',
        int64: 'string',
        uint32: 'number',
        uint64: 'string',
        sint32: 'number',
        sint64: 'string',
        fixed32: 'number',
        fixed64: 'string',
        sfixed32: 'number',
        sfixed64: 'string',
        float: 'number',
        double: 'number',
        bytes: 'Uint8Array',
    };

    const mappedType = typeMap[protoType] || protoType;
    return repeated ? `${mappedType}[]` : mappedType;
}

function writeTypesToFile(content: string, outputPath: string): void {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf8');
}
