import type { OpenClawPluginApi } from "./plugin-sdk-types.js";
export type { OpenClawConfig, OpenClawPluginApi, PluginCliContext, PluginCommandContext, PluginCommandResult, PluginLogger, ProviderPlugin, } from "./plugin-sdk-types.js";
export interface NemoClawConfig {
    blueprintVersion: string;
    blueprintRegistry: string;
    sandboxName: string;
    inferenceProvider: string;
}
export declare function getPluginConfig(api: OpenClawPluginApi): NemoClawConfig;
export default function register(api: OpenClawPluginApi): void;
//# sourceMappingURL=index.d.ts.map