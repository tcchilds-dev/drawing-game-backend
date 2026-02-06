import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FALLBACK_WORDS = ["apple", "house", "guitar", "elephant", "pizza", "rocket", "wizard"];

function normalizeWord(input: string): string | null {
  const collapsed = input.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0) return null;
  return collapsed;
}

function normalizeAndDeduplicate(words: string[]): string[] {
  const seen = new Set<string>();
  const normalizedWords: string[] = [];

  for (const rawWord of words) {
    const normalized = normalizeWord(rawWord);
    if (!normalized) continue;

    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    normalizedWords.push(normalized);
  }

  return normalizedWords;
}

function resolveWordListPaths(): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url));

  return [
    resolve(process.cwd(), "words.txt"),
    resolve(moduleDir, "../../words.txt"),
    resolve(moduleDir, "../../../words.txt"),
  ];
}

function loadWordsFromFile(): string[] {
  const candidatePaths = resolveWordListPaths();

  for (const filePath of candidatePaths) {
    if (!existsSync(filePath)) continue;

    try {
      const fileContents = readFileSync(filePath, "utf8");
      const words = normalizeAndDeduplicate(fileContents.split(/\r?\n/));

      if (words.length > 0) {
        console.log(`Loaded ${words.length} words from ${filePath}`);
        return words;
      }
    } catch (error) {
      console.error(`Failed to read words from ${filePath}`, error);
    }
  }

  const fallbackWords = normalizeAndDeduplicate(FALLBACK_WORDS);
  console.warn(
    "Using fallback word list because words.txt was missing/empty or could not be read"
  );
  return fallbackWords;
}

export const WORD_LIST = loadWordsFromFile();
