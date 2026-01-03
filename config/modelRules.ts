import { GoogleModelInfo } from '../types';

/**
 * Validates a Google model against defined rules
 */
export const isGoogleModelAllowed = (model: GoogleModelInfo): boolean => {
    // 1. Check Capabilities
    const hasGenerateContent = model.supportedGenerationMethods?.includes("generateContent");
    if (!hasGenerateContent) return false;

    return true;
};

/**
 * Sorts Google models: Latest first, then Descending alphabetical
 */
export const sortGoogleModels = (a: GoogleModelInfo, b: GoogleModelInfo): number => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    const isLatestA = nameA.includes("latest");
    const isLatestB = nameB.includes("latest");

    if (isLatestA && !isLatestB) return -1;
    if (!isLatestA && isLatestB) return 1;

    return b.name.localeCompare(a.name); // Descending order
};
