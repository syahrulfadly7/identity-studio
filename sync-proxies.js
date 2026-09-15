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
        const response = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', { timeout: 10000 });
        const proxyLines = response.data.split('\n').map(p => p.trim()).filter(Boolean);
        
        const selectedProxies = proxyLines.slice(0, 30);
        console.log(`Found ${selectedProxies.length} proxies to verify.`);

        let activeProxies = [];

        for (let proxy of selectedProxies) {
            const startTime = Date.now();
            try {
                await axios.get('https://httpbin.org/ip', {
                    proxy: {
                        host: proxy.split(':')[0],
                        port: parseInt(proxy.split(':')[1])
                    },
                    timeout: 4000
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

        if (activeProxies.length > 0) {
            console.log("Clearing old proxy pool in Supabase...");
            await axios.delete(`${SUPABASE_URL}/rest/v1/proxy_pool?id=gt.0`, { headers: supabaseHeaders });

            console.log("Inserting new active proxies...");
            await axios.post(`${SUPABASE_URL}/rest/v1/proxy_pool`, activeProxies, { headers: supabaseHeaders });

            console.log(`Successfully synced ${activeProxies.length} active proxies to Supabase via REST API!`);
        } else {
            console.log("No active proxies found during this run.");
        }

    } catch (err) {
        console.error("Error during proxy synchronization:", err.response?.data || err.message);
        process.exit(1);
    }
}

fetchAndSyncProxies();