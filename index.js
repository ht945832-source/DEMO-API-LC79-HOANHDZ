import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let fullHistory = []; 
let currentSessionId = 0;

// --- 🧠 1. HỆ THỐNG CÔNG THỨC XÚC XẮC CỦA NHẬT HOÀNG ---
const applyHoangDiceLogic = (point, diceStr) => {
    const diceArr = diceStr.split(',').map(Number).sort((a,b) => a-b);
    const dStr = diceArr.join('-'); 

    if (point === 3) return { res: "⚪ XỈU", conf: 92, note: "Xỉu 3 (1-1-1): Giữ vững nhịp Xỉu." };
    if (point === 4) return { res: "⚪ XỈU", conf: 70, note: "Xỉu 4 (1-1-2): Ưu tiên Xỉu." };
    if (point === 5) return { res: "⚪ XỈU", conf: 91, note: "Xỉu 5: Cực mạnh, duy trì bệt Xỉu." };
    if (point === 6) return { res: "DỪNG", conf: 55, note: "Xỉu 6: Điểm cân bằng nhạy cảm." };
    if (point === 7) {
        if (["1-2-4", "2-2-3", "1-3-3"].includes(dStr)) return { res: "⚪ XỈU", conf: 80, note: "Xỉu 7 chuẩn." };
        return { res: "🔴 TÀI", conf: 60, note: "Xỉu 7 (1-1-5): Đảo chiều sang Tài." };
    }
    if (point === 8) {
        if (dStr === "1-3-4") return { res: "⚪ XỈU", conf: 86, note: "Xỉu 8 (1-3-4): Xỉu mạnh." };
        return { res: "🔴 TÀI", conf: 65, note: "Xỉu 8: Chuyển hướng Tài." };
    }
    if (point === 9) {
        if (dStr === "2-3-4") return { res: "⚪ XỈU", conf: 60, note: "Xỉu 9 (2-3-4): Duy trì Xỉu." };
        return { res: "DỪNG", conf: 50, note: "Xỉu 9: 50/50 khó đoán." };
    }
    if (point === 10) return { res: "⚪ XỈU", conf: 85, note: "Xỉu 10: Tiếp tục Xỉu." };
    if (point === 11) return { res: "DỪNG", conf: 50, note: "Tài 11: Cầu nát nhà, bỏ qua." };
    if (point === 12) {
        if (["2-4-6", "1-5-6", "3-3-6", "2-5-5"].includes(dStr)) return { res: "⚪ XỈU", conf: 87, note: "Tài 12 đặc biệt: Bẻ Xỉu." };
        return { res: "🔴 TÀI", conf: 60, note: "Tài 12: Kéo dài bệt Tài." };
    }
    if (point === 13) {
        if (["3-5-5", "1-6-6"].includes(dStr)) return { res: "⚪ XỈU", conf: 82, note: "Tài 13: Bẻ mạnh về Xỉu." };
        return { res: "🔴 TÀI", conf: 65, note: "Tài 13: Giữ nhịp Tài." };
    }
    if (point === 14) return { res: "DỪNG", conf: 50, note: "Tài 14: Điểm trung tính." };
    if (point === 15) return { res: "🔴 TÀI", conf: 88, note: "Tài 15: Cầu Tài mạnh." };
    if (point === 16) return { res: "⚪ XỈU", conf: 82, note: "Tài 16: Điểm cuối, chuyển Xỉu." };
    if (point === 17) return { res: "⚪ XỈU", conf: 95, note: "Tài 17: Cực nguy hiểm! Bẻ Xỉu." };
    if (point === 18) return { res: "🔴 TÀI", conf: 97, note: "Tài 18: Điểm cực đại, tiếp Tài." };

    return null;
};

// --- ⚙️ 2. THUẬT TOÁN AI BỔ SUNG (ENTROPY, WAVELET, MOMENTUM) ---
const analyzeAdvancedAI = (historyStr) => {
    // 2.1 Wavelet (Đa tỉ lệ)
    const n = historyStr.length;
    if (n > 20) {
        const lastTwo = historyStr.slice(-2);
        if (lastTwo === "11") return { res: "🔴 TÀI", conf: 80, note: "Sóng Wavelet thuận" };
        if (lastTwo === "00") return { res: "⚪ XỈU", conf: 80, note: "Sóng Wavelet thuận" };
    }
    // 2.2 Entropy (Đảo chiều khi quá loạn)
    const ones = (historyStr.match(/1/g) || []).length;
    const ratio = ones / n;
    if (ratio > 0.7) return { res: "⚪ XỈU", conf: 75, note: "Entropy cao - Chờ Xỉu cân bằng" };
    if (ratio < 0.3) return { res: "🔴 TÀI", conf: 75, note: "Entropy thấp - Chờ Tài cân bằng" };

    return { res: "DỪNG", conf: 50, note: "AI đang thu thập thêm tín hiệu" };
};

// --- 🔄 3. ĐỒNG BỘ VÀ ĐỐI SOÁT ---
async function sync() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json || !json.list) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        // ĐỐI SOÁT PHIÊN TRƯỚC (Kiểm tra xem dự đoán cũ đúng hay sai)
        if (fullHistory.length > 0 && fullHistory[0].status === "🔄 ĐANG CHỜ") {
            const lastPred = fullHistory[0];
            const realResult = latest.point > 10 ? "🔴 TÀI" : "⚪ XỈU";
            lastPred.status = (lastPred.predict === realResult) ? "✅ WIN" : "❌ LOSE";
            lastPred.real = `${latest.dice} (${latest.point}đ)`;
        }

        if (latest.id > currentSessionId) {
            const historyStr = data.map(i => i.point > 10 ? "1" : "0").join("");
            
            // Kết hợp thuật toán
            let final = applyHoangDiceLogic(latest.point, latest.dice);
            if (!final || final.res === "DỪNG") {
                final = analyzeAdvancedAI(historyStr);
            }
            
            fullHistory.unshift({
                id: latest.id + 1,
                predict: final.res,
                confidence: `${final.conf}%`,
                analysis: final.note,
                prev_dice: `${latest.dice} (${latest.point}đ)`,
                status: "🔄 ĐANG CHỜ",
                real: "Đang đợi kết quả...",
                time: new Date().toLocaleTimeString('vi-VN')
            });

            currentSessionId = latest.id;
            if (fullHistory.length > 20) fullHistory.pop();
        }
    } catch (e) { console.log("API Error:", e.message); }
}

app.register(cors);
app.get("/api/taixiumd5/v15", async () => {
    if (fullHistory.length === 0) return { "STATUS": "Đang đồng bộ dữ liệu..." };
    
    return {
        "ENGINE": "v15.3_MASTER_FINAL",
        "OWNER": "TRẦN NHẬT HOÀNG",
        "PHIÊN_HIỆN_TẠI": {
            "ID": `#${fullHistory[0].id}`,
            "DỰ_ĐOÁN": fullHistory[0].predict,
            "TỰ_TIN": fullHistory[0].confidence,
            "CƠ_SỞ": fullHistory[0].analysis,
            "TRẠNG_THÁI": fullHistory[0].status
        },
        "LỊCH_SỬ_ĐỐI_SOÁT": fullHistory.slice(1, 10).map(h => ({
            "Phiên": h.id - 1,
            "Dự_Đoán": h.predict,
            "Kết_Quả_Thực": h.real,
            "Trạng_Thái": h.status
        }))
    };
});

setInterval(sync, 4000);
sync();
app.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
