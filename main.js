// --- POLYFILL WEBSOCKET UNTUK SUPABASE DI ELECTRON ---
const WebSocket = require('ws');
global.WebSocket = WebSocket;
// ----------------------------------------------------

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');

// Konfigurasi koneksi Supabase Anda
const SUPABASE_URL = 'https://uajhjfftbziveljvnqdf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_e7j5VAQ6OA1zpFAxdA3z6A_yjCa6ZVh';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

let mainWindow = null;

function preventWindowsSleepMode() {
    exec('powercfg -requestsoverride PROCESS node.exe System Display', (err) => {});
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 900,
        resizable: false,
        title: "Traffic-Ex Identity Studio • VIP Enterprise Utility",
        backgroundColor: '#090d16',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    preventWindowsSleepMode();
}

app.whenReady().then(createWindow);

// 1. Mengambil Proxy Bersih Langsung dari Supabase Server Pool Anda
ipcMain.handle('fetch-cloud-proxies', async (event) => {
    const startTime = Date.now();
    event.sender.send('scrape-log', 'Connecting to Traffic-Ex VIP Cloud Proxy Pool...');

    try {
        const { data, error } = await supabase
            .from('proxy_pool')
            .select('proxy_address, latency')
            .eq('status', 'active')
            .order('latency', { ascending: true })
            .limit(20);

        if (error) throw error;

        if (!data || data.length === 0) {
            event.sender.send('scrape-log', 'Cloud pool is refreshing. Please try again shortly.');
            return { success: true, validProxies: [], stats: { total: 0, live: 0, duration: '0.00s' } };
        }

        let formattedProxies = data.map(item => `${item.proxy_address} (Latency: ${item.latency}ms)`);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        event.sender.send('scrape-log', `Successfully synced ${data.length} verified cloud proxies!`);

        return {
            success: true,
            validProxies: formattedProxies,
            stats: {
                totalScraped: data.length,
                live: data.length,
                dead: 0,
                duration: duration
            }
        };
    } catch (err) {
        event.sender.send('scrape-log', `Cloud sync error: ${err.message}`);
        return { success: false, validProxies: [], stats: { total: 0, live: 0, duration: '0.00s' } };
    }
});

// 2. Live Online User-Agent Generator
ipcMain.handle('generate-uas', async (event, count = 20) => {
    let fetchedUAs = [];
    try {
        const response = await axios.get('https://gist.githubusercontent.com/p0oker/2246261/raw/desktop_user_agents.json', { timeout: 5000 });
        if (Array.isArray(response.data)) {
            fetchedUAs = response.data;
        }
    } catch (e) {
        fetchedUAs = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15"
        ];
    }

    let generated = [];
    for (let i = 0; i < count; i++) {
        const randomUA = fetchedUAs[Math.floor(Math.random() * fetchedUAs.length)];
        generated.push(randomUA);
    }
    return { success: true, uas: generated };
});

// 3. Simpan Hasil ke File .txt
ipcMain.handle('export-to-txt', async (event, { content, defaultName }) => {
    const { filePath } = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (filePath) {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    }
    return { success: false };
});