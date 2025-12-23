import express from 'express';
import cors from 'cors';
import si from 'systeminformation';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const PORT = 3001; // Backend Port

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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);
});
