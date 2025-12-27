import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

interface SystemStatusProps {
    mounted: boolean;
}

const SystemStatus: React.FC<SystemStatusProps> = ({ mounted }) => {
    const [cpuCores, setCpuCores] = useState<number[]>(() => {
        const saved = localStorage.getItem('ccs_stats_cpu');
        return saved ? JSON.parse(saved) : [12, 15, 8, 20];
    });
    const [ramUsage, setRamUsage] = useState(() => {
        const saved = localStorage.getItem('ccs_stats_ram');
        return saved ? Number(saved) : 45;
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/status');
                if (res.ok) {
                    const data = await res.json();
                    // Ensure we have 4 cores for UI consistency
                    const coreData = data.cpu.cores.length > 0 ? data.cpu.cores : [data.cpu.avg, data.cpu.avg, data.cpu.avg, data.cpu.avg];
                    const finalCores = coreData.slice(0, 4);

                    setCpuCores(finalCores);
                    setRamUsage(data.memory.percentage);

                    localStorage.setItem('ccs_stats_cpu', JSON.stringify(finalCores));
                    localStorage.setItem('ccs_stats_ram', String(data.memory.percentage));
                }
            } catch (err) {
                console.warn("Stats fetch failed");
            }
        };

        const interval = setInterval(fetchStats, 2000);
        fetchStats();
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-6 bg-black/40 border-t border-white/5 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-3 h-3 text-green-500" />
                <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">System Status (Host)</span>
            </div>

            <div className="space-y-4">
                {/* CPU Cores Grid */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end text-[10px] font-mono text-gray-400">
                        <span>CPU LOAD (4 CORES)</span>
                        <span>AVG {Math.round(cpuCores.reduce((a, b) => a + b, 0) / 4)}%</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-8">
                        {cpuCores.map((load, idx) => (
                            <div key={idx} className="relative bg-white/5 rounded-md overflow-hidden flex items-end group">
                                <div
                                    className={`w-full bg-white/80 ease-out hover:bg-white ${mounted ? 'transition-all duration-1000' : ''}`}
                                    style={{ height: `${load}%` }}
                                />
                                {/* Tooltip for specific core */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/60 transition-opacity">
                                    <span className="text-[8px] font-mono">{Math.round(load)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System RAM Monitor */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-end text-[10px] font-mono text-gray-400">
                        <span>SYSTEM RAM USAGE</span>
                        <span>{Math.round(ramUsage)}%</span>
                    </div>
                    <div className="h-1 w-full bg-blue-500/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-blue-400 rounded-full ease-out shadow-[0_0_10px_rgba(96,165,250,0.3)] ${mounted ? 'transition-all duration-1000' : ''}`}
                            style={{ width: `${ramUsage}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemStatus;
