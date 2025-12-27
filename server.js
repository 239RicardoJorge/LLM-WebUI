import express from 'express';
import cors from 'cors';
import si from 'systeminformation';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const PORT = process.env.PORT || 3001; // Backend Port

app.use(cors());
app.use(express.json());

// API Endpoint for System Stats
app.get('/api/status', async (req, res) => {
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
