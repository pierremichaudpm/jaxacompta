import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: node scripts/migrate.mjs <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const migrations = [
  "001_schema.sql",
  "002_seed_categories.sql",
  "003_seed_projets.sql",
  "004_seed_contacts.sql",
  "005_seed_comptes.sql",
];

// Parse SQL into individual statements, respecting parentheses
function parseStatements(text) {
  const results = [];
  let current = "";
  let depth = 0;
  let inLineComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "-" && next === "-") {
      inLineComment = true;
    }
    if (inLineComment && ch === "\n") {
      inLineComment = false;
      current += ch;
      continue;
    }
    if (inLineComment) {
      current += ch;
      continue;
    }

    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth === 0) {
      const trimmed = current.trim();
      // Filter out empty or comment-only statements
      const withoutComments = trimmed.replace(/--[^\n]*/g, "").trim();
      if (withoutComments.length > 0) {
        results.push(trimmed);
      }
      current = "";
      continue;
    }
    current += ch;
  }

  const trimmed = current.trim();
  const withoutComments = trimmed.replace(/--[^\n]*/g, "").trim();
  if (withoutComments.length > 0) {
    results.push(trimmed);
  }

  return results;
}

async function run() {
  for (const file of migrations) {
    const path = join(__dirname, "..", "migrations", file);
    const content = readFileSync(path, "utf-8");
    const stmts = parseStatements(content);
    console.log(`Running ${file} (${stmts.length} statements)...`);

    for (let i = 0; i < stmts.length; i++) {
      try {
        await sql.query(stmts[i]);
        console.log(`  [${i + 1}/${stmts.length}] OK`);
      } catch (err) {
        console.error(`  [${i + 1}/${stmts.length}] ERROR: ${err.message}`);
      }
    }
  }
  console.log("\nAll migrations done.");
}

run();
