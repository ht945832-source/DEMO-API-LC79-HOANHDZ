/**
 * DỰ ÁN: DIAMOND AI SUPREME v14.1
 * ADMIN: TRẦN NHẬT HOÀNG
 * FIX: RENDER DEPLOYMENT ERROR (STATUS 1)
 */

import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const PORT = process.env.PORT || 3000;
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let predictionLogs = [];         
let currentSessionId = 0;

// --- 🛠️ HÀM HỖ TRỢ ---
const opp = (v) => v === "TAI" ? "XIU" : "TAI";

// --- 🧠 THUẬT TOÁN TRỌNG SỐ THỰC (WEIGHTED LOGIC) ---

const get_streak = (res) => {
    if (!res.length) return [0, null];
    let s = 1;
    for (let i = res.length - 2; i >= 0; i--) {
        if (res[i] === res[res.length - 1]) s++; else break;
    }
    return [s, res[res.length - 1]];
};

const detect_cau = (res) => {
    const n = res.length;
    if (n < 4) return ["Hỗn hợp", res[n-1] || "TAI", 50];
    const [streak, cur] = get_streak(res);

    if (streak >= 7) return ["Bệt siêu dài", opp(cur), 82];
    if (streak >= 5) return ["Bệt dài", opp(cur), 74];
    if (streak >= 4) return ["Bệt TB", opp(cur), 64];

    // Check Pingpong
    let isPingPong = true;
    const last4 = res.slice(-4);
    for (let i = 0; i < last4.length - 1; i++) {
        if (last4[i] === last4[i+1]) isPingPong = false;
    }
    if (isPingPong && n >= 4) return ["1-1 Pingpong", opp(cur), 70];

    return ["Hỗn hợp", cur, 52];
};

const match_pattern = (res) => {
    const n = res.length;
    if (n < 7) return [null, 50];
    const pattern = res.slice(-6).join("");
    let cnt = { "TAI": 0, "XIU": 0 };
    for (let i = 0; i <= n - 7; i++) {
        if (res.slice(i, i + 6).join("") === pattern) cnt[res[i + 6]]++;
    }
    const total = cnt["TAI"] + cnt["XIU"];
    if (total === 0) return [null, 50];
    const best = cnt["TAI"] >= cnt["XIU"] ? "TAI" : "XIU";
    return [best, Math.min(93, 50 + (cnt[best] / total * 43))];
};

const predict_engine = (history) => {
    const res = history.map(h => h.point >= 11 ? "TAI" : "XIU");
    let votes = { "TAI": 0.0, "XIU": 0.0 };

    const [cType, cPred, cConf] = detect_cau(res);
    votes[cPred] += (cConf * 1.5);

    const [pPred, pConf] = match_pattern(res);
    if (pPred) votes[pPred] += (pConf * 2.0);

    const total = votes["TAI"] + votes["XIU"];
    const final = votes["TAI"] >= votes["XIU"] ? "TAI" : "XIU";
    const confValue = Math.min(95, Math.max(55, Math.round((votes[final] / total) * 100)));

    return { res: final === "TAI" ? "🔴 TÀI" : "⚪ XỈU", conf: confValue, type: cType };
};

async function sync() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        if (latest.id > currentSessionId) {
            if (predictionLogs.length > 0) {
                const prev = predictionLogs[0];
                const real = latest.point >= 11 ? "🔴 TÀI" : "⚪ XỈU";
                prev.status = (prev.predict === real) ? "✅ WIN" : "❌ LOSE";
                prev.result = real;
            }

            const decision = predict_engine(data);
            predictionLogs.unshift({
                id: latest.id + 1,
                predict: decision.res,
                confidence: `${decision.conf}%`,
                pattern: decision.type,
                result: "⏳ ĐỢI",
                status: "🔄 SOI",
                time: new Date().toLocaleTimeString('vi-VN')
            });

            currentSessionId = latest.id;
            if (predictionLogs.length > 20) predictionLogs.pop();
        }
    } catch (e) { }
}

app.register(cors);

app.get("/api/taixiumd5/v14", async () => {
    if (predictionLogs.length === 0) await sync();
    const cur = predictionLogs[0];
    return {
        "DIAMOND_AI_SUPREME": "v14.1_STABLE",
        "ADMIN": "TRẦN NHẬT HOÀNG",
        "CURRENT": {
            "ID": `#${cur.id}`,
            "SIGNAL": cur.predict,
            "ACCURACY": cur.confidence,
            "LOGIC": cur.pattern,
            "TIME": cur.time
        },
        "HISTORY": predictionLogs.slice(1, 11).map(l => ({
            "P": l.id, "D": l.predict, "K": l.result, "S": l.status
        })),
        "STATUS": "🟢 ACTIVE"
    };
});

setInterval(sync, 3000);
sync();

const start = async () => {
    try {
        await app.listen({ port: PORT, host: "0.0.0.0" });
        console.log(`🚀 v14.1 READY - ADMIN: HOANGDZ`);
    } catch (err) {
        process.exit(1);
    }
};
start();
