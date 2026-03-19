// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { buildSandboxConfigSyncScript } = require("../bin/lib/onboard");

describe("onboard helpers", () => {
  it("builds a sandbox sync script that writes config and updates the selected model", () => {
    const script = buildSandboxConfigSyncScript({
      endpointType: "custom",
      endpointUrl: "https://inference.local/v1",
      ncpPartner: null,
      model: "nemotron-3-nano:30b",
      profile: "inference-local",
      credentialEnv: "OPENAI_API_KEY",
      onboardedAt: "2026-03-18T12:00:00.000Z",
    });

    assert.match(script, /cat > ~\/\.nemoclaw\/config\.json/);
    assert.match(script, /"model": "nemotron-3-nano:30b"/);
    assert.match(script, /"credentialEnv": "OPENAI_API_KEY"/);
    assert.match(script, /openclaw models set 'inference\/nemotron-3-nano:30b'/);
    assert.match(script, /cfg\.setdefault\('agents', \{\}\)\.setdefault\('defaults', \{\}\)\.setdefault\('model', \{\}\)\['primary'\]/);
    assert.match(script, /providers_cfg\["inference"\]/);
    assert.match(script, /json\.loads\("\{\\\"baseUrl\\\":\\\"https:\/\/inference\.local\/v1\\\",\\\"apiKey\\\":\\\"unused\\\"/);
    assert.match(script, /inference\/nemotron-3-nano:30b/);
    assert.match(script, /^exit$/m);
  });

  it("marks local llama-server sandbox model config as vision-capable", () => {
    const script = buildSandboxConfigSyncScript({
      endpointType: "custom",
      endpointUrl: "https://inference.local/v1",
      ncpPartner: null,
      model: "Qwen3.5-122B-A10B-IQ4_KSS.gguf",
      profile: "inference-local",
      credentialEnv: "OPENAI_API_KEY",
      provider: "llama-server-local",
      onboardedAt: "2026-03-19T10:00:00.000Z",
    });

    assert.match(script, /\\"input\\":\[\\"text\\",\\"image\\"\]/);
    assert.match(script, /\\"maxTokens\\":8192/);
    assert.match(script, /inference\/Qwen3\.5-122B-A10B-IQ4_KSS\.gguf/);
  });

  it("auto-enables SearXNG web search defaults in the sandbox config sync script", () => {
    const script = buildSandboxConfigSyncScript({
      endpointType: "custom",
      endpointUrl: "https://inference.local/v1",
      ncpPartner: null,
      model: "Qwen3.5-122B-A10B-IQ4_KSS.gguf",
      profile: "inference-local",
      credentialEnv: "OPENAI_API_KEY",
      provider: "llama-server-local",
      onboardedAt: "2026-03-20T09:00:00.000Z",
    });

    assert.match(script, /search_cfg\['enabled'\] = True/);
    assert.match(script, /search_cfg\.setdefault\('provider', 'searxng'\)/);
    assert.match(script, /searxng_cfg = search_cfg\.setdefault\('searxng', \{\}\)/);
    assert.match(script, /http:\/\/host\.openshell\.internal:8081\/search/);
    assert.match(script, /ja-JP/);
  });
});
