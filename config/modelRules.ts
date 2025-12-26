export const GoogleModelRules = {
    // Methods required for a model to be considered valid
    requiredMethods: ["generateContent"],

    // Substrings that must NOT appear in the model name
    exclusions: [
        "gemma",
        "tts",
        "image",
        "nano",
        "2.0",
        "computer"
    ],

    // Specific version substrings to INCLUDE (must match at least one)
    allowedVersions: [
        "001",
        "2.5",
        "latest",
        "3"
    ],

    // Complex exclusion logic (e.g. specific combinations)
    isExplicitlyExcluded: (name: string) => {
        // Exclude "2.5 Flash Preview" specifically
        if (name.includes("2.5") && name.includes("flash") && name.includes("preview")) return true;
        return false;
    }
};

/**
 * Validates a Google model against defined rules
 */
export const isGoogleModelAllowed = (model: any): boolean => {
    const name = model.name.toLowerCase();

    // 1. Check Capabilities
    const hasGenerateContent = model.supportedGenerationMethods?.includes("generateContent");
    if (!hasGenerateContent) return false;

    // 2. Check Exclusions
    const hasExclusion = GoogleModelRules.exclusions.some(ex => name.includes(ex));
    if (hasExclusion) return false;

    // 3. Check Complex Exclusions
    if (GoogleModelRules.isExplicitlyExcluded(name)) return false;

    // 4. Check Version Inclusions
    const hasAllowedVersion = GoogleModelRules.allowedVersions.some(v => name.includes(v));
    if (!hasAllowedVersion) return false;

    return true;
};

/**
 * Sorts Google models: Latest first, then Descending alphabetical
 */
export const sortGoogleModels = (a: any, b: any): number => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    const isLatestA = nameA.includes("latest");
    const isLatestB = nameB.includes("latest");

    if (isLatestA && !isLatestB) return -1;
    if (!isLatestA && isLatestB) return 1;

    return b.name.localeCompare(a.name); // Descending order
};

// --- OpenAI Rules ---

export const OpenAIModelRules = {
    // Prefixes required (at least one)
    allowedPrefixes: ['gpt', 'o1', 'chatgpt'],

    // Substrings to exclude
    exclusions: ['tts', 'whisper', 'audio', 'dall-e', 'embedding', 'davinci', 'babbage', 'curie', 'ada']
};

/**
 * Validates an OpenAI model against defined rules
 */
export const isOpenAIModelAllowed = (model: any): boolean => {
    const id = model.id.toLowerCase();

    // 1. Check Prefix
    const hasAllowedPrefix = OpenAIModelRules.allowedPrefixes.some(prefix => id.startsWith(prefix));
    if (!hasAllowedPrefix) return false;

    // 2. Check Exclusions
    const hasExclusion = OpenAIModelRules.exclusions.some(ex => id.includes(ex));
    if (hasExclusion) return false;

    return true;
};
