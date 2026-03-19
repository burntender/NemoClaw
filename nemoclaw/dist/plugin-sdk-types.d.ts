import type { Command } from "commander";
export interface OpenClawConfig {
    [key: string]: unknown;
}
export interface PluginLogger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
}
export interface PluginCommandContext {
    senderId?: string;
    channel: string;
    isAuthorizedSender: boolean;
    args?: string;
    commandBody: string;
    config: OpenClawConfig;
    from?: string;
    to?: string;
    accountId?: string;
}
export interface PluginCommandResult {
    text?: string;
    mediaUrl?: string;
    mediaUrls?: string[];
}
export interface PluginCommandDefinition {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: PluginCommandContext) => PluginCommandResult | Promise<PluginCommandResult>;
}
export interface PluginCliContext {
    program: Command;
    config: OpenClawConfig;
    workspaceDir?: string;
    logger: PluginLogger;
}
export type PluginCliRegistrar = (ctx: PluginCliContext) => void | Promise<void>;
export interface ProviderAuthMethod {
    type: string;
    envVar?: string;
    headerName?: string;
    label?: string;
}
export interface ModelProviderEntry {
    id: string;
    label: string;
    contextWindow?: number;
    maxOutput?: number;
}
export interface ModelProviderConfig {
    chat?: ModelProviderEntry[];
    completion?: ModelProviderEntry[];
}
export interface ProviderPlugin {
    id: string;
    label: string;
    docsPath?: string;
    aliases?: string[];
    envVars?: string[];
    models?: ModelProviderConfig;
    auth: ProviderAuthMethod[];
}
export interface PluginService {
    id: string;
    start: (ctx: {
        config: OpenClawConfig;
        logger: PluginLogger;
    }) => void | Promise<void>;
    stop?: (ctx: {
        config: OpenClawConfig;
        logger: PluginLogger;
    }) => void | Promise<void>;
}
export interface WebSearchProviderToolDefinition {
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}
export interface WebSearchProviderContext {
    config?: OpenClawConfig;
    searchConfig?: Record<string, unknown>;
    runtimeMetadata?: Record<string, unknown>;
}
export interface WebSearchProviderPlugin {
    id: string;
    label: string;
    hint: string;
    envVars: string[];
    placeholder: string;
    signupUrl: string;
    docsUrl?: string;
    autoDetectOrder?: number;
    credentialPath: string;
    inactiveSecretPaths?: string[];
    getCredentialValue: (searchConfig?: Record<string, unknown>) => unknown;
    setCredentialValue: (searchConfigTarget: Record<string, unknown>, value: unknown) => void;
    getConfiguredCredentialValue?: (config?: OpenClawConfig) => unknown;
    setConfiguredCredentialValue?: (configTarget: OpenClawConfig, value: unknown) => void;
    applySelectionConfig?: (config: OpenClawConfig) => OpenClawConfig;
    resolveRuntimeMetadata?: (ctx: WebSearchProviderContext) => Record<string, unknown> | Promise<Record<string, unknown>>;
    createTool: (ctx: WebSearchProviderContext) => WebSearchProviderToolDefinition | null;
}
export interface OpenClawPluginApi {
    id: string;
    name: string;
    version?: string;
    config: OpenClawConfig;
    pluginConfig?: Record<string, unknown>;
    logger: PluginLogger;
    registerCommand: (command: PluginCommandDefinition) => void;
    registerCli: (registrar: PluginCliRegistrar, opts?: {
        commands?: string[];
    }) => void;
    registerProvider: (provider: ProviderPlugin) => void;
    registerService: (service: PluginService) => void;
    registerWebSearchProvider?: (provider: WebSearchProviderPlugin) => void;
    resolvePath: (input: string) => string;
    on: (hookName: string, handler: (...args: unknown[]) => void) => void;
}
//# sourceMappingURL=plugin-sdk-types.d.ts.map