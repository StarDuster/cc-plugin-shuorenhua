export function splitRawArgumentString(raw) {
  const input = String(raw ?? "");
  const tokens = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }

    if ((char === "'" || char === '"') && quote === null) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = null;
      continue;
    }

    if (/\s/.test(char) && quote === null) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (quote !== null) {
    throw new Error(`Unclosed ${quote} quote in arguments.`);
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

export function normalizeArgv(argv) {
  if (argv.length === 1) {
    const raw = argv[0];
    if (!raw || !String(raw).trim()) {
      return [];
    }
    return splitRawArgumentString(raw);
  }
  return argv;
}

export function parseArgs(argv, config = {}) {
  const valueOptions = new Set(config.valueOptions ?? []);
  const booleanOptions = new Set(config.booleanOptions ?? []);
  const aliasMap = config.aliasMap ?? {};
  const tokens = normalizeArgv(argv);
  const options = {};
  const positionals = [];

  function normalizeName(name) {
    return aliasMap[name] ?? name;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--") {
      positionals.push(...tokens.slice(index + 1));
      break;
    }

    if (!token.startsWith("-") || token === "-") {
      positionals.push(token);
      continue;
    }

    if (token.startsWith("--no-")) {
      const name = normalizeName(token.slice(5));
      options[name] = false;
      continue;
    }

    const eqIndex = token.indexOf("=");
    const rawName = token.startsWith("--") ? token.slice(2, eqIndex === -1 ? undefined : eqIndex) : token.slice(1);
    const name = normalizeName(rawName);

    if (eqIndex !== -1) {
      options[name] = token.slice(eqIndex + 1);
      continue;
    }

    if (booleanOptions.has(name)) {
      options[name] = true;
      continue;
    }

    if (valueOptions.has(name)) {
      const value = tokens[index + 1];
      if (value == null || value.startsWith("-")) {
        throw new Error(`Missing value for --${name}.`);
      }
      options[name] = value;
      index += 1;
      continue;
    }

    options[name] = true;
  }

  return { options, positionals };
}

export function parseIntegerOption(value, name) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}
