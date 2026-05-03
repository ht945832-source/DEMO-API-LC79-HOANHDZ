import fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = fastify({ logger: false });
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

let fullHistory = []; 
let currentSessionId = 0;

// --- 🧠 1. BỘ CÔNG THỨC XÚC XẮC NHẬT HOÀNG (ƯU TIÊN 1) ---
const applyHoangDiceLogic = (point, diceStr) => {
    // Chốt chặn lỗi: Nếu không có chuỗi xúc xắc thì không phân tích để tránh lỗi 'split'
    if (!diceStr || typeof diceStr !== 'string') return null;

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

    return { res: "DỪNG", conf: 50, note: "Xúc xắc biến động lớn." };
};

// --- ⚙️ 2. THUẬT TOÁN AI BỔ TRỢ (ƯU TIÊN 2) ---
const analyzeAdvancedAI = (historyStr) => {
    const n = historyStr.length;
    if (n < 5) return { res: "DỪNG", conf: 50, note: "Đang nạp dữ liệu phiên..." };

    const lastThree = historyStr.slice(-3);
    if (lastThree === "111") return { res: "⚪ XỈU", conf: 75, note: "Cầu bệt Tài quá dài -> Bẻ Xỉu" };
    if (lastThree === "000") return { res: "🔴 TÀI", conf: 75, note: "Cầu bệt Xỉu quá dài -> Bẻ Tài" };

    const ones = (historyStr.match(/1/g) || []).length;
    const ratio = ones / n;
    if (ratio > 0.65) return { res: "⚪ XỈU", conf: 70, note: "Tỉ lệ Tài đang cao (Entropy)" };
    if (ratio < 0.35) return { res: "🔴 TÀI", conf: 70, note: "Tỉ lệ Xỉu đang cao (Entropy)" };

    return { res: "DỪNG", conf: 50, note: "Chưa đủ tín hiệu tin cậy." };
};

// --- 🔄 3. ĐỒNG BỘ VÀ XỬ LÝ LỖI DỮ LIỆU ---
async function sync() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (!json || !json.list || json.list.length === 0) return;

        const data = json.list.sort((a, b) => a.id - b.id);
        const latest = data[data.length - 1];

        // Kiểm tra dữ liệu phiên có hợp lệ không trước khi split
        if (!latest || latest.point === undefined || !latest.dice) return;

        // ĐỐI SOÁT PHIÊN TRƯỚC
        if (fullHistory.length > 0 && fullHistory[0].status === "🔄 ĐANG CHỜ") {
            const lastPred = fullHistory[0];
            const realResult = latest.point > 10 ? "🔴 TÀI" : "⚪ XỈU";
            lastPred.status = (lastPred.predict === realResult) ? "✅ WIN" : "❌ LOSE";
            lastPred.real = `${latest.dice} (${latest.point}đ)`;
        }

        if (latest.id > currentSessionId) {
            const historyStr = data.map(i => i.point > 10 ? "1" : "0").join("");
            
            // Chạy thuật toán của bạn trước
            let final = applyHoangDiceLogic(latest.point, latest.dice);
            // Nếu công thức của bạn báo DỪNG, mới chạy AI
            if (!final || final.res === "DỪNG") {
                final = analyzeAdvancedAI(historyStr);
            }
            
            fullHistory.unshift({
                id: latest.id + 1,
                predict: final.res,
                confidence: `${final.conf}%`,
                analysis: final.note,
                status: "🔄 ĐANG CHỜ",
                real: "Đang đợi kết quả...",
                time: new Date().toLocaleTimeString('vi-VN')
            });

            currentSessionId = latest.id;
            if (fullHistory.length > 20) fullHistory.pop();
        }
    } catch (e) { 
        // Bắt lỗi im lặng để không làm đỏ bảng Logs
        console.log("Waiting for API sync..."); 
    }
}

// --- 🌐 4. ROUTE HIỂN THỊ ---
app.register(cors);
app.get("/api/taixiumd5/v15", async () => {
    if (fullHistory.length === 0) {
        return { "STATUS": "Đang đồng bộ dữ liệu phiên mới nhất... Vui lòng đợi 10 giây." };
    }
    
    return {
        "ENGINE": "v15.4_MASTER_FIX",
        "OWNER": "TRẦN NHẬT HOÀNG",
        "PHIÊN_HIỆN_TẠI": {
            "PHIÊN": `#${fullHistory[0].id}`,
            "DỰ_ĐOÁN": fullHistory[0].predict,
            "TỰ_TIN": fullHistory[0].confidence,
            "LÝ_DO": fullHistory[0].analysis,
            "TRẠNG_THÁI": fullHistory[0].status
        },
        "LỊCH_SỬ_ĐỐI_SOÁT": fullHistory.slice(1, 11).map(h => ({
            "Phiên": h.id - 1,
            "Dự_Đoán": h.predict,
            "Kết_Quả": h.real,
            "Check": h.status
        }))
    };
});

// Chạy quét mỗi 4 giây
setInterval(sync, 4000);
sync();
app.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
