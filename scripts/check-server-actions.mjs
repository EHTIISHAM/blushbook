/**
 * Fails if a "use server" module exports anything but an async function.
 *
 * Next only catches this at build time when a *server* component imports the
 * module. When only a client component does, it builds clean and then throws a
 * 500 at runtime the first time the action is called — which is how a broken
 * booking page reached production once already.
 *
 * Types are fine: they are erased before any of this matters.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "src";
const OFFENDING = /^\s*export\s+(const|let|var|class)\s+(\w+)/;
const TYPE_ONLY = /^\s*export\s+(type|interface)\b/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

const problems = [];

for await (const path of walk(ROOT)) {
  const source = await readFile(path, "utf8");

  // Only the file-level directive matters; an inline "use server" inside a
  // function body does not make the whole module a server module.
  if (!/^\s*["']use server["'];/.test(source)) continue;

  source.split("\n").forEach((line, index) => {
    if (TYPE_ONLY.test(line)) return;
    const match = OFFENDING.exec(line);
    if (match) {
      problems.push(
        `${path}:${index + 1}  exports ${match[1]} "${match[2]}" from a "use server" module`,
      );
    }
  });
}

if (problems.length > 0) {
  console.error(
    '\nA "use server" file may only export async functions.\n' +
      "Move these into a plain module alongside it:\n",
  );
  for (const problem of problems) console.error("  " + problem);
  console.error("");
  process.exit(1);
}

console.log('No invalid exports from "use server" modules.');
