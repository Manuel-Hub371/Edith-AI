const dotenv = require("dotenv");

dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function list() {
    try {
        const response = await fetch(URL);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", data.error);
            return;
        }

        if (!data.models) {
            console.log("No models found or unexpected format:", data);
            return;
        }

        console.log("Available Models:");
        data.models.forEach(m => {
            // Filter for generateContent supported models
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`- ${m.name}`);
            }
        });

    } catch (error) {
        console.error("Request Failed:", error);
    }
}

list();
