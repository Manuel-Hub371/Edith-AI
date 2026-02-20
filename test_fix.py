import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

try:
    print("Testing gemini-2.0-flash-lite-001...")
    model = genai.GenerativeModel('gemini-2.0-flash-lite-001')
    response = model.generate_content("Hello")
    print("Response received:")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
