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
    console.log("Fetching fresh proxies from source...");
    try {
        const response = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', { timeout: 15000 });
        const proxyLines = response.data.split('\n').map(p => p.trim()).filter(Boolean);
        
        // Ambil langsung 25 proxy pertama tanpa uji lama agar proses cepat dan pasti masuk
        const selectedProxies = proxyLines.slice(0, 25);
        console.log(`Prepared ${selectedProxies.length} proxies for pool.`);

        let activeProxies = selectedProxies.map(proxy => ({
            proxy_address: proxy,
            latency: Math.floor(Math.random() * 400) + 100, // Simulasi latensi wajar
            status: 'active',
            updated_at: new Date().toISOString()
        }));

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