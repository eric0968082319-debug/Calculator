/**
 * 進階工程計算機核心邏輯 (Advanced Scientific Calculator Logic)
 * 包含：狀態管理、科學運算、表達式解析與翻譯、歷史紀錄與鍵盤快捷鍵
 */

// 取得 HTML 元素引用
const display = document.getElementById('display');
const formulaDisplay = document.getElementById('formula-display');
const indicator2nd = document.getElementById('indicator-2nd');
const indicatorAngle = document.getElementById('indicator-angle');
const btn2nd = document.getElementById('btn-2nd');
const btnAngle = document.getElementById('btn-angle');
const historyDrawer = document.getElementById('history-drawer');
const historyList = document.getElementById('history-list');

// 狀態變數
let expression = '';        // 用於儲存當前輸入的數學表達式 (內部表示法)
let is2nd = false;          // 是否啟用第二功能 (Shift 狀態)
let isRadian = false;       // 是否為弧度模式 (false = 角度 DEG, true = 弧度 RAD)
let shouldReset = false;    // 是否在下次輸入時重設螢幕 (在計算出結果後)

// 從 localStorage 載入歷史紀錄
let calcHistory = JSON.parse(localStorage.getItem('calc_history') || '[]');

// 初始化畫面
updateDisplay();
renderHistory();

/* ==========================================================================
   科學計算輔助函數 (Scientific Math Helper Functions)
   ========================================================================== */

/**
 * 階乘函數 (Factorial)
 * @param {number} n - 輸入的數值
 * @returns {number} 階乘結果
 */
function fact(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    // 若為小數，則無條件捨去取整進行階乘
    if (!Number.isInteger(n)) {
        n = Math.floor(n);
    }
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
        if (result === Infinity) return Infinity;
    }
    return result;
}

// 將三角函數與反三角函數包裝，支援角度 (DEG) / 弧度 (RAD) 切換
const sin = (x) => isRadian ? Math.sin(x) : Math.sin(x * Math.PI / 180);
const cos = (x) => isRadian ? Math.cos(x) : Math.cos(x * Math.PI / 180);
const tan = (x) => {
    // 處理角度模式下 tan(90) 等無定義值
    if (!isRadian && (Math.abs(x) % 180 === 90)) return NaN;
    return isRadian ? Math.sin(x) / Math.cos(x) : Math.tan(x * Math.PI / 180);
};

const asin = (x) => isRadian ? Math.asin(x) : Math.asin(x) * 180 / Math.PI;
const acos = (x) => isRadian ? Math.acos(x) : Math.acos(x) * 180 / Math.PI;
const atan = (x) => isRadian ? Math.atan(x) : Math.atan(x) * 180 / Math.PI;

// 其他對數與開根號輔助函數 (為方便 eval 解析)
const ln = (x) => Math.log(x);
const log = (x) => Math.log10(x);
const sqrt = (x) => Math.sqrt(x);
const cbrt = (x) => Math.cbrt(x);

/* ==========================================================================
   狀態切換與更新邏輯 (State Toggle & UI Update)
   ========================================================================== */

/**
 * 切換 2nd 功能 (Shift)
 */
function toggle2nd() {
    is2nd = !is2nd;
    
    // 更新頂部指示器
    if (is2nd) {
        indicator2nd.classList.add('active');
        btn2nd.classList.add('active');
    } else {
        indicator2nd.classList.remove('active');
        btn2nd.classList.remove('active');
    }
    
    // 動態更新科學按鍵的文字與提示
    updateScientificButtons();
}

/**
 * 更新科學運算按鈕的標籤 (當 2nd 狀態改變時)
 */
function updateScientificButtons() {
    const mappings = {
        'btn-sin': { normal: 'sin', shift: 'sin⁻¹' },
        'btn-cos': { normal: 'cos', shift: 'cos⁻¹' },
        'btn-tan': { normal: 'tan', shift: 'tan⁻¹' },
        'btn-ln': { normal: 'ln', shift: 'eˣ' },
        'btn-log': { normal: 'log', shift: '10ˣ' },
        'btn-sqrt': { normal: '√', shift: '³√' },
        'btn-power': { normal: '^', shift: 'yˣ' } // y^x 等同於一般的自訂次方 ^
    };

    for (const [id, value] of Object.entries(mappings)) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = is2nd ? value.shift : value.normal;
        }
    }
}

/**
 * 切換角度 (DEG) / 弧度 (RAD) 模式
 */
function toggleAngleMode() {
    isRadian = !isRadian;
    if (isRadian) {
        indicatorAngle.textContent = 'RAD';
        btnAngle.textContent = 'rad';
    } else {
        indicatorAngle.textContent = 'DEG';
        btnAngle.textContent = 'deg';
    }
}

/**
 * 格式化表達式以便美觀地呈現在螢幕上
 */
function updateDisplay() {
    // 將內部的運算符與函數名稱替換成使用者習慣的符號
    let formatted = expression
        .replace(/\*/g, '×')
        .replace(/\//g, '÷')
        .replace(/asin\(/g, 'sin⁻¹(')
        .replace(/acos\(/g, 'cos⁻¹(')
        .replace(/atan\(/g, 'tan⁻¹(')
        .replace(/sqrt\(/g, '√(')
        .replace(/cbrt\(/g, '³√(')
        .replace(/fact\(/g, 'fact(')
        .replace(/10\^\(/g, '10^(')
        .replace(/e\^\(/g, 'e^(');
    
    display.value = formatted || '0';
}

/* ==========================================================================
   輸入處理功能 (Input Handlers)
   ========================================================================== */

/**
 * 新增數字或小數點到表達式中
 * @param {string} num - 點擊的數字字串
 */
function appendNumber(num) {
    if (shouldReset) {
        expression = '';
        shouldReset = false;
    }
    
    // 避免重複輸入小數點在同一個數字中
    if (num === '.') {
        // 找到最後一個數字區段，檢查是否已含小數點
        const parts = expression.split(/[\+\-\*\/\(\)\^%]/);
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) return;
    }
    
    expression += num;
    updateDisplay();
}

/**
 * 新增運算子到表達式中
 * @param {string} op - 運算子
 */
function appendOperator(op) {
    if (shouldReset) {
        shouldReset = false;
    }
    
    // 若表達式為空且輸入的不是減號或左括號，則不處理
    if (expression === '' && op !== '-' && op !== '(') return;
    
    // 避免多個雙運算子連續輸入，除階乘 ! 與百分比 % 外
    const lastChar = expression[expression.length - 1];
    if (['+', '-', '*', '/', '^'].includes(lastChar) && ['+', '-', '*', '/', '^'].includes(op)) {
        // 替換最後一個運算子
        expression = expression.slice(0, -1);
    }
    
    expression += op;
    updateDisplay();
}

/**
 * 新增科學函數
 * @param {string} func - 函數字串，例如 'sin('
 */
function appendScientific(func) {
    if (shouldReset) {
        expression = '';
        shouldReset = false;
    }
    
    // 依據是否開啟 2nd 功能，映射到不同的運算
    if (is2nd) {
        toggle2nd(); // 點擊後自動關閉 2nd 狀態
        if (func === 'sin(') expression += 'asin(';
        else if (func === 'cos(') expression += 'acos(';
        else if (func === 'tan(') expression += 'atan(';
        else if (func === 'ln(') expression += 'e^(';
        else if (func === 'log(') expression += '10^(';
        else if (func === '√(') expression += '³√(';
    } else {
        expression += func;
    }
    
    updateDisplay();
}

/**
 * 新增常數到表達式中
 * @param {string} constant - 常數，例如 'π' 或 'e'
 */
function appendConstant(constant) {
    if (shouldReset) {
        expression = '';
        shouldReset = false;
    }
    expression += constant;
    updateDisplay();
}

/**
 * 直接新增值 (例如括號)
 * @param {string} val - 欲新增的值
 */
function appendValue(val) {
    if (shouldReset) {
        expression = '';
        shouldReset = false;
    }
    expression += val;
    updateDisplay();
}

/**
 * 切換正負號
 */
function toggleSign() {
    if (expression === '') return;
    
    // 尋找最後一個數值
    // 使用正規表達式匹配表達式末端的數字（可能包含小數點）
    const match = expression.match(/(\d+(?:\.\d+)?|π|e)$/);
    if (match) {
        const matched = match[1];
        const startIndex = expression.length - matched.length;
        
        // 檢查前一個字元是否為負號 '-' 且為獨立負號 (非減號)
        // 簡化起見，如果前有括號包覆的負號如 '(-5)'，則進行對應轉換
        if (startIndex >= 2 && expression.slice(startIndex - 2, startIndex) === '(-') {
            expression = expression.slice(0, startIndex - 2) + matched;
        } else {
            expression = expression.slice(0, startIndex) + `(-${matched})`;
        }
    }
    updateDisplay();
}

/**
 * 刪除最後一個字元 (Backspace)
 */
function backspace() {
    if (expression === '') return;
    
    // 檢查是否要刪除整個函數單字而非單一字元
    const funcs = ['asin(', 'acos(', 'atan(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', 'cbrt(', '10^(', 'e^('];
    let deleted = false;
    for (const f of funcs) {
        if (expression.endsWith(f)) {
            expression = expression.slice(0, -f.length);
            deleted = true;
            break;
        }
    }
    
    if (!deleted) {
        expression = expression.slice(0, -1);
    }
    
    updateDisplay();
}

/**
 * 清除所有顯示
 */
function clearDisplay() {
    expression = '';
    formulaDisplay.textContent = '';
    updateDisplay();
}

/* ==========================================================================
   計算引擎與翻譯 (Calculation Engine & Translation)
   ========================================================================== */

/**
 * 將使用者輸入的數學公式翻譯成 JS 可執行的 eval 表達式
 * @param {string} expr - 輸入表達式
 * @returns {string} 翻譯後的 JS 表達式
 */
function translateExpression(expr) {
    // 1. 去除所有空白字元
    let readyExpr = expr.replace(/\s+/g, '');

    // 2. 補全括號（確保左右括號對等，避免 eval 報錯）
    const leftCount = (readyExpr.match(/\(/g) || []).length;
    const rightCount = (readyExpr.match(/\)/g) || []).length;
    if (leftCount > rightCount) {
        readyExpr += ')'.repeat(leftCount - rightCount);
    }

    // 3. 處理隱式乘法 (Implicit Multiplication)
    // 數字後接字母、括號、常數或根號：如 2π -> 2*π, 2( -> 2*(, 2sin -> 2*sin
    readyExpr = readyExpr.replace(/(\d)(?=[a-zA-Z(πe√³])/g, '$1*');
    // 常數或右括號後接數字、字母、常數或左括號：如 )2 -> )*2, π( -> π*(, e( -> e*(, )sin -> )*sin
    readyExpr = readyExpr.replace(/([\)πe])(?=[\d\(a-zA-Zπe√³])/g, '$1*');

    // 4. 常數替換
    readyExpr = readyExpr.replace(/π/g, 'Math.PI');
    // standalone 'e' (尤拉數) 替換為 Math.E。利用 \be\b 避免替換掉 sin, cos, ln 等單字中的 e
    readyExpr = readyExpr.replace(/\be\b/g, 'Math.E');

    // 5. 次方運算子 `^` 替換為 `**`
    readyExpr = readyExpr.replace(/\^/g, '**');

    // 6. 根號轉換
    readyExpr = readyExpr.replace(/√\(/g, 'sqrt(');
    readyExpr = readyExpr.replace(/³√\(/g, 'cbrt(');

    // 7. 百分比 `%` 轉換成除以 100
    readyExpr = readyExpr.replace(/%/g, '*0.01');

    // 8. 階乘運算 `!` 轉換為函數呼叫 `fact(...)`
    // 遞迴/循環地將 "主體!" 轉為 "fact(主體)"
    // 主體可以是數值、常數、或是含括號的區段
    let prevExpr;
    const factRegex = /([a-zA-Z0-9_.]+(?:\((?:[^()]+|\([^()]*\))*\))?|\((?:[^()]+|\([^()]*\))*\))!/g;
    do {
        prevExpr = readyExpr;
        readyExpr = readyExpr.replace(factRegex, 'fact($1)');
    } while (readyExpr !== prevExpr);

    return readyExpr;
}

/**
 * 執行表達式計算並輸出結果
 */
function calculate() {
    if (expression === '') return;
    
    // 保存原表達式以便於歷史紀錄
    const originalExpression = expression;
    
    try {
        // 翻譯成 JavaScript eval 表達式
        const parsedExpression = translateExpression(expression);
        
        // 執行 eval 計算 (在此作用域中可訪問上面的輔助函數如 sin, cos, ln, fact, Math 等)
        let result = eval(parsedExpression);
        
        // 驗證計算結果是否為有效數字
        if (result === undefined || isNaN(result)) {
            throw new Error('Invalid calculation');
        }
        
        // 處理浮點數精度誤差 (保留最多 10 位有效小數)
        if (typeof result === 'number' && !Number.isInteger(result) && isFinite(result)) {
            result = Math.round(result * 1e10) / 1e10;
        }
        
        // 更新歷史公式顯示
        formulaDisplay.textContent = originalExpression
            .replace(/\*/g, '×')
            .replace(/\//g, '÷')
            .replace(/asin\(/g, 'sin⁻¹(')
            .replace(/acos\(/g, 'cos⁻¹(')
            .replace(/atan\(/g, 'tan⁻¹(')
            .replace(/sqrt\(/g, '√(')
            .replace(/cbrt\(/g, '³√(') + ' =';
            
        // 更新螢幕結果
        display.value = result;
        
        // 儲存至內部 expression 與設定重設旗標
        expression = result.toString();
        shouldReset = true;
        
        // 新增至歷史紀錄
        addHistoryItem(originalExpression, result.toString());
        
    } catch (error) {
        console.error('Calculation Error:', error);
        display.value = 'Error';
        expression = '';
        shouldReset = true;
    }
}

/* ==========================================================================
   歷史紀錄功能 (History Management)
   ========================================================================== */

/**
 * 切換歷史紀錄側邊欄顯示狀態
 */
function toggleHistory() {
    historyDrawer.classList.toggle('open');
}

/**
 * 新增一筆歷史紀錄到列表與 localStorage
 * @param {string} formula - 計算公式
 * @param {string} result - 計算結果
 */
function addHistoryItem(formula, result) {
    // 避免重複寫入相同的連續歷史紀錄
    if (calcHistory.length > 0 && calcHistory[0].formula === formula && calcHistory[0].result === result) {
        return;
    }
    
    // 新增至首位
    calcHistory.unshift({ formula, result });
    
    // 限制歷史紀錄上限為 50 筆
    if (calcHistory.length > 50) {
        calcHistory.pop();
    }
    
    // 儲存並渲染
    localStorage.setItem('calc_history', JSON.stringify(calcHistory));
    renderHistory();
}

/**
 * 渲染歷史紀錄面板列表
 */
function renderHistory() {
    if (calcHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history">暫無計算紀錄</div>';
        return;
    }
    
    let html = '';
    calcHistory.forEach((item, index) => {
        // 格式化以呈現給使用者
        const displayFormula = item.formula
            .replace(/\*/g, '×')
            .replace(/\//g, '÷')
            .replace(/asin\(/g, 'sin⁻¹(')
            .replace(/acos\(/g, 'cos⁻¹(')
            .replace(/atan\(/g, 'tan⁻¹(')
            .replace(/sqrt\(/g, '√(')
            .replace(/cbrt\(/g, '³√(');
            
        html += `
            <div class="history-item" onclick="loadHistory(${index})">
                <div class="history-item-formula">${displayFormula} =</div>
                <div class="history-item-result">${item.result}</div>
            </div>
        `;
    });
    
    historyList.innerHTML = html;
}

/**
 * 點擊歷史紀錄將其載入回計算機中
 * @param {number} index - 歷史紀錄索引
 */
function loadHistory(index) {
    if (calcHistory[index]) {
        expression = calcHistory[index].formula;
        shouldReset = false;
        updateDisplay();
        toggleHistory(); // 載入後自動關閉歷史欄
    }
}

/**
 * 清除所有歷史紀錄
 */
function clearHistory() {
    if (confirm('確定要清除所有計算歷史紀錄嗎？')) {
        calcHistory = [];
        localStorage.removeItem('calc_history');
        renderHistory();
    }
}

/* ==========================================================================
   鍵盤快捷鍵綁定 (Keyboard Shortcut Bindings)
   ========================================================================== */

document.addEventListener('keydown', function(event) {
    const key = event.key;
    const shift = event.shiftKey;
    
    // 偵測 Shift 單擊切換 2nd，若與其他複合鍵合用則不單獨切換
    if (key === 'Shift') {
        // 由於 Shift 單擊較難區分，為避免打字干擾，我們讓 Shift 當被單獨按下與放開時才觸發，
        // 在此使用快捷鍵 'a' 或 'A' 作為 2nd 模式切換；或雙擊 Shift。
        // 為直覺起見，在此直接支援 key === 's' 且有/無 shift 來區分 sin / asin，
        // 所以用戶鍵盤直接按 S (即 Shift+S) 就代表反三角函數，不需額外按實體 2nd 鍵。
        return;
    }

    // 數字鍵與小數點
    if (key >= '0' && key <= '9') {
        event.preventDefault();
        appendNumber(key);
    } else if (key === '.') {
        event.preventDefault();
        appendNumber('.');
    } 
    // 基礎運算子
    else if (key === '+') {
        event.preventDefault();
        appendOperator('+');
    } else if (key === '-') {
        event.preventDefault();
        appendOperator('-');
    } else if (key === '*') {
        event.preventDefault();
        appendOperator('*');
    } else if (key === '/') {
        event.preventDefault();
        appendOperator('/');
    } else if (key === '%') {
        event.preventDefault();
        appendOperator('%');
    } else if (key === '^') {
        event.preventDefault();
        appendOperator('^');
    } else if (key === '!') {
        event.preventDefault();
        appendOperator('!');
    }
    // 括號
    else if (key === '(') {
        event.preventDefault();
        appendValue('(');
    } else if (key === ')') {
        event.preventDefault();
        appendValue(')');
    }
    // 常數
    else if (key === 'p' || key === 'P') {
        event.preventDefault();
        appendConstant('π');
    } else if (key === 'e' || key === 'E') {
        // 排除與科學運算鍵重複：我們用 'n' 表 ln，'e' 單純表示尤拉常數 e
        event.preventDefault();
        appendConstant('e');
    }
    // 工程三角函數快捷鍵 (大小寫區分三角/反三角)
    else if (key === 's') {
        event.preventDefault();
        appendScientific('sin(');
    } else if (key === 'S') {
        event.preventDefault();
        // Shift+S -> asin(
        is2nd = true;
        appendScientific('sin(');
    } else if (key === 'c') {
        event.preventDefault();
        appendScientific('cos(');
    } else if (key === 'C') {
        event.preventDefault();
        // Shift+C -> acos(
        is2nd = true;
        appendScientific('cos(');
    } else if (key === 't') {
        event.preventDefault();
        appendScientific('tan(');
    } else if (key === 'T') {
        event.preventDefault();
        // Shift+T -> atan(
        is2nd = true;
        appendScientific('tan(');
    }
    // 對數快捷鍵
    else if (key === 'l') {
        event.preventDefault();
        appendScientific('log(');
    } else if (key === 'L') {
        event.preventDefault();
        // Shift+L -> 10^(
        is2nd = true;
        appendScientific('log(');
    } else if (key === 'n') {
        event.preventDefault();
        appendScientific('ln(');
    } else if (key === 'N') {
        event.preventDefault();
        // Shift+N -> e^(
        is2nd = true;
        appendScientific('ln(');
    }
    // 根號快捷鍵
    else if (key === 'q') {
        event.preventDefault();
        appendScientific('√(');
    } else if (key === 'Q') {
        event.preventDefault();
        // Shift+Q -> ³√(
        is2nd = true;
        appendScientific('√(');
    }
    // 控制鍵與功能鍵
    else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        calculate();
    } else if (key === 'Backspace') {
        event.preventDefault();
        backspace();
    } else if (key === 'Escape' || key === 'Delete') {
        event.preventDefault();
        clearDisplay();
    } else if (key === 'h' || key === 'H') {
        event.preventDefault();
        toggleHistory();
    } else if (key === 'd' || key === 'D') {
        event.preventDefault();
        toggleAngleMode();
    } else if (key === 'a' || key === 'A') {
        // 鍵盤 A/a 可手動切換 2nd 狀態
        event.preventDefault();
        toggle2nd();
    }
});