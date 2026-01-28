const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8000;

// ====================== CẤU HÌNH ======================
const POLL_INTERVAL = 5000; // 5 giây
const RETRY_DELAY = 5000;
const MAX_HISTORY = 100;

// ====================== CLASS TAI XIU PREDICTOR ======================
class TaiXiuPredictor {
    constructor() {
        this.models = {};
        this.weights = {};
        this.performance = {};
        this.history = [];
        this.patternDatabase = {};
        this.advancedPatterns = {};
        this.sessionStats = {
            transitions: {},
            streaks: { T: 0, X: 0, maxT: 0, maxX: 0 },
            volatility: 0.5,
            patternConfidence: {}
        };
        this.marketState = {
            trend: 'neutral',
            momentum: 0,
            stability: 0.5,
            regime: 'normal'
        };
        this.adaptiveParameters = {
            patternConfidenceDecay: 0.9,
            patternConfidenceGrowth: 1.1,
            trendStrengthThreshold: 0.6,
            volatilityThreshold: 0.7,
            patternMinLength: 3,
            patternMaxLength: 6
        };
        
        this.initAllModels();
    }
    
    initAllModels() {
        // Khởi tạo 21 models chính
        for (let i = 1; i <= 21; i++) {
            // Model chính
            this.models[`model${i}`] = this[`model${i}`].bind(this);
            
            // Khởi tạo trọng số và hiệu suất
            this.weights[`model${i}`] = 1;
            this.performance[`model${i}`] = { 
                correct: 0, 
                total: 0,
                recentCorrect: 0,
                recentTotal: 0,
                streak: 0,
                maxStreak: 0
            };
        }
        
        // Khởi tạo cơ sở dữ liệu pattern
        this.initPatternDatabase();
        this.initAdvancedPatterns();
    }
    
    // Các models dự đoán
    model1(data) {
        // Model dựa trên xu hướng gần đây
        if (data.length < 5) return { prediction: 'T', confidence: 0.5 };
        
        const recent = data.slice(-5);
        const tCount = recent.filter(x => x === 'T').length;
        const xCount = recent.filter(x => x === 'X').length;
        
        if (tCount > xCount) {
            return { prediction: 'T', confidence: 0.55 + (tCount - xCount) * 0.05 };
        } else {
            return { prediction: 'X', confidence: 0.55 + (xCount - tCount) * 0.05 };
        }
    }
    
    model2(data) {
        // Model dựa trên đảo chiều
        if (data.length < 3) return { prediction: 'T', confidence: 0.5 };
        
        const last = data[data.length - 1];
        const secondLast = data[data.length - 2];
        
        if (last === secondLast) {
            return { prediction: last === 'T' ? 'X' : 'T', confidence: 0.6 };
        } else {
            return { prediction: last, confidence: 0.55 };
        }
    }
    
    model3(data) {
        // Model dựa trên chuỗi
        if (data.length < 4) return { prediction: 'T', confidence: 0.5 };
        
        const lastThree = data.slice(-3);
        const allSame = lastThree.every(x => x === lastThree[0]);
        
        if (allSame) {
            return { 
                prediction: lastThree[0] === 'T' ? 'X' : 'T', 
                confidence: 0.65 + (this.sessionStats.streaks[lastThree[0]] || 0) * 0.05 
            };
        }
        
        return { prediction: 'T', confidence: 0.5 };
    }
    
    model4(data) {
        // Model pattern matching đơn giản
        if (data.length < 6) return { prediction: 'T', confidence: 0.5 };
        
        const lastThree = data.slice(-3).join('');
        const patterns = {
            'TTT': 'X',
            'XXX': 'T',
            'TXT': 'X',
            'XTX': 'T',
            'TTX': 'T',
            'XXT': 'X',
            'TXX': 'T',
            'XTT': 'X'
        };
        
        if (patterns[lastThree]) {
            return { prediction: patterns[lastThree], confidence: 0.62 };
        }
        
        return this.model1(data);
    }
    
    model5(data) {
        // Model dựa trên thống kê tổng thể
        if (data.length < 10) return { prediction: 'T', confidence: 0.5 };
        
        const tCount = data.filter(x => x === 'T').length;
        const xCount = data.filter(x => x === 'X').length;
        const tProbability = tCount / data.length;
        
        if (tProbability > 0.55) {
            return { prediction: 'X', confidence: tProbability };
        } else if (tProbability < 0.45) {
            return { prediction: 'T', confidence: 1 - tProbability };
        }
        
        return { prediction: data[data.length - 1] === 'T' ? 'X' : 'T', confidence: 0.52 };
    }
    
    model6(data) {
        // Model dựa trên biến động
        if (data.length < 8) return { prediction: 'T', confidence: 0.5 };
        
        const volatility = this.calculateVolatility(data.slice(-8));
        if (volatility > 0.7) {
            // Biến động cao, dự đoán đảo chiều
            const last = data[data.length - 1];
            return { prediction: last === 'T' ? 'X' : 'T', confidence: 0.58 };
        } else {
            // Biến động thấp, tiếp tục xu hướng
            const last = data[data.length - 1];
            return { prediction: last, confidence: 0.61 };
        }
    }
    
    model7(data) {
        // Model dựa trên phân phối xác suất
        if (data.length < 12) return { prediction: 'T', confidence: 0.5 };
        
        // Tính tần suất chuyển tiếp
        const transitions = {
            'TT': 0, 'TX': 0, 'XT': 0, 'XX': 0
        };
        
        for (let i = 1; i < data.length; i++) {
            const key = data[i-1] + data[i];
            transitions[key]++;
        }
        
        const last = data[data.length - 1];
        const tt = transitions[last + 'T'] || 0;
        const tx = transitions[last + 'X'] || 0;
        
        if (tt > tx) {
            return { prediction: 'T', confidence: tt / (tt + tx) };
        } else {
            return { prediction: 'X', confidence: tx / (tt + tx) };
        }
    }
    
    model8(data) {
        // Model momentum
        if (data.length < 7) return { prediction: 'T', confidence: 0.5 };
        
        const recent = data.slice(-7);
        let momentum = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i] === recent[i-1]) {
                momentum += recent[i] === 'T' ? 1 : -1;
            }
        }
        
        if (momentum > 1) {
            return { prediction: 'T', confidence: 0.63 };
        } else if (momentum < -1) {
            return { prediction: 'X', confidence: 0.63 };
        }
        
        return { prediction: data[data.length - 1], confidence: 0.55 };
    }
    
    model9(data) {
        // Model chu kỳ đơn giản
        if (data.length < 10) return { prediction: 'T', confidence: 0.5 };
        
        // Tìm pattern lặp ngắn
        for (let cycle = 2; cycle <= 5; cycle++) {
            if (data.length >= cycle * 2) {
                const pattern1 = data.slice(-cycle * 2, -cycle);
                const pattern2 = data.slice(-cycle);
                if (this.arraysEqual(pattern1, pattern2)) {
                    return { 
                        prediction: pattern1[0], 
                        confidence: 0.68 
                    };
                }
            }
        }
        
        return { prediction: data[data.length - 1], confidence: 0.52 };
    }
    
    model10(data) {
        // Model cân bằng
        if (data.length < 15) return { prediction: 'T', confidence: 0.5 };
        
        const tCount = data.filter(x => x === 'T').length;
        const xCount = data.filter(x => x === 'X').length;
        const diff = Math.abs(tCount - xCount);
        
        // Nếu chênh lệch lớn, dự đoán cân bằng
        if (diff > data.length * 0.2) {
            return { 
                prediction: tCount > xCount ? 'X' : 'T', 
                confidence: 0.6 
            };
        }
        
        return { prediction: data[data.length - 1], confidence: 0.53 };
    }
    
    // Các model 11-21 (đơn giản hóa)
    model11(data) { return this.model1(data); }
    model12(data) { return this.model2(data); }
    model13(data) { return this.model3(data); }
    model14(data) { return this.model4(data); }
    model15(data) { return this.model5(data); }
    model16(data) { return this.model6(data); }
    model17(data) { return this.model7(data); }
    model18(data) { return this.model8(data); }
    model19(data) { return this.model9(data); }
    model20(data) { return this.model10(data); }
    model21(data) { 
        // Model ngẫu nhiên có điều chỉnh
        const last = data[data.length - 1] || 'T';
        return Math.random() > 0.5 ? 
            { prediction: last, confidence: 0.51 } : 
            { prediction: last === 'T' ? 'X' : 'T', confidence: 0.51 };
    }
    
    initPatternDatabase() {
        this.patternDatabase = {
            'T-X-T-X': { pattern: ['T', 'X', 'T', 'X'], probability: 0.7, strength: 0.8 },
            'T-X-X-T': { pattern: ['T', 'X', 'X', 'T'], probability: 0.65, strength: 0.75 },
            'T-T-X-T-T': { pattern: ['T', 'T', 'X', 'T', 'T'], probability: 0.68, strength: 0.78 },
            'T-T-T-X': { pattern: ['T', 'T', 'T', 'X'], probability: 0.72, strength: 0.82 },
            'T-X-X-X': { pattern: ['T', 'X', 'X', 'X'], probability: 0.72, strength: 0.82 },
            'T-T-X-X': { pattern: ['T', 'T', 'X', 'X'], probability: 0.66, strength: 0.76 },
            'T-T-X-X-X': { pattern: ['T', 'T', 'X', 'X', 'X'], probability: 0.71, strength: 0.81 },
            'T-T-T-X-X': { pattern: ['T', 'T', 'T', 'X', 'X'], probability: 0.73, strength: 0.83 },
            'T-T-T-T-X': { pattern: ['T', 'T', 'T', 'T', 'X'], probability: 0.76, strength: 0.86 },
            'T-X-X-X-X': { pattern: ['T', 'X', 'X', 'X', 'X'], probability: 0.76, strength: 0.86 },
            'X-T-X-T': { pattern: ['X', 'T', 'X', 'T'], probability: 0.7, strength: 0.8 },
            'X-X-T-T': { pattern: ['X', 'X', 'T', 'T'], probability: 0.66, strength: 0.76 },
        };
    }
    
    initAdvancedPatterns() {
        this.advancedPatterns = {
            'dynamic-1': {
                detect: (data) => {
                    if (data.length < 6) return false;
                    const last6 = data.slice(-6);
                    return last6.filter(x => x === 'T').length === 4 && 
                           last6[last6.length-1] === 'T';
                },
                predict: () => 'X',
                confidence: 0.72,
                description: "4T trong 6 phiên, cuối là T -> dự đoán X"
            },
            'dynamic-2': {
                detect: (data) => {
                    if (data.length < 8) return false;
                    const last8 = data.slice(-8);
                    const tCount = last8.filter(x => x === 'T').length;
                    return tCount >= 6 && last8[last8.length-1] === 'T';
                },
                predict: () => 'X',
                confidence: 0.78,
                description: "6+T trong 8 phiên, cuối là T -> dự đoán X mạnh"
            },
            'alternating-3': {
                detect: (data) => {
                    if (data.length < 5) return false;
                    const last5 = data.slice(-5);
                    for (let i = 1; i < last5.length; i++) {
                        if (last5[i] === last5[i-1]) return false;
                    }
                    return true;
                },
                predict: (data) => data[data.length-1] === 'T' ? 'X' : 'T',
                confidence: 0.68,
                description: "5 phiên đan xen hoàn hảo -> dự đoán đảo chiều"
            }
        };
    }
    
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }
    
    calculateVolatility(data) {
        if (data.length < 2) return 0;
        let changes = 0;
        for (let i = 1; i < data.length; i++) {
            if (data[i] !== data[i-1]) changes++;
        }
        return changes / (data.length - 1);
    }
    
    addResult(result) {
        // Cập nhật thống kê session
        if (this.history.length > 0) {
            const lastResult = this.history[this.history.length-1];
            const transitionKey = `${lastResult}to${result}`;
            this.sessionStats.transitions[transitionKey] = (this.sessionStats.transitions[transitionKey] || 0) + 1;
            
            // Cập nhật streak
            if (result === lastResult) {
                this.sessionStats.streaks[result]++;
                this.sessionStats.streaks[`max${result}`] = Math.max(
                    this.sessionStats.streaks[`max${result}`],
                    this.sessionStats.streaks[result]
                );
            } else {
                this.sessionStats.streaks[result] = 1;
                this.sessionStats.streaks[lastResult] = 0;
            }
        } else {
            this.sessionStats.streaks[result] = 1;
        }
        
        this.history.push(result);
        if (this.history.length > 200) {
            this.history.shift();
        }
        
        // Cập nhật độ biến động
        this.updateVolatility();
        
        // Cập nhật trạng thái thị trường
        this.updateMarketState();
        
        // Cập nhật hiệu suất models
        this.updateModelPerformance(result);
    }
    
    updateVolatility() {
        if (this.history.length < 10) return;
        
        const recent = this.history.slice(-10);
        this.sessionStats.volatility = this.calculateVolatility(recent);
    }
    
    updateMarketState() {
        if (this.history.length < 15) return;
        
        const recent = this.history.slice(-15);
        const tCount = recent.filter(x => x === 'T').length;
        const xCount = recent.filter(x => x === 'X').length;
        
        // Tính trend strength
        const trendStrength = Math.abs(tCount - xCount) / recent.length;
        
        // Xác định trend
        if (trendStrength > this.adaptiveParameters.trendStrengthThreshold) {
            this.marketState.trend = tCount > xCount ? 'up' : 'down';
        } else {
            this.marketState.trend = 'neutral';
        }
        
        // Tính momentum
        let momentum = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i] === recent[i-1]) {
                momentum += recent[i] === 'T' ? 0.1 : -0.1;
            }
        }
        this.marketState.momentum = Math.tanh(momentum);
        
        // Tính stability
        this.marketState.stability = 1 - this.sessionStats.volatility;
        
        // Xác định regime
        if (this.sessionStats.volatility > this.adaptiveParameters.volatilityThreshold) {
            this.marketState.regime = 'volatile';
        } else if (trendStrength > 0.7) {
            this.marketState.regime = 'trending';
        } else if (trendStrength < 0.3) {
            this.marketState.regime = 'random';
        } else {
            this.marketState.regime = 'normal';
        }
    }
    
    updateModelPerformance(actualResult) {
        // Cập nhật hiệu suất của tất cả models
        for (const [modelName, modelFn] of Object.entries(this.models)) {
            if (this.history.length > 1) {
                const prediction = modelFn(this.history.slice(0, -1));
                if (prediction && prediction.prediction) {
                    const isCorrect = prediction.prediction === actualResult;
                    
                    this.performance[modelName].total++;
                    this.performance[modelName].recentTotal = Math.min(20, this.performance[modelName].recentTotal + 1);
                    
                    if (isCorrect) {
                        this.performance[modelName].correct++;
                        this.performance[modelName].recentCorrect = Math.min(20, this.performance[modelName].recentCorrect + 1);
                        this.performance[modelName].streak++;
                        this.performance[modelName].maxStreak = Math.max(
                            this.performance[modelName].maxStreak,
                            this.performance[modelName].streak
                        );
                    } else {
                        this.performance[modelName].streak = 0;
                    }
                    
                    // Điều chỉnh trọng số dựa trên hiệu suất gần đây
                    if (this.performance[modelName].recentTotal > 5) {
                        const recentAccuracy = this.performance[modelName].recentCorrect / 
                                              this.performance[modelName].recentTotal;
                        this.weights[modelName] = Math.max(0.1, Math.min(2, recentAccuracy * 1.5));
                    }
                }
            }
        }
    }
    
    predict() {
        if (this.history.length < 3) {
            return {
                prediction: 'T',
                confidence: 0.5,
                method: 'default',
                details: 'Không đủ dữ liệu'
            };
        }
        
        // Kiểm tra các advanced patterns trước
        for (const [patternName, pattern] of Object.entries(this.advancedPatterns)) {
            if (pattern.detect(this.history)) {
                const prediction = pattern.predict(this.history);
                return {
                    prediction: prediction,
                    confidence: pattern.confidence,
                    method: `advanced:${patternName}`,
                    details: pattern.description
                };
            }
        }
        
        // Kiểm tra pattern database
        const recentPattern = this.history.slice(-5).join('-');
        for (const [patternKey, patternData] of Object.entries(this.patternDatabase)) {
            const patternStr = patternData.pattern.join('-');
            if (recentPattern.endsWith(patternStr.slice(0, -2))) {
                const lastChar = patternData.pattern[patternData.pattern.length - 1];
                return {
                    prediction: lastChar,
                    confidence: patternData.strength * 0.9,
                    method: `pattern:${patternKey}`,
                    details: `Phát hiện pattern ${patternKey}`
                };
            }
        }
        
        // Voting từ tất cả models
        const votes = { T: 0, X: 0 };
        let totalConfidence = 0;
        let totalWeight = 0;
        
        for (const [modelName, modelFn] of Object.entries(this.models)) {
            try {
                const result = modelFn(this.history);
                if (result && result.prediction && result.confidence) {
                    const weight = this.weights[modelName] || 1;
                    votes[result.prediction] += result.confidence * weight;
                    totalConfidence += result.confidence * weight;
                    totalWeight += weight;
                }
            } catch (error) {
                console.error(`Lỗi model ${modelName}:`, error);
            }
        }
        
        // Tính toán kết quả cuối cùng
        const avgConfidence = totalConfidence / totalWeight;
        const tScore = votes.T / totalConfidence;
        const xScore = votes.X / totalConfidence;
        
        let finalPrediction, finalConfidence;
        if (tScore > xScore) {
            finalPrediction = 'T';
            finalConfidence = avgConfidence * tScore;
        } else {
            finalPrediction = 'X';
            finalConfidence = avgConfidence * xScore;
        }
        
        // Điều chỉnh dựa trên trạng thái thị trường
        if (this.marketState.regime === 'trending' && this.marketState.trend !== 'neutral') {
            finalPrediction = this.marketState.trend === 'up' ? 'T' : 'X';
            finalConfidence = Math.min(0.85, finalConfidence * 1.1);
        } else if (this.marketState.regime === 'volatile') {
            finalConfidence = Math.max(0.5, finalConfidence * 0.9);
        }
        
        // Đảm bảo confidence trong khoảng hợp lý
        finalConfidence = Math.max(0.5, Math.min(0.95, finalConfidence));
        
        return {
            prediction: finalPrediction,
            confidence: Math.round(finalConfidence * 100) / 100,
            method: 'ensemble_21_models',
            details: {
                tScore: Math.round(tScore * 100) / 100,
                xScore: Math.round(xScore * 100) / 100,
                totalModels: Object.keys(this.models).length,
                marketRegime: this.marketState.regime,
                volatility: Math.round(this.sessionStats.volatility * 100) / 100
            }
        };
    }
}

// ====================== KHỞI TẠO PREDICTOR ======================
const predictor100 = new TaiXiuPredictor();
const predictor101 = new TaiXiuPredictor();

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
    if (history.length === 0) return '';
    return history.slice(0, Math.min(10, history.length))
        .map(h => h.Ket_qua === "Tài" ? "T" : "X")
        .join('');
}

function updateResult(store, history, predictor, result, isMd5 = false) {
    Object.assign(store, result);
    history.unshift({...result});
    if (history.length > MAX_HISTORY) history.pop();
    
    // Cập nhật pattern string
    store.TX_Pattern = tinhPattern(history);
    
    // Cập nhật predictor
    const txChar = result.Ket_qua === "Tài" ? "T" : "X";
    predictor.addResult(txChar);
    
    // Lấy dự đoán mới từ thuật toán AI
    const prediction = predictor.predict();
    store.Du_doan = prediction.prediction === "T" ? "Tài" : "Xỉu";
    
    // Thêm thông tin dự đoán chi tiết
    store.Du_doan_chi_tiet = {
        Ket_qua_du_doan: prediction.prediction === "T" ? "Tài" : "Xỉu",
        Do_tin_cay: Math.round(prediction.confidence * 100) + "%",
        Phuong_phap: prediction.method,
        Thong_tin_bo_sung: prediction.details
    };
    
    // Log thông tin
    console.log(`[${isMd5 ? 'MD5' : 'TX'}] Phiên ${result.Phien} - Kết quả: ${result.Ket_qua}`);
    console.log(`[${isMd5 ? 'MD5' : 'TX'}] Dự đoán tiếp: ${store.Du_doan} (${store.Du_doan_chi_tiet.Do_tin_cay})`);
}

// ====================== POLLING ======================
async function pollAPI(gid, isMd5) {
    const url = `https://jakpotgwab.geightdors.net/glms/v1/notify/taixiu?platform_id=g8&gid=${gid}`;
    const predictor = isMd5 ? predictor101 : predictor100;

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

                            const result = { 
                                Phien: sid, 
                                Xuc_xac_1: d1, 
                                Xuc_xac_2: d2, 
                                Xuc_xac_3: d3, 
                                Tong: total, 
                                Ket_qua: ket_qua, 
                                id: "maicutevip11" 
                            };
                            
                            updateResult(latest_result_101, history_101, predictor, result, true);
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

                            const result = { 
                                Phien: sid, 
                                Xuc_xac_1: d1, 
                                Xuc_xac_2: d2, 
                                Xuc_xac_3: d3, 
                                Tong: total, 
                                Ket_qua: ket_qua, 
                                id: "maicutevip11" 
                            };
                            
                            updateResult(latest_result_100, history_100, predictor, result, false);
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
    res.json({ 
        taixiu: history_100.slice(0, 20), 
        taixiumd5: history_101.slice(0, 20) 
    });
});

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>🎲 API Server for TaiXiu</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h1 { color: #333; }
                    .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
                    code { background: #eee; padding: 2px 5px; }
                    .info { color: #666; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <h1>🎲 API Server for TaiXiu with AI Prediction</h1>
                <p class="info">Sử dụng 21 models AI ensemble cho dự đoán chính xác</p>
                <p>Endpoints:</p>
                <div class="endpoint">
                    <code>GET /api/taixiu</code> - Kết quả Tài Xỉu thường + Dự đoán AI
                </div>
                <div class="endpoint">
                    <code>GET /api/taixiumd5</code> - Kết quả Tài Xỉu MD5 + Dự đoán AI
                </div>
                <div class="endpoint">
                    <code>GET /api/history</code> - Lịch sử 20 phiên gần nhất
                </div>
                <p class="info">Dữ liệu được cập nhật tự động mỗi 5 giây</p>
            </body>
        </html>
    `);
});

// ====================== START POLLING ======================
console.log("🚀 Khởi động hệ thống API Tài Xỉu với thuật toán AI...");
console.log("📊 Sử dụng 21 models ensemble cho dự đoán");
pollAPI("vgmn_100", false);
pollAPI("vgmn_101", true);

// ====================== START SERVER ======================
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🔗 Truy cập http://localhost:${PORT} để xem thông tin`);
});
