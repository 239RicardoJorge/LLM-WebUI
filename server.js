import express from 'express';
import cors from 'cors';
import si from 'systeminformation';
import dotenv from 'dotenv'; // Added
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Backend Port

app.use(cors());
// Increase limit for large file uploads (base64 encoded attachments)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate Limiters (per endpoint)
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: { error: 'Too many chat requests. Please wait a moment.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const statusLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 requests per minute (2 per second)
    message: { error: 'Too many status requests.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// API Endpoint for System Stats
app.get('/api/status', statusLimiter, async (req, res) => {
    try {
        const [cpu, mem] = await Promise.all([
            si.currentLoad(),
            si.mem()
        ]);

        res.json({
            cpu: {
                cores: cpu.cpus.map(c => c.load), // Load per core
                avg: cpu.currentLoad
            },
            memory: {
                total: mem.total,
                used: mem.active,
                percentage: (mem.active / mem.total) * 100
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch system stats' });
    }
});

// API Proxy Endpoint
app.post('/api/chat', chatLimiter, async (req, res) => {
    const { provider, model, messages, ...rest } = req.body;
    const apiKey = req.headers['x-api-key'] || process.env.API_KEY;

    if (!apiKey) {
        return res.status(401).json({ error: 'Missing API Key' });
    }

    try {
        let upstreamUrl;
        let options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '' // will populate
        };

        if (provider === 'openai') {
            upstreamUrl = 'https://api.openai.com/v1/chat/completions';
            options.headers['Authorization'] = `Bearer ${apiKey}`;
            options.body = JSON.stringify({
                model,
                messages,
                stream: true,
                ...rest
            });
        } else if (provider === 'google') {
            // Google REST API format: https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={apiKey}
            upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

            // Transform OpenAI-like messages to Google Content format if needed?
            // Wait, the frontend sends OpenAI format to OpenAIProvider, but GoogleProvider sends "contents".
            // The Proxy should expect the Frontend to send the *correct* body for the provider, OR normalize?
            // "UnifiedService" currently calls Provider.sendMessageStream.
            // Provider builds the body.
            // If we move logic to backend, the Frontend should send a STANDARD format, and Backend converts.
            // OR: Frontend Provider constructs the vendor-specific body and sends it to /api/chat?
            // The latter is "Tunneling".
            // Let's assume for this step the Frontend creates the payload.
            // BUT: GoogleProvider uses `contents`. OpenAI uses `messages`.

            // To be simplest: We will adopt a "Hybrid" approach.
            // If body has "contents", it's Google structure.
            // If body has "messages", it's OpenAI structure.
            // Just forward the body?

            // Google expects specific json body (contents, generationConfig, etc.)
            // We stripped provider/model/messages. 'rest' contains 'contents' if sent by frontend.
            options.body = JSON.stringify(rest);

            // Note: If frontend sends 'messages' (OpenAI format) to Google Provider,
            // we would need translation here. But we assume Frontend Provider sends correct format.

            // ADJUSTMENT: GoogleProvider expects slightly different URL structure.
            // Let's implement specific logic.
            upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
        } else {
            return res.status(400).json({ error: 'Invalid provider' });
        }

        const response = await fetch(upstreamUrl, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upstream API Error:', response.status, errorText);
            return res.status(response.status).send(errorText);
        }

        // Stream handling
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        if (response.body) {
            // @ts-ignore
            for await (const chunk of response.body) {
                res.write(chunk);
            }
            res.end();
        } else {
            res.end();
        }

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    app.use(express.static(join(__dirname, 'dist')));

    // Handle React routing, return all requests to React app
    app.use((req, res) => {
        res.sendFile(join(__dirname, 'dist', 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);
});
