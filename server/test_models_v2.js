const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const modelsToTest = [
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-1.5-flash"
];

async function test() {
    console.log("--- STARTING MODEL TEST ---");
    for (const modelName of modelsToTest) {
        try {
            console.log(`\nTesting "${modelName}"...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello?");
            const response = await result.response;
            console.log(`✅ SUCCEEDED: ${modelName}`);
            console.log(`   Response: ${response.text()}`);
            return;
        } catch (error) {
            console.log(`❌ FAILED: ${modelName}`);
            console.log(`   Error: ${error.message}`);
        }
    }
    console.log("\n--- END MODEL TEST ---");
}

test();
