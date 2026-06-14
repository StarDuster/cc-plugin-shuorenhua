import fs from "node:fs";

export function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export function mergeDeep(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }

  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }
    output[key] = mergeDeep(output[key], value);
  }
  return output;
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
