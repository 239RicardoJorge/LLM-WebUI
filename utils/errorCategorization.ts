/**
 * Standardized Error Categorization
 * Used by all providers for consistent error handling
 */

export type ErrorCode = '429' | '400' | 'TERMS' | 'AUTH' | 'UNSUPPORTED' | 'BILLING' | 'ERROR';

/**
 * Categorizes an error message into a standardized error code.
 * @param message - The error message to categorize
 * @param statusCode - Optional HTTP status code
 * @returns Standardized error code
 */
export function categorizeError(message: string, statusCode?: number): ErrorCode {
    const msg = message.toLowerCase();

    // Rate limiting / Quota
    if (statusCode === 429 || msg.includes('rate') || msg.includes('quota') || msg.includes('tpm') || msg.includes('resource exhausted')) {
        return '429';
    }

    // Terms acceptance required
    if (msg.includes('terms') && msg.includes('acceptance')) {
        return 'TERMS';
    }

    // Authentication / Authorization
    if (msg.includes('restricted') || msg.includes('organization') || msg.includes('access denied') ||
        msg.includes('not authorized') || msg.includes('permission') || msg.includes('org admin')) {
        return 'AUTH';
    }

    // Unsupported model type (catch "not supported", "does not support", etc.)
    if (msg.includes('not support') || msg.includes('invalid model') ||
        msg.includes('unsupported') || msg.includes('not found') || msg.includes('not compatible')) {
        return 'UNSUPPORTED';
    }

    // Billing / Payment
    if (msg.includes('billing') || msg.includes('payment') || msg.includes('upgrade') || msg.includes('subscription')) {
        return 'BILLING';
    }

    // Generic bad request
    if (statusCode === 400 || msg.includes('invalid')) {
        return '400';
    }

    return 'ERROR';
}
