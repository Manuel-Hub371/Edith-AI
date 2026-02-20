# AI Backend API

A production-ready AI assistant backend built with FastAPI and OpenAI, featuring system control capabilities.

## Features

- **Conversational AI**: Powered by OpenAI's GPT-4 Turbo.
- **System Control**: Open/Close apps, play media, open folders (whitelisted & secured).
- **Structured API**: RESTful endpoints with Pydantic validation.
- **Secure**: Application whitelisting and path validation.

## Prerequisites

- Python 3.9+
- OpenAI API Key

## Installation

1.  **Clone the repository** (or navigate to the project root).
2.  **Create a virtual environment**:
    ```bash
    python -m venv venv
    .\venv\Scripts\Activate
    ```
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure Environment**:
    - Create a `.env` file in the root directory.
    - Add your OpenAI API key:
      ```env
      OPENAI_API_KEY=your_openai_api_key_here
      ```

## Running the Server

You can use standard Python commands or NPM scripts.

**Using NPM (Recommended):**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

**Using Python:**
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

## API Documentation

FastAPI automatically generates interactive documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Usage Examples

### Chat Endpoint

**POST** `/api/v1/chat`

**Request Body**:
```json
{
  "message": "Open Calculator and tell me when it's done."
}
```

**Response**:
```json
{
  "response": "I have successfully opened the Calculator for you."
}
```

## Project Structure

- `app/main.py`: Application entry point.
- `app/core/`: Configuration and security logic.
- `app/ai/`: LLM integration and tool definitions.
- `app/api/`: API route definitions.

## Future Improvements

- Add Voice Input/Output.
- Implement persistent memory (PostgreSQL/Redis).
- Add WebSocket support for real-time streaming.
