import os
import logging
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import google.generativeai as genai
import google.api_core.exceptions
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_random_exponential, retry_if_exception_type

# Load environment variables
load_dotenv()

# Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logging.warning("GOOGLE_API_KEY not found in environment variables.")

# Initialize Gemini
genai.configure(api_key=GOOGLE_API_KEY)
# Using flash-lite as verified working model, albeit with rate limits
model = genai.GenerativeModel('gemini-2.0-flash-lite-001')

# Initialize FastAPI
app = FastAPI(title="AI Chatbot", version="2.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

# In-memory conversation history
conversation_history: List[Dict[str, str]] = []

# Helper Function for Retry Logic
@retry(
    retry=retry_if_exception_type(google.api_core.exceptions.ResourceExhausted),
    wait=wait_random_exponential(multiplier=2, max=120),
    stop=stop_after_attempt(10),
    reraise=True
)
def generate_safe_response(chat_session, message_text: str):
    return chat_session.send_message(message_text)

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    global conversation_history
    
    try:
        user_msg = {"role": "user", "content": request.message}
        
        # Add user message to history
        conversation_history.append(user_msg)
        
        # Keep only last 10 messages to maintain context window
        if len(conversation_history) > 10:
            conversation_history = conversation_history[-10:]
            
        # Convert history to Gemini format
        gemini_history = []
        for msg in conversation_history[:-1]: # Exclude the last message which we will send
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})
        
        # Create chat session
        chat = model.start_chat(history=gemini_history)
        
        # Send message with retry logic
        response = generate_safe_response(chat, request.message)
        ai_text = response.text
        
        # Add AI response to history
        conversation_history.append({"role": "assistant", "content": ai_text})
        
        return ChatResponse(response=ai_text)

    except google.api_core.exceptions.ResourceExhausted:
         raise HTTPException(status_code=429, detail="AI Service is currently busy. Please try again in a moment.")
    except Exception as e:
        logging.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Mount static files
static_dir = os.path.join(os.getcwd(), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
