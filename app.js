// Calculator State
let calculator = {
  displayValue: '0',
  firstOperand: null,
  waitingForSecondOperand: false,
  operator: null,
  formula: ''
};
// History storage
let history = [];
// DOM Elements
const displayMain = document.getElementById('display-main');
const displayFormula = document.getElementById('display-formula');
const keypad = document.querySelector('.calc-keypad');
const btnTheme = document.getElementById('btn-theme');
const btnHistory = document.getElementById('btn-history');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnClearHistory = document.getElementById('btn-clear-history');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadHistory();
  updateDisplay();
  setupKeyboardSupport();
});
/* --- UI / Themes --- */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
  } else {
    document.body.classList.add('dark-theme');
  }
}
btnTheme.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  
  // Theme change animation pop
  btnTheme.style.transform = 'scale(0.8) rotate(45deg)';
  setTimeout(() => {
    btnTheme.style.transform = '';
  }, 250);
});
/* --- History Panel Logic --- */
btnHistory.addEventListener('click', () => {
  historyPanel.classList.add('visible');
  renderHistory();
});
btnCloseHistory.addEventListener('click', () => {
  historyPanel.classList.remove('visible');
});
btnClearHistory.addEventListener('click', () => {
  history = [];
  localStorage.removeItem('calc-history');
  renderHistory();
});
function loadHistory() {
  const savedHistory = localStorage.getItem('calc-history');
  if (savedHistory) {
    try {
      history = JSON.parse(savedHistory);
    } catch (e) {
      history = [];
    }
  }
}
function saveHistory(expr, result) {
  // Prevent duplicate consecutive entries
  if (history.length > 0 && history[0].expr === expr && history[0].result === result) {
    return;
  }
  
  history.unshift({ expr, result, id: Date.now() });
  if (history.length > 50) history.pop(); // limit to 50 items
  localStorage.setItem('calc-history', JSON.stringify(history));
}
function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-history">No history yet</div>';
    return;
  }
  historyList.innerHTML = '';
  history.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.classList.add('history-item');
    // Stagger animation delays for sleek item reveal
    itemEl.style.animationDelay = `${index * 0.05}s`;
    
    itemEl.innerHTML = `
      <div class="history-item-expr">${escapeHtml(item.expr)}</div>
      <div class="history-item-result">${escapeHtml(item.result)}</div>
    `;
    
    itemEl.addEventListener('click', () => {
      // Load this history result back to calculator
      calculator.displayValue = item.result;
      calculator.firstOperand = parseFloat(item.result);
      calculator.waitingForSecondOperand = true;
      calculator.operator = null;
      calculator.formula = item.expr;
      
      updateDisplay();
      animateDisplay('eval');
      historyPanel.classList.remove('visible');
    });
    
    historyList.appendChild(itemEl);
  });
}
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
/* --- Display Updates & Animations --- */
function updateDisplay() {
  // Format long display values
  let val = calculator.displayValue;
  
  // Format numbers nicely with thousand separators if they aren't commands/errors
  if (!isNaN(val) && val !== '' && !val.includes('e')) {
    const parts = val.split('.');
    parts[0] = parseFloat(parts[0]).toLocaleString('en-US', { maximumFractionDigits: 0 });
    val = parts.join('.');
  }
  
  displayMain.textContent = val;
  
  // Adjust font size dynamically to avoid overflowing display
  if (val.length > 14) {
    displayMain.style.fontSize = '1.8rem';
  } else if (val.length > 10) {
    displayMain.style.fontSize = '2.2rem';
  } else {
    displayMain.style.fontSize = '2.8rem';
  }
  // Display formula screen
  displayFormula.textContent = calculator.formula;
}
// Animate main screen digit entries or operations
function animateDisplay(type) {
  if (type === 'digit') {
    displayMain.classList.add('digit-press');
    setTimeout(() => displayMain.classList.remove('digit-press'), 120);
  } else if (type === 'eval') {
    displayMain.classList.add('animate-eval');
    setTimeout(() => displayMain.classList.remove('animate-eval'), 400);
  }
}
/* --- Calculator Operations Logic --- */
function inputDigit(digit) {
  const { displayValue, waitingForSecondOperand } = calculator;
  if (waitingForSecondOperand) {
    calculator.displayValue = digit;
    calculator.waitingForSecondOperand = false;
  } else {
    // Prevent multiple leading zeros or overflow
    if (displayValue === '0') {
      calculator.displayValue = digit;
    } else {
      if (displayValue.replace(/[\D]/g, '').length < 15) { // Max digits check
        calculator.displayValue = displayValue + digit;
      }
    }
  }
  
  animateDisplay('digit');
  updateDisplay();
}
function inputDecimal() {
  if (calculator.waitingForSecondOperand) {
    calculator.displayValue = '0.';
    calculator.waitingForSecondOperand = false;
    updateDisplay();
    return;
  }
  // If display value doesn't contain a decimal, add one
  if (!calculator.displayValue.includes('.')) {
    calculator.displayValue += '.';
  }
  
  animateDisplay('digit');
  updateDisplay();
}
function handleOperator(nextOperator) {
  const { firstOperand, displayValue, operator } = calculator;
  const inputValue = parseFloat(displayValue);
  // Clear any existing highlighting
  clearActiveOperatorStyles();
  if (operator && calculator.waitingForSecondOperand) {
    // If operator is changed before typing second operand
    calculator.operator = nextOperator;
    calculator.formula = `${formatOperandDisplay(firstOperand)} ${getOperatorSymbol(nextOperator)}`;
    highlightOperator(nextOperator);
    updateDisplay();
    return;
  }
  if (firstOperand === null && !isNaN(inputValue)) {
    calculator.firstOperand = inputValue;
  } else if (operator) {
    const result = performCalculation(firstOperand, inputValue, operator);
    const formattedResult = formatResult(result);
    
    // Save to history automatically in background if full sub-equation evaluates
    if (result !== null && !isNaN(result)) {
      const stepExpr = `${formatOperandDisplay(firstOperand)} ${getOperatorSymbol(operator)} ${formatOperandDisplay(inputValue)}`;
      saveHistory(stepExpr, formattedResult);
    }
    
    calculator.displayValue = formattedResult;
    calculator.firstOperand = result;
  }
  calculator.waitingForSecondOperand = true;
  calculator.operator = nextOperator;
  calculator.formula = `${formatOperandDisplay(calculator.firstOperand)} ${getOperatorSymbol(nextOperator)}`;
  highlightOperator(nextOperator);
  updateDisplay();
}
function performCalculation(first, second, op) {
  if (op === '+') return first + second;
  if (op === '-') return first - second;
  if (op === '*') return first * second;
  if (op === '/') {
    if (second === 0) return NaN; // handle division by zero
    return first / second;
  }
  return second;
}
function formatResult(value) {
  if (isNaN(value)) return 'Error';
  if (!isFinite(value)) return 'Error';
  
  // Format math precision to avoid floating point issues (e.g. 0.1 + 0.2)
  let str = value.toString();
  if (str.includes('e')) {
    // Convert highly scientific notation to safe precision limits
    const num = Number(value);
    if (Math.abs(num) < 1e-12) return '0';
    return parseFloat(num.toPrecision(10)).toString();
  }
  
  if (str.includes('.')) {
    // Round to 10 decimal places to prevent decimal leak, and parse float to strip trailing zeros
    return parseFloat(value.toFixed(10)).toString();
  }
  return str;
}
function formatOperandDisplay(num) {
  if (num === null || isNaN(num)) return '';
  return formatResult(num);
}
function getOperatorSymbol(op) {
  if (op === '*') return '×';
  if (op === '/') return '÷';
  if (op === '-') return '−';
  return op;
}
function calculate() {
  let { firstOperand, displayValue, operator } = calculator;
  const inputValue = parseFloat(displayValue);
  if (operator === null) {
    return;
  }
  if (calculator.waitingForSecondOperand) {
    // If waiting for second operand but user hits '='
    calculator.firstOperand = inputValue;
  }
  const result = performCalculation(firstOperand, inputValue, operator);
  const formattedResult = formatResult(result);
  
  const finalFormula = `${formatOperandDisplay(firstOperand)} ${getOperatorSymbol(operator)} ${formatOperandDisplay(inputValue)} =`;
  calculator.formula = finalFormula;
  calculator.displayValue = formattedResult;
  
  // Save calculation to history
  if (formattedResult !== 'Error') {
    saveHistory(finalFormula.replace('=', ''), formattedResult);
  }
  
  calculator.firstOperand = null;
  calculator.operator = null;
  calculator.waitingForSecondOperand = true;
  clearActiveOperatorStyles();
  animateDisplay('eval');
  updateDisplay();
}
function clear() {
  calculator.displayValue = '0';
  calculator.firstOperand = null;
  calculator.waitingForSecondOperand = false;
  calculator.operator = null;
  calculator.formula = '';
  
  clearActiveOperatorStyles();
  animateDisplay('digit');
  updateDisplay();
}
function backspace() {
  if (calculator.waitingForSecondOperand) {
    // Don't allow delete if we just finished an evaluation or operator selection
    return;
  }
  
  const { displayValue } = calculator;
  if (displayValue.length > 1) {
    calculator.displayValue = displayValue.slice(0, -1);
  } else {
    calculator.displayValue = '0';
  }
  animateDisplay('digit');
  updateDisplay();
}
function percent() {
  const currentValue = parseFloat(calculator.displayValue);
  if (isNaN(currentValue)) return;
  
  const result = currentValue / 100;
  calculator.displayValue = formatResult(result);
  
  if (calculator.waitingForSecondOperand) {
    calculator.firstOperand = result;
  }
  
  animateDisplay('digit');
  updateDisplay();
}
function toggleSign() {
  const currentValue = parseFloat(calculator.displayValue);
  if (isNaN(currentValue)) return;
  const result = currentValue * -1;
  calculator.displayValue = formatResult(result);
  
  if (calculator.waitingForSecondOperand) {
    calculator.firstOperand = result;
  }
  animateDisplay('digit');
  updateDisplay();
}
/* --- Keyboard & Click Highlighting Helpers --- */
// Visual feedback for active operators
function highlightOperator(op) {
  const keys = document.querySelectorAll('.btn-operator');
  keys.forEach(key => {
    if (key.getAttribute('data-operator') === op) {
      key.classList.add('op-active');
    } else {
      key.classList.remove('op-active');
    }
  });
}
function clearActiveOperatorStyles() {
  const keys = document.querySelectorAll('.btn-operator');
  keys.forEach(key => key.classList.remove('op-active'));
}
// Click events binding
keypad.addEventListener('click', (event) => {
  const { target } = event;
  if (!target.classList.contains('key') && !target.closest('.key')) {
    return;
  }
  
  // Resolve actual button if SVG click triggered
  const button = target.classList.contains('key') ? target : target.closest('.key');
  const action = button.getAttribute('data-action');
  const operator = button.getAttribute('data-operator');
  const val = button.getAttribute('data-val');
  if (val !== null) {
    if (val === '.') {
      inputDecimal();
    } else {
      inputDigit(val);
    }
    return;
  }
  if (operator !== null) {
    handleOperator(operator);
    return;
  }
  if (action !== null) {
    switch (action) {
      case 'clear':
        clear();
        break;
      case 'backspace':
        backspace();
        break;
      case 'percent':
        percent();
        break;
      case 'toggle-sign':
        toggleSign();
        break;
      case 'calculate':
        calculate();
        break;
    }
  }
});
// Setup Physical Keyboard Support
function setupKeyboardSupport() {
  document.addEventListener('keydown', (event) => {
    const key = event.key;
    
    // Prevent standard browser search or screen shortcuts on key inputs
    if (['/', '*', '-', '+', '%', 'Enter', 'Backspace', 'Escape'].includes(key)) {
      event.preventDefault();
    }
    // Number keys
    if (/[0-9]/.test(key)) {
      inputDigit(key);
      triggerButtonActiveState(key, 'val');
    }
    // Dot
    else if (key === '.' || key === ',') {
      inputDecimal();
      triggerButtonActiveState('.', 'val');
    }
    // Operators
    else if (['+', '-', '*', '/'].includes(key)) {
      handleOperator(key);
      triggerButtonActiveState(key, 'operator');
    }
    // Equals / Enter
    else if (key === 'Enter' || key === '=') {
      calculate();
      triggerButtonActiveState('calculate', 'action');
    }
    // Escape or C
    else if (key === 'Escape' || key.toLowerCase() === 'c') {
      clear();
      triggerButtonActiveState('clear', 'action');
    }
    // Backspace
    else if (key === 'Backspace') {
      backspace();
      triggerButtonActiveState('backspace', 'action');
    }
    // Percent
    else if (key === '%') {
      percent();
      triggerButtonActiveState('percent', 'action');
    }
  });
}
// Temporary css active class simulation for keyboard presses
function triggerButtonActiveState(value, type) {
  let query = '';
  if (type === 'val') {
    query = `.key[data-val="${value}"]`;
  } else if (type === 'operator') {
    query = `.key[data-operator="${value}"]`;
  } else if (type === 'action') {
    query = `.key[data-action="${value}"]`;
  }
  
  const button = document.querySelector(query);
  if (button) {
    button.classList.add('kbd-active');
    button.click(); // programmatically trigger click ripple effect and execution
    setTimeout(() => {
      button.classList.remove('kbd-active');
    }, 100);
  }
}
