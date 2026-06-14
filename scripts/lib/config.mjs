import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { mergeDeep, readJsonFile } from "./json.mjs";

export const SUPPORTED_PROVIDERS = new Set(["agy", "opencode", "omp", "claude"]);

export const DEFAULT_CONFIG = Object.freeze({
  default: {},
  providers: {
    agy: { bin: "agy", timeoutMs: 300000 },
    opencode: { bin: "opencode", timeoutMs: 300000 },
    omp: { bin: "omp", timeoutMs: 300000 },
    claude: { bin: "claude", timeoutMs: 300000 }
  },
  history: {
    maxMessages: 120,
    maxChars: 120000
  }
});

export function resolveHome(env = process.env) {
  return env.HOME || os.homedir();
}

export function resolveUserConfigPath(env = process.env) {
  if (env.SHUORENHUA_CONFIG) {
    return env.SHUORENHUA_CONFIG;
  }
  return path.join(resolveHome(env), ".shuorenhua", "config.json");
}

export function findProjectConfig(cwd = process.cwd()) {
  let current = path.resolve(cwd);
  while (true) {
    const candidate = path.join(current, ".shuorenhua.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function buildEnvConfig(env = process.env) {
  const config = {};
  if (env.SHUORENHUA_PROVIDER || env.SHUORENHUA_MODEL) {
    config.default = {};
    if (env.SHUORENHUA_PROVIDER) {
      config.default.provider = env.SHUORENHUA_PROVIDER;
    }
    if (env.SHUORENHUA_MODEL) {
      config.default.model = env.SHUORENHUA_MODEL;
    }
  }
  return config;
}

export function loadConfig({ cwd = process.cwd(), env = process.env, configPath = null, cliOptions = {} } = {}) {
  const sources = [];
  let config = structuredClone(DEFAULT_CONFIG);

  const envConfig = buildEnvConfig(env);
  if (envConfig.default) {
    config = mergeDeep(config, envConfig);
    sources.push({ kind: "env", path: null, hasDefault: true });
  }

  const userConfigPath = resolveUserConfigPath(env);
  if (fs.existsSync(userConfigPath)) {
    const userConfig = readJsonFile(userConfigPath);
    config = mergeDeep(config, userConfig);
    sources.push({ kind: "user", path: userConfigPath, hasDefault: Boolean(userConfig.default) });
  } else {
    sources.push({ kind: "user", path: userConfigPath, missing: true });
  }

  const projectConfigPath = findProjectConfig(cwd);
  if (projectConfigPath) {
    const projectConfig = readJsonFile(projectConfigPath);
    config = mergeDeep(config, projectConfig);
    sources.push({ kind: "project", path: projectConfigPath, hasDefault: Boolean(projectConfig.default) });
  } else {
    sources.push({ kind: "project", path: null, missing: true });
  }

  if (configPath) {
    const explicitPath = path.resolve(cwd, configPath);
    const explicitConfig = readJsonFile(explicitPath);
    config = mergeDeep(config, explicitConfig);
    sources.push({ kind: "explicit", path: explicitPath, hasDefault: Boolean(explicitConfig.default) });
  }

  if (cliOptions.provider || cliOptions.model) {
    config = mergeDeep(config, {
      default: {
        ...(cliOptions.provider ? { provider: cliOptions.provider } : {}),
        ...(cliOptions.model ? { model: cliOptions.model } : {})
      }
    });
    sources.push({ kind: "cli", path: null, hasDefault: true });
  }

  return { config, sources, userConfigPath, projectConfigPath };
}

export function resolveRuntimeConfig({ cwd = process.cwd(), env = process.env, cliOptions = {}, requireDefault = true } = {}) {
  const loaded = loadConfig({ cwd, env, configPath: cliOptions.config, cliOptions });
  const provider = normalizeString(loaded.config.default.provider);
  const model = normalizeString(loaded.config.default.model);

  if (requireDefault && !provider) {
    throw new Error(
      "No /srh provider configured. Set SHUORENHUA_PROVIDER/SHUORENHUA_MODEL, create .shuorenhua.json, or pass --provider and --model."
    );
  }
  if (requireDefault && !model) {
    throw new Error(
      "No /srh model configured. Set SHUORENHUA_MODEL, create .shuorenhua.json, or pass --model. Gemini Flash via agy is the recommended default."
    );
  }
  if (provider && !SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(`Unsupported provider "${provider}". Use one of: ${Array.from(SUPPORTED_PROVIDERS).join(", ")}.`);
  }

  const providerConfig = provider ? loaded.config.providers?.[provider] ?? {} : null;
  return {
    ...loaded,
    provider,
    model,
    providerConfig,
    history: loaded.config.history ?? DEFAULT_CONFIG.history
  };
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}
