import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let predictionLogs = [];         
let currentSessionId = 0;

// --- 🛠️ HÀM PHÂN TÍCH CHUYÊN SÂU (TECHNICAL ANALYSIS) ---
const get_trend_analysis = (history) => {
    const res = history.map(h => h.point >= 11 ? "TAI" : "XIU");
    const points = history.map(h => h.point);
    const last = res[res.length - 1];
    let trend = "Hỗn hợp";
    
    // 1. Nhận diện Cầu Bệt
    let streak = 0;
    for (let i = res.length - 1; i >= 0; i--) {
        if (res[i] === last) streak++; else break;
    }
    if (streak >= 4) trend = `Cầu Bệt ${last} (${streak} tay)`;

    // 2. Nhận diện Cầu Đảo (1-1)
    const last4 = res.slice(-4).join("");
    if (last4 === "TAIXIUTAix" || last4 === "XIUTAixiutai") trend = "Cầu Đảo (1-1)";

    // 3. Nhận diện Cầu Nghiêng
    const taiCount = res.slice(-20).filter(x => x === "TAI").length;
    const nghiêng = (taiCount / 20) * 100;
    if (nghiêng >= 70) trend = "Cầu Nghiêng TÀI (Ưu thế)";
    if (nghiêng <= 30) trend = "Cầu Nghiêng XỈU (Ưu thế)";

    // 4. Thống kê Xí Ngầu (Hồi mã thương)
    let note = "Ổn định";
    const lastPoint = points[points.length - 1];
    if (lastPoint >= 17 || lastPoint <= 4) note = "Cực trị - Xu hướng hồi mã về 9-12";

    return { trend, note, streak };
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
                prev.dice = latest.dice;
            }

            const analysis = get_trend_analysis(data);
            predictionLogs.unshift({
                id: latest.id + 1,
                predict: analysis.trend.includes("XIU") ? "🔴 TÀI" : "⚪ XỈU", // Logic đảo theo trend
                trend_type: analysis.trend,
                tech_note: analysis.note,
                result: "⏳ ĐỢI",
                status: "🔄 SOI",
                dice: "?.?.?",
                time: new Date().toLocaleTimeString('vi-VN')
            });

            currentSessionId = latest.id;
            if (predictionLogs.length > 10) predictionLogs.pop();
        }
    } catch (e) {}
}

app.register(cors);
app.get("/api/taixiumd5/v14", async () => {
    const cur = predictionLogs[0] || {};
    return {
        "DIAMOND_AI": "v14.7_KNOWLEDGE",
        "ADMIN": "TRẦN NHẬT HOÀNG",
        "KIEN_THUC_SOI_CAU": {
            "TREND_PATTERNS": "Bệt, Đảo 1-1, 2-2, 3-3, Nghiêng",
            "KY_THUAT": "Thống kê Xí Ngầu & Soi Điểm Phiên"
        },
        "PHAN_TICH_HIEN_TAI": {
            "PHIEN": `#${cur.id}`,
            "DANG_CAU": cur.trend_type,
            "GHI_CHU_KY_THUAT": cur.tech_note,
            "DU_DOAN_AI": cur.predict
        },
        "LICH_SU_DOI_SOAT": predictionLogs.slice(1, 6).map(l => ({
            "P": l.id, "D": l.predict, "K": l.result, "X": l.dice, "S": l.status
        }))
    };
});

setInterval(sync, 3000);
sync();
app.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
