Run provider test scripts (Windows PowerShell / CMD):

# Requirements
- Node.js (v18+ recommended for global fetch support)
- Backend running at http://localhost:3001

# Commands
# Run OpenAI test
node tests/send-openai-test.js

# Run Gemini test
node tests/send-gemini-test.js

# Notes
- Scripts send a single POST to /api/agents/chat with provider set.
- If your Node is older than v18, install node-fetch and update the script to import it.
