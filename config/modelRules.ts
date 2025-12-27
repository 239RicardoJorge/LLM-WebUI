export const GoogleModelRules = {
    // Methods required for a model to be considered valid
    requiredMethods: ["generateContent"],
};

/**
 * Validates a Google model against defined rules
 */
export const isGoogleModelAllowed = (model: any): boolean => {
    // 1. Check Capabilities
    const hasGenerateContent = model.supportedGenerationMethods?.includes("generateContent");
    if (!hasGenerateContent) return false;

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
    // No restrictions
};

/**
 * Validates an OpenAI model against defined rules
 */
export const isOpenAIModelAllowed = (model: any): boolean => {
    // Allow all models
    return true;
};
