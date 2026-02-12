const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    // For listing models, we don't need a specific model instance, 
    // but the SDK structure usually assumes we get the model or use the manage API.
    // Actually, currently the JS SDK doesn't expose a top-level listModels easily 
    // without using the direct API or checking documentation, but let's try 
    // a basic generation to see if we can get a clearer error or just try a standard one.

    // Wait, the error message literally said: "Call ListModels to see the list..."
    // The Node SDK might not expose this directly on the client instance in older versions,
    // but let's try the fallback of testing known variants.

    const modelsToTest = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-pro",
        "gemini-1.0-pro"
    ];

    console.log("Testing model availability...");

    for (const modelName of modelsToTest) {
        try {
            console.log(`Checking ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello?");
            const response = result.response.text();
            console.log(`✅ SUCCESS: ${modelName} is working.`);
            break; // Found one!
        } catch (error) {
            console.log(`❌ FAILED: ${modelName} - ${error.message.split(']')[1] || error.message}`);
        }
    }
}

listModels();
