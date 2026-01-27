const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8000;

// ====================== CẤU HÌNH ======================
const POLL_INTERVAL = 5000; // 5 giây
const RETRY_DELAY = 5000;
const MAX_HISTORY = 100;

// ====================== STORE ======================
let latest_result_100 = {
    Phien: 0,
    Xuc_xac_1: 0,
    Xuc_xac_2: 0,
    Xuc_xac_3: 0,
    Tong: 0,
    Ket_qua: "Chưa có",
    TX_Pattern: "",
    Du_doan: "Chưa có",
    id: "anhbantool1"
};

let latest_result_101 = {
    Phien: 0,
    Xuc_xac_1: 0,
    Xuc_xac_2: 0,
    Xuc_xac_3: 0,
    Tong: 0,
    Ket_qua: "Chưa có",
    TX_Pattern: "",
    Du_doan: "Chưa có",
    id: "anhbantool1"
};

let history_100 = [];
let history_101 = [];

let last_sid_100 = null;
let last_sid_101 = null;
let sid_for_tx = null;

// ====================== HÀM HỖ TRỢ ======================
function getTaiXiu(d1, d2, d3) {
    const total = d1 + d2 + d3;
    return total <= 10 ? "Xỉu" : "Tài";
}

function tinhPattern(history) {
    return history.slice(0, 10).map(h => h.Ket_qua === "Tài" ? "T" : "X").join('');
}

function duDoanTaiXiu(history) {
    if (history.length < 5) return "Chưa đủ dữ liệu";

    const pattern = history.slice().reverse().map(h => h.Ket_qua === "Tài" ? "T" : "X").join('');
    const last3 = pattern.slice(-3);

    let freq_T = 0;
    let freq_X = 0;

    for (let i = 0; i < pattern.length - 3; i++) {
        if (pattern.slice(i, i + 3) === last3) {
            const nextChar = pattern[i + 3];
            if (nextChar === "T") freq_T++;
            else freq_X++;
        }
    }

    if (freq_T > freq_X) return "Tài";
    else if (freq_X > freq_T) return "Xỉu";
    else {
        const recent = history[0].Ket_qua;
        return recent === "Xỉu" ? "Tài" : "Xỉu";
    }
}

function updateResult(store, history, result) {
    Object.assign(store, result);
    history.unshift({...result});
    if (history.length > MAX_HISTORY) history.pop();
    store.TX_Pattern = tinhPattern(history);
    store.Du_doan = duDoanTaiXiu(history);
}

// ====================== POLLING ======================
async function pollAPI(gid, isMd5) {
    const url = `https://jakpotgwab.geightdors.net/glms/v1/notify/taixiu?platform_id=g8&gid=${gid}`;

    while (true) {
        try {
            const res = await axios.get(url, { headers: { 'User-Agent': 'Node-Proxy/1.0' }, timeout: 10000 });
            const data = res.data;

            if (data.status === 'OK' && Array.isArray(data.data)) {
                for (const game of data.data) {
                    const cmd = game.cmd;

                    if (!isMd5 && cmd === 1008) {
                        sid_for_tx = game.sid;
                    }
                }

                for (const game of data.data) {
                    const cmd = game.cmd;

                    // --- MD5 ---
                    if (isMd5 && cmd === 2006) {
                        const sid = game.sid;
                        const { d1, d2, d3 } = game;

                        if (sid && sid !== last_sid_101 && [d1, d2, d3].every(x => x != null)) {
                            last_sid_101 = sid;
                            const total = d1 + d2 + d3;
                            const ket_qua = getTaiXiu(d1, d2, d3);

                            const result = { Phien: sid, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: ket_qua, id: "maicutevip11" };
                            updateResult(latest_result_101, history_101, result);
                            console.log(`[MD5] Phiên ${sid} - Tổng: ${total}, Kết quả: ${ket_qua}`);
                        }
                    }
                    // --- TX thường ---
                    else if (!isMd5 && cmd === 1003) {
                        const sid = sid_for_tx;
                        const { d1, d2, d3 } = game;

                        if (sid && sid !== last_sid_100 && [d1, d2, d3].every(x => x != null)) {
                            last_sid_100 = sid;
                            const total = d1 + d2 + d3;
                            const ket_qua = getTaiXiu(d1, d2, d3);

                            const result = { Phien: sid, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: ket_qua, id: "maicutevip11" };
                            updateResult(latest_result_100, history_100, result);
                            console.log(`[TX] Phiên ${sid} - Tổng: ${total}, Kết quả: ${ket_qua}`);
                            sid_for_tx = null;
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`Lỗi khi lấy dữ liệu API ${gid}:`, err.message);
            await new Promise(r => setTimeout(r, RETRY_DELAY));
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

// ====================== ROUTES ======================
app.get('/api/taixiu', (req, res) => {
    res.json(latest_result_100);
});

app.get('/api/taixiumd5', (req, res) => {
    res.json(latest_result_101);
});

app.get('/api/history', (req, res) => {
    res.json({ taixiu: history_100, taixiumd5: history_101 });
});

app.get('/', (req, res) => {
    res.send("🎲 API Server for TaiXiu is running. Endpoints: /api/taixiu, /api/taixiumd5, /api/history");
});

// ====================== START POLLING ======================
console.log("🚀 Khởi động hệ thống API Tài Xỉu...");
pollAPI("vgmn_100", false);
pollAPI("vgmn_101", true);

// ====================== START SERVER ======================
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});