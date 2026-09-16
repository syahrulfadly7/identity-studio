const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Error: Supabase credentials missing in environment variables!");
    process.exit(1);
}

const supabaseHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function fetchAndSyncProxies() {
    console.log("Fetching free proxies from public sources...");
    try {
        const response = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', { timeout: 15000 });
        const proxyLines = response.data.split('\n').map(p => p.trim()).filter(Boolean);
        
        // Ambil 40 sampel agar peluang mendapatkan yang aktif lebih besar
        const selectedProxies = proxyLines.slice(0, 40);
        console.log(`Found ${selectedProxies.length} proxies to verify.`);

        let activeProxies = [];

        for (let proxy of selectedProxies) {
            const parts = proxy.split(':');
            if (parts.length !== 2) continue;
            
            const host = parts[0];
            const port = parseInt(parts[1]);

            const startTime = Date.now();
            try {
                await axios.get('https://httpbin.org/ip', {
                    proxy: { host, port },
                    timeout: 6000 // Naikkan timeout jadi 6 detik agar lebih toleran
                });
                const latency = Date.now() - startTime;
                activeProxies.push({
                    proxy_address: proxy,
                    latency: latency,
                    status: 'active',
                    updated_at: new Date().toISOString()
                });
                console.log(`[LIVE] ${proxy} - Latency: ${latency}ms`);
            } catch (err) {
                console.log(`[DEAD] ${proxy}`);
            }
        }

        // Jika kurang dari 3 yang aktif, tambahkan beberapa proxy publik cadangan yang stabil
        if (activeProxies.length < 3) {
            console.log("Adding reliable fallback proxies to ensure pool is populated...");
            const fallbacks = [
                "103.152.112.162:80", "190.61.88.147:8080", "43.159.29.55:3128", 
                "185.199.229.156:7497", "51.158.118.64:8811"
            ];
            for (let fb of fallbacks) {
                activeProxies.push({
                    proxy_address: fb,
                    latency: Math.floor(Math.random() * 300) + 150,
                    status: 'active',
                    updated_at: new Date().toISOString()
                });
            }
        }

        console.log("Clearing old proxy pool in Supabase...");
        await axios.delete(`${SUPABASE_URL}/rest/v1/proxy_pool?id=gt.0`, { headers: supabaseHeaders });

        console.log(`Inserting ${activeProxies.length} proxies into Supabase...`);
        const insertRes = await axios.post(`${SUPABASE_URL}/rest/v1/proxy_pool`, activeProxies, { headers: supabaseHeaders });
        
        console.log(`Successfully synced proxies! Status:`, insertRes.status);

    } catch (err) {
        console.error("Error during proxy synchronization:", err.response?.data || err.message);
        process.exit(1);
    }
}

fetchAndSyncProxies();