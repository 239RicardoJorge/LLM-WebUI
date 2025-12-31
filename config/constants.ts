export const APP_CONFIG = {
    // Defaults
    DEFAULT_MODEL: 'gemini-pro',

    // Timeouts (ms)
    ANIMATION_DURATION: 300,
    TOAST_DURATION: 2000,
    HIGHLIGHT_DURATION: 3800, // 2x 1.8s + buffer
    INITIAL_LOAD_DELAY: 500,

    // URLs
    PROVIDER_URLS: {
        google: 'https://aistudio.google.com/app/apikey',
        groq: 'https://console.groq.com/keys'
    },

    // LocalStorage Keys
    STORAGE_KEYS: {
        API_KEYS: 'app_api_keys',
        SETTINGS: 'app_settings',
        CHAT_MESSAGES: 'ccs_chat_messages',
        CURRENT_MODEL: 'ccs_current_model',
        AVAILABLE_MODELS: 'ccs_available_models',
        UNAVAILABLE_MODELS: 'ccs_unavailable_models',
        UNAVAILABLE_MODEL_ERRORS: 'ccs_unavailable_model_errors',
        SIDEBAR_KEYS_EXPANDED: 'ccs_sidebar_keys_expanded'
    }
};
