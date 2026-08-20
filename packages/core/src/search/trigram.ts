/**
 * Extracts character trigrams from an input string.
 */
export const extractTrigrams = (input: string): Set<string> => {
  const normalized = `  ${input.toLowerCase().trim()}  `;
  const trigrams = new Set<string>();

  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }

  return trigrams;
};

/**
 * Calculates the Sørensen–Dice similarity coefficient (0.0 to 1.0) between two strings based on trigrams.
 */
export const calculateTrigramSimilarity = (a: string, b: string): number => {
  if (a.toLowerCase() === b.toLowerCase()) {
    return 1.0;
  }
  if (!a || !b) {
    return 0.0;
  }

  const triA = extractTrigrams(a);
  const triB = extractTrigrams(b);

  if (triA.size === 0 || triB.size === 0) {
    return 0.0;
  }

  let intersectionCount = 0;
  for (const tri of triA) {
    if (triB.has(tri)) {
      intersectionCount++;
    }
  }

  return (2 * intersectionCount) / (triA.size + triB.size);
};

/**
 * Filters and ranks a list of items by fuzzy trigram similarity score.
 */
export const fuzzyRankItems = <T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  minThreshold = 0.25,
): Array<{ item: T; score: number }> => {
  if (!query.trim()) {
    return items.map((item) => ({ item, score: 1.0 }));
  }

  return items
    .map((item) => {
      const text = getText(item);
      const score = calculateTrigramSimilarity(query, text);
      return { item, score };
    })
    .filter((entry) => entry.score >= minThreshold)
    .sort((a, b) => b.score - a.score);
};
