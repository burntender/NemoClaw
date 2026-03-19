// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * NemoClaw — OpenClaw Plugin for OpenShell
 *
 * Uses the real OpenClaw plugin API. Types defined locally are minimal stubs
 * that match the OpenClaw SDK interfaces available at runtime via
 * `openclaw/plugin-sdk`. We define them here because the SDK package is only
 * available inside the OpenClaw host process and cannot be imported at build
 * time.
 */

import { registerCliCommands } from "./cli.js";
import { handleSlashCommand } from "./commands/slash.js";
import {
  describeOnboardEndpoint,
  describeOnboardProvider,
  loadOnboardConfig,
} from "./onboard/config.js";
import type {
  ModelProviderEntry,
  OpenClawPluginApi,
  ProviderPlugin,
} from "./plugin-sdk-types.js";
import { createSearxngWebSearchProvider } from "./web-search/searxng.js";
export type {
  OpenClawConfig,
  OpenClawPluginApi,
  PluginCliContext,
  PluginCommandContext,
  PluginCommandResult,
  PluginLogger,
  ProviderPlugin,
} from "./plugin-sdk-types.js";

// ---------------------------------------------------------------------------
// Plugin-specific config (read from pluginConfig in openclaw.plugin.json)
// ---------------------------------------------------------------------------

export interface NemoClawConfig {
  blueprintVersion: string;
  blueprintRegistry: string;
  sandboxName: string;
  inferenceProvider: string;
}

function activeModelEntries(onboardCfg: ReturnType<typeof loadOnboardConfig>): ModelProviderEntry[] {
  if (!onboardCfg?.model) {
    return [
      {
        id: "nvidia/nemotron-3-super-120b-a12b",
        label: "Nemotron 3 Super 120B (March 2026)",
        contextWindow: 131072,
        maxOutput: 8192,
      },
      {
        id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        label: "Nemotron Ultra 253B",
        contextWindow: 131072,
        maxOutput: 4096,
      },
      {
        id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        label: "Nemotron Super 49B v1.5",
        contextWindow: 131072,
        maxOutput: 4096,
      },
      {
        id: "nvidia/nemotron-3-nano-30b-a3b",
        label: "Nemotron 3 Nano 30B",
        contextWindow: 131072,
        maxOutput: 4096,
      },
    ];
  }

  return [
    {
      id: `inference/${onboardCfg.model}`,
      label: onboardCfg.model,
      contextWindow: 131072,
      maxOutput: 8192,
    },
  ];
}

function registeredProviderForConfig(
  onboardCfg: ReturnType<typeof loadOnboardConfig>,
  providerCredentialEnv: string,
): ProviderPlugin {
  const authLabel =
    providerCredentialEnv === "NVIDIA_API_KEY"
      ? `NVIDIA API Key (${providerCredentialEnv})`
      : `OpenAI API Key (${providerCredentialEnv})`;

  return {
    id: "inference",
    label: "Managed Inference Route",
    aliases: ["inference-local", "nemoclaw"],
    envVars: [providerCredentialEnv],
    models: { chat: activeModelEntries(onboardCfg) },
    auth: [{ type: "bearer", envVar: providerCredentialEnv, headerName: "Authorization", label: authLabel }],
  };
}

const DEFAULT_PLUGIN_CONFIG: NemoClawConfig = {
  blueprintVersion: "latest",
  blueprintRegistry: "ghcr.io/nvidia/nemoclaw-blueprint",
  sandboxName: "openclaw",
  inferenceProvider: "nvidia",
};

export function getPluginConfig(api: OpenClawPluginApi): NemoClawConfig {
  const raw = api.pluginConfig ?? {};
  return {
    blueprintVersion:
      typeof raw["blueprintVersion"] === "string"
        ? raw["blueprintVersion"]
        : DEFAULT_PLUGIN_CONFIG.blueprintVersion,
    blueprintRegistry:
      typeof raw["blueprintRegistry"] === "string"
        ? raw["blueprintRegistry"]
        : DEFAULT_PLUGIN_CONFIG.blueprintRegistry,
    sandboxName:
      typeof raw["sandboxName"] === "string"
        ? raw["sandboxName"]
        : DEFAULT_PLUGIN_CONFIG.sandboxName,
    inferenceProvider:
      typeof raw["inferenceProvider"] === "string"
        ? raw["inferenceProvider"]
        : DEFAULT_PLUGIN_CONFIG.inferenceProvider,
  };
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export default function register(api: OpenClawPluginApi): void {
  // 1. Register /nemoclaw slash command (chat interface)
  api.registerCommand({
    name: "nemoclaw",
    description: "NemoClaw sandbox management (status, eject).",
    acceptsArgs: true,
    handler: (ctx) => handleSlashCommand(ctx, api),
  });

  // 2. Register `openclaw nemoclaw` CLI subcommands (commander.js)
  api.registerCli(
    (cliCtx) => {
      registerCliCommands(cliCtx, api);
    },
    { commands: ["nemoclaw"] },
  );

  // 3. Register nvidia-nim provider — use onboard config if available
  const onboardCfg = loadOnboardConfig();
  const providerCredentialEnv = onboardCfg?.credentialEnv ?? "NVIDIA_API_KEY";
  api.registerProvider(registeredProviderForConfig(onboardCfg, providerCredentialEnv));

  if (typeof api.registerWebSearchProvider === "function") {
    api.registerWebSearchProvider(createSearxngWebSearchProvider());
  } else {
    api.logger.warn("registerWebSearchProvider is unavailable; skipping SearXNG registration.");
  }

  const bannerEndpoint = onboardCfg ? describeOnboardEndpoint(onboardCfg) : "build.nvidia.com";
  const bannerProvider = onboardCfg ? describeOnboardProvider(onboardCfg) : "NVIDIA Cloud API";
  const bannerModel = onboardCfg?.model ?? "nvidia/nemotron-3-super-120b-a12b";

  api.logger.info("");
  api.logger.info("  ┌─────────────────────────────────────────────────────┐");
  api.logger.info("  │  NemoClaw registered                                │");
  api.logger.info("  │                                                     │");
  api.logger.info(`  │  Endpoint:  ${bannerEndpoint.padEnd(40)}│`);
  api.logger.info(`  │  Provider:  ${bannerProvider.padEnd(40)}│`);
  api.logger.info(`  │  Model:     ${bannerModel.padEnd(40)}│`);
  api.logger.info("  │  Commands:  openclaw nemoclaw <command>             │");
  api.logger.info("  └─────────────────────────────────────────────────────┘");
  api.logger.info("");
}
