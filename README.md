# ChatKitty

A modern, local-first LLM WebUI that runs on your hardware (like Raspberry Pi).

<div align="center">
  <h3>ChatKitty Interface</h3>
</div>

## Features
- **Local Priority**: Designed to run efficiently on low-power devices.
- **Multi-Provider**: Support for Google Gemini, OpenAI, and Anthropic.
- **System Monitoring**: Real-time visualization of your host device's CPU and RAM usage.
- **Secure**: API Keys are stored locally in your browser.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the application (Backend + Frontend):
   ```bash
   # Terminal 1 (Backend for System Stats)
   node server.js

   # Terminal 2 (Frontend)
   npm run dev
   ```

3. Open your browser at the local URL provided (usually http://localhost:3000 or similar).
