const { GoogleGenAI } = require("@google/genai");

// Mock key if needed, or better, read from Sidebar usage. 
// Since I can't easily read the key from the browser, I'll use a fetch approach with a placeholder or ask the user?
// Wait, I can use the existing server.js to proxy or just run a node script if I had the key.
// I don't have the key in backend. It's in localStorage.

// Alternative: Inject a script into the browser to print the FULL JSON objects to console.
// This is better because it uses the user's actual key in context.

console.log("Analyzing...");
const analyzeModels = async (apiKey) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        const workingModels = [
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-2.5-flash-lite", // guessed ID
            "gemini-3-flash-preview",
            "gemini-robotics-er-1.5-preview" // checks partial match
        ];

        console.log("--- FULL METADATA ANALYSIS ---");
        data.models.forEach(m => {
            const shortName = m.name.replace('models/', '');
            // Simple match
            const isWorking = workingModels.some(w => shortName.includes(w) || w.includes(shortName));

            if (isWorking) {
                console.log(`[WORKING] ${shortName}`, JSON.stringify(m, null, 2));
            } else if (shortName.includes("gemini-2.0-flash-exp")) {
                console.log(`[FAILING] ${shortName}`, JSON.stringify(m, null, 2));
            }
        });
    } catch (e) { console.error(e); }
};

// Expose to window for manual run or auto-run if key is found
window.analyzeModels = analyzeModels;
