import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const webRoot = join(repoRoot, "web");
const srcRoot = join(webRoot, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("LAIX packaging", () => {
  it("does not keep the local LAIX packages", () => {
    expect(existsSync(join(repoRoot, "packages", "laix-attention"))).toBe(false);
    expect(existsSync(join(repoRoot, "packages", "laix-decision-record"))).toBe(false);
  });

  it("imports the real laix package only", () => {
    const offenders = sourceFiles(srcRoot).flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return /@laix\/(attention|decision-record)/.test(text) ? [path] : [];
    });
    expect(offenders).toEqual([]);

    const packageJson = JSON.parse(readFileSync(join(webRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.laix).toMatch(/vendor\/laix-0\.2\.1\.tgz$/);
  });
});
