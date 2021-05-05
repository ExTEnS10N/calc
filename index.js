'use strict';

const currentEL = document.getElementById('current');
const currentExp = document.querySelector('#current .expression');
const historyEl = document.getElementById('history');
const currentRes = document.querySelector('#current .result');
const buttons = document.querySelectorAll('.keyboard td');
const clearBtn = document.getElementById('btn-clear');
const scrollView = document.querySelector('.history-scroll');

const Seperator = (() => {
  /** @type {{ type: string, value: string }[]} */
  const locale_parts = new Intl.NumberFormat().formatToParts(9999.999);
  const _group = locale_parts.find(p => p.type === 'group');
  const _decimal = locale_parts.find(p => p.type === 'decimal');
  document.querySelector('.keyboard .decimal').textContent = _decimal.value;
  return Object.freeze({
    group: _group.value,
    decimal: _decimal.value
  })
})()

const Operator = Object.freeze({
  ADD: '+',
  MINUS: '−',
  MULTIPLY: '×',
  DIVIDE: '÷',
});
const maxFractionLength = 21;
const ERROR = '错误：';

function isOperator(op) {
  return op === Operator.ADD || op === Operator.MINUS || op === Operator.MULTIPLY || op === Operator.DIVIDE
}

function easeInOutQuad(currentTime, startValue, changeValue, duration) {
  currentTime /= duration / 2;
  if (currentTime < 1) return changeValue / 2 * currentTime * currentTime + startValue;
  currentTime--;
  return -changeValue / 2 * (currentTime * (currentTime - 2) - 1) + startValue;
}

function scroll(top) {
  const start = scrollView.scrollTop;
  const length = top - start;
  const startTime = new Date().getTime();
  const _scroll = () => {
    const now = new Date().getTime() - startTime;
    const newTop = easeInOutQuad(now, start, length, 250);
    scrollView.scrollTop = newTop;
    if (now < 250) {
      requestAnimationFrame(_scroll);
    }
  }
  requestAnimationFrame(_scroll);
}

for (let i = 0; i < buttons.length; ++i) {
  buttons[i].addEventListener('click', function () {
    input(this.textContent);
  })
}
const currentExpObserver = new MutationObserver(() => {
  if (currentExp.textContent.length === 0 && !currentEL.classList.contains('empty')) {
    currentEL.classList.add('empty');
  }
  else if (currentEL.classList.contains('empty')) {
    requestAnimationFrame(() => {
      scroll(scrollView.scrollTop + currentEL.clientHeight);
    })
    currentEL.classList.remove('empty');
  }
});
currentExpObserver.observe(currentExp, { characterData: true, childList: true });

/** @type {string[]} */
let exp = [];
/** @type {{exp: string, result: string}[]} */
let historyList = [];

(() => {
  const his = localStorage.getItem('history');
  if (his == null) { return; }
  historyList = JSON.parse(his);
  if (historyList.length === 0) { return; }
  const fragment = document.createDocumentFragment();
  for (let history of historyList) {
    fragment.appendChild(createRow(history.exp, history.result));
  }
  historyEl.appendChild(fragment);
  setTimeout(() => {
    scrollView.scrollTop = scrollView.scrollHeight;
  }, 100);
})()

/**
 * @param {string} char 
 */
function input(char) {
  switch (char) {
    case 'AC':
      historyEl.innerHTML = '';
      historyList = [];
      localStorage.setItem('history', JSON.stringify(historyList));
    case 'C':
      scroll(scrollView.scrollTop - currentEL.clientHeight);
      currentExp.innerHTML = '';
      currentRes.innerHTML = '0';
      clearBtn.textContent = 'AC';
      exp = [];
      break;
    case '⌫':
      let last = exp.pop();
      last = last.substring(0, last.length - 1);
      if (last.length > 0) {
        exp.push(last);
      }
      currentExp.textContent = formatExp();
      if (exp.length > 0) {
        estimate();
      }
      break;
    case '=':
      if (!currentRes.classList.contains('estimate')) { break; }
      let res = calc();
      currentRes.textContent = formatResult(res);
      currentRes.classList.remove('estimate');
      if (!res.startsWith(ERROR)) {
        currentRes.classList.remove('error');
        historyList.push({ exp: currentExp.textContent, result: currentRes.textContent });
        localStorage.setItem('history', JSON.stringify(historyList));
        historyEl.appendChild(createRow(currentExp.textContent, currentRes.textContent));
        input('C');
      }
      else {
        currentRes.classList.add('error');
      }
      scroll(scrollView.scrollHeight);
      break;
    case Operator.ADD: case Operator.MINUS: case Operator.MULTIPLY: case Operator.DIVIDE:
      addOperator(char);
      break;
    case '%':
      if (exp.length === 0) {
        const lastRes = getLastResult();
        if (lastRes == null) { break; }
        exp.push(lastRes);
      }
      addPercent();
      currentExp.textContent = formatExp();
      estimate();
      break;
    default:
      addNumber(char);
      estimate();
      clearBtn.textContent = 'C';
      break;
  }
}

function createRow(expression, result) {
  const row = document.createElement('div');
  row.classList.add('calc-row');
  row.innerHTML = `
    <div class="expression">${expression}</div>
    <div class="result">${result}</div>
  `;
  return row;
}

function getLastResult() {
  const resEl = document.querySelector('#history>.calc-row:last-child>.result');
  if (resEl == null) { return null; }
  return resEl.textContent.substring(1).replace(new RegExp(Seperator.group, 'g'), '');
}

function addPercent() {
  let last = exp[exp.length - 1];
  if (isOperator(last)) { return; }
  last = [...last];
  if (isZero(last)) { return; }
  let dot = last.indexOf(Seperator.decimal);
  if (dot >= 0) {
    last.splice(dot, 1);
  }
  else { dot = last.length; }
  dot -= 2;

  if (dot < 0) {
    last.unshift(new Array(Math.abs(dot)).fill('0'));
    last.unshift('0', Seperator.decimal);
  }
  else if (dot === 0) {
    last.unshift('0', Seperator.decimal);
  }
  else {
    last.splice(dot, 0, Seperator.decimal);
  }
  exp[exp.length - 1] = last.join('');
}

function addNumber(num) {
  const last = exp[exp.length - 1];
  if (/[0-9]+/.test(last) || last === Seperator.decimal) {
    if (last === '0') {
      if (num === '0') { return; }
      if (num != Seperator.decimal) {
        exp[exp.length - 1] = ''
      }
    }
    if (num === Seperator.decimal && last.indexOf(Seperator.decimal) >= 0) { return; }

    exp[exp.length - 1] += num;
  }
  else {
    if (num === Seperator.decimal) {
      num = '0' + num;
    }
    exp.push(num);
  }
  currentExp.textContent = formatExp();
}

function addOperator(op) {
  if (exp.length === 0 && op !== Operator.MINUS) {
    return;
  }
  if (isOperator(exp[exp.length - 1])) {
    if (op === Operator.MINUS && (exp[exp.length - 1] === Operator.MULTIPLY || exp[exp.length - 1] === Operator.DIVIDE)) {

    }
    else {
      exp.pop();
    }
  }
  if (exp.length === 0 && op === Operator.ADD) { return; }
  if (exp[exp.length - 1] != null && !isOperator(exp[exp.length - 1])) {
    exp[exp.length - 1] = trimZero([...exp[exp.length - 1]]).join('');
  }
  exp.push(op);
  currentExp.textContent = formatExp();
}

function formatExp() {
  const arr = [];
  for (let e of exp) {
    arr.push(isOperator(e) ? e : formatNumber(e));
  }
  return arr.join('');
}

function formatNumber(num) {
  const parts = num.split(Seperator.decimal);
  parts[0] = parts[0].replace(/(\d)(?=(?:\d{3})+$)/g, '$1' + Seperator.group);
  return parts.join(Seperator.decimal);
}

function calc(estimate = false) {
  const _exp = exp.slice();
  if (_exp[0] === Operator.MINUS) {
    if (_exp.length === 1 || isZero([..._exp[1]])) {
      return '0';
    }
    _exp[1] = Operator.MINUS + _exp[1];
    _exp.shift();
  }
  // 先乘除
  for (let i = 0; i < _exp.length; ++i) {
    if (_exp[i] !== Operator.MULTIPLY && _exp[i] !== Operator.DIVIDE) {
      continue;
    }
    if (_exp[i + 1] === Operator.MINUS) {
      _exp[i + 1] = Operator.MINUS + _exp[i + 2];
      _exp.splice(i + 2, 1);
    }
    let res = operate(_exp[i - 1], _exp[i], _exp[i + 1], estimate);
    if (res.startsWith(ERROR)) {
      return res;
    }
    _exp.splice(i - 1, 3, res);
    --i;
  }

  //后加减
  for (let i = 0; i < _exp.length; ++i) {
    if (_exp[i] !== Operator.ADD && _exp[i] !== Operator.MINUS) {
      continue;
    }
    let res = operate(_exp[i - 1], _exp[i], _exp[i + 1], estimate);
    if (res.startsWith(ERROR)) {
      return res;
    }
    _exp.splice(i - 1, 3, res);
    --i;
  }
  return _exp[0];
}

function formatResult(res) {
  return '=' + formatNumber(res);
}

function operate(left, op, right, estimate = false) {
  switch (op) {
    case Operator.ADD:
      return plus(left, right, estimate);
    case Operator.MINUS:
      return substract(left, right, estimate);
    case Operator.MULTIPLY:
      return multiply(left, right, estimate);
    case Operator.DIVIDE:
      return divide(left, right, estimate);
  }
}

function divide(left, right, estimate) {
  if (right == null || right === Operator.MINUS + undefined) {
    if (estimate) { right = '0'; }
    else { return ERROR + `请输入${Operator.DIVIDE}右侧的数字`; }
  }

  let l = (left instanceof Array) ? left : [...left];
  let r = (right instanceof Array) ? right : trimZero([...right]);

  let result = [];
  const isLeftNegative = l[0] === Operator.MINUS;
  const isRightNegative = r[0] === Operator.MINUS;

  if (isLeftNegative) { l.shift(); }
  if (isRightNegative) { r.shift(); }

  if (r.length === 1) {
    if (r[0] === '1') {
      result.push(...l);
    }
  }

  if (isZero(r)) {
    return ERROR + '不能除以0';
  }

  if (result.length === 0) {
    const dotL = l.indexOf(Seperator.decimal);
    const dotR = r.indexOf(Seperator.decimal);
    const fractionL = dotL >= 0 ? l.length - dotL - 1 : 0;
    const fractionR = dotR >= 0 ? r.length - dotR - 1 : 0;

    if (dotR >= 0) {
      if (dotL >= 0) {
        l.splice(dotL, 1);
      }
      r.splice(dotR, 1);
      if (fractionL > fractionR) {
        l.splice(dotL + fractionL - fractionR, 0, Seperator.decimal);
      }
      else if (fractionL < fractionR) {
        l.push(...new Array(fractionR - fractionL).fill('0'));
      }
    }

    trimZero(r);
    trimZero(l);

    let divisor = l.splice(0, r.length);
    let hasFraction = false;
    let fractionLength = 0;
    while (divisor.length > 0 && fractionLength <= maxFractionLength) {
      const distance = compare(divisor, r);
      if (distance < 0) {
        result.push('0');
      }
      else if (distance === 0) {
        result.push('1');
        divisor = [];
      }
      else {
        let res = 0;
        let substractor = divisor;
        while (compare(substractor, r) >= 0) {
          substractor = substract(substractor, r.slice(), estimate);
          res++;
        }
        result.push(res + '');
        if (substractor.length === 1 && substractor[0] === '0') {
          divisor = [];
        }
        else {
          divisor = substractor;
        }
      }

      if (hasFraction) { fractionLength++; }

      if (divisor.length === 1 && divisor[0] === '0') {
        divisor = [];
      }

      if (l.length > 0) {
        divisor.push(l.shift());
      }
      else if (divisor.length > 0) {
        if (fractionLength === 0) {
          result.push(Seperator.decimal);
          hasFraction = true;
        }
        divisor.push('0');
      }
    }
    if (fractionLength > maxFractionLength) {
      const last = result.pop();
      if (Number(last) >= 5) {
        result = plus(result, ['0', Seperator.decimal, ...new Array(20).fill('0'), '1'], estimate);
      }
    }
  }



  if ((isLeftNegative || isRightNegative) && !(isLeftNegative && isRightNegative)) {
    result.unshift(Operator.MINUS);
  }
  trimZero(result);
  return (left instanceof Array) ? result : result.join('');
}

function isZero(arr) {
  arr = arr.slice();
  trimZero(arr);
  return arr.length === 1 && arr[0] === '0';
}

/**
 * 
 * @param {string[]|string} left 
 * @param {string[]|string} right 
 * @returns 
 */
function multiply(left, right, estimate) {
  if (right == null || right === Operator.MINUS + undefined) {
    if (estimate) { right = '0'; }
    else { return ERROR + `请输入${Operator.MULTIPLY}右侧的数字`; }
  }

  let l = (left instanceof Array) ? left : [...left];
  let r = (right instanceof Array) ? right : trimZero([...right]);

  if (l.length === 1) {
    if (l[0] === '0') { return (left instanceof Array) ? ['0'] : '0' }
    if (l[0] === '1') { return (left instanceof Array) ? r.slice() : r.join('') }
  }
  if (r.length === 1) {
    if (r[0] === '0') { return (left instanceof Array) ? ['0'] : '0' }
    if (r[0] === '1') { return (left instanceof Array) ? l.slice() : l.join('') }
  }
  const dotL = l.indexOf(Seperator.decimal);
  const dotR = r.indexOf(Seperator.decimal);
  const fractionL = dotL >= 0 ? l.length - dotL - 1 : 0;
  const fractionR = dotR >= 0 ? r.length - dotR - 1 : 0;
  const fractionLength = fractionL + fractionR;

  if (dotL >= 0) {
    l.splice(dotL, 1);
  }
  if (dotR >= 0) {
    r.splice(dotR, 1);
  }
  const result = [];
  const products = [];

  const isLeftNegative = l[0] === Operator.MINUS;
  const isRightNegative = r[0] === Operator.MINUS;

  if (isLeftNegative) { l.shift(); }
  if (isRightNegative) { r.shift(); }

  while (r.length > 0) {
    const r1 = r.pop();
    let carry = 0;
    const _products = [];
    for (let i = l.length - 1; i >= 0; --i) {
      const l1 = l[i];
      let product = Number(l1) * Number(r1) + carry;
      if (product > 10) {
        const p = product + '';
        carry = Number(p.substring(0, p.length - 1));
        product = Number(p.substring(p.length - 1));
      }
      else {
        carry = 0;
      }
      _products.unshift(product + '');
    }
    if (carry !== 0) {
      _products.unshift(carry + '');
    }
    _products.push(...new Array(products.length).fill('0'));
    products.push(_products);
  }
  result.push(products.shift());
  while (products.length > 0) {
    result.push(plus(result.pop(), products.shift(), estimate));
  }
  result.push(...result.pop());
  if (fractionLength > 0) {
    if (result.length <= fractionLength) {
      result.unshift(...new Array(fractionLength - result.length + 1).fill('0'));
    }
    result.splice(result.length - fractionLength, 0, Seperator.decimal);
  }
  if ((isLeftNegative || isRightNegative) && !(isLeftNegative && isRightNegative)) {
    result.unshift(Operator.MINUS);
  }
  trimZero(result);
  return (left instanceof Array) ? result : result.join('');
}

function substract(left, right, estimate) {
  if (right == null) {
    if (estimate) { right = '0'; }
    else { return ERROR + '请输入-右侧的数字'; }
  }
  // return (Number(left) - Number(right)) + '';
  let l = (left instanceof Array) ? left : [...left];
  let r = (right instanceof Array) ? right : trimZero([...right]);
  fractionAlign(l, r);

  const result = [];
  const isLeftNegative = l[0] === Operator.MINUS;
  const isRightNegative = r[0] === Operator.MINUS;
  if (isLeftNegative) {
    if (!isRightNegative) { r.unshift(Operator.MINUS); }
    return plus(l, r, estimate).join('');
  }
  let hasSwap = false;
  let compareRes = compare(l, r)
  if (compareRes < 0) {
    hasSwap = true;
    const tmp = l;
    l = r;
    r = tmp;
  }
  else if (compareRes === 0) {
    return (left instanceof Array) ? ['0'] : '0';
  }

  while (l.length > 0 || r.length > 0) {
    const l1 = l.length > 0 ? l.pop() : 0;
    const r1 = r.length > 0 ? r.pop() : 0;
    if (l1 === Seperator.decimal) { result.unshift(Seperator.decimal); continue; }
    let res = Number(l1) - Number(r1);
    if (res < 0) {
      for (let i = l.length - 1; i >= 0; --i) {
        const prev = l[i];
        if (prev === Seperator.decimal) { continue; }
        if (prev !== '0') {
          res += 10;
          l[i] = (Number(prev) - 1) + '';
          break;
        }
        l[i] = '9';
      }
    }
    result.unshift(res + '');
  }
  if (hasSwap) { result.unshift(Operator.MINUS); }
  trimZero(result);
  return (left instanceof Array) ? result : result.join('');
}

/**
 * 
 * @param {string[]} l 
 * @param {string[]} r 
 */
function compare(l, r) {
  let dotL = l.indexOf(Seperator.decimal);
  let dotR = r.indexOf(Seperator.decimal);
  if (dotL < 0) { dotL = l.length; }
  if (dotR < 0) { dotR = r.length; }
  if (dotL < dotR) { return -1; }
  else if (dotL > dotR) { return 1; }
  for (let i = 0; i < l.length; ++i) {
    if (l[i] !== r[i]) {
      return Number(l[i]) - Number(r[i]);
    }
  }
  return 0;
}

/**
 * @param {string} left 
 * @param {string} right 
 */
function plus(left, right, estimate) {
  if (right == null) {
    if (estimate) { right = '0'; }
    else { return ERROR + '请输入+右侧的数字'; }
  }
  // return (Number(left) + Number(right)) + '';
  let l = (left instanceof Array) ? left : [...left];
  let r = (right instanceof Array) ? right : trimZero([...right]);

  fractionAlign(l, r);

  let carry = 0;
  const result = [];
  const isLeftNegative = l[0] === Operator.MINUS;
  const isRightNegative = r[0] === Operator.MINUS;
  if (isLeftNegative && !isRightNegative) {
    return substract(right, left, estimate).join('');
  }
  if (isLeftNegative) { l.shift(); }
  if (isRightNegative) { r.shift(); }

  while (l.length > 0 || r.length > 0) {
    const l1 = l.length > 0 ? l.pop() : 0;
    const r1 = r.length > 0 ? r.pop() : 0;
    if (l1 === Seperator.decimal) { result.unshift(Seperator.decimal); continue; }
    let res = Number(l1) + Number(r1) + carry;
    if (res >= 10) {
      carry = 1;
      res -= 10;
    }
    else {
      carry = 0;
    }
    result.unshift(...(res + ''));
  }
  if (carry !== 0) {
    result.unshift(carry + '');
  }
  if (isLeftNegative && isRightNegative) {
    result.unshift(Operator.MINUS);
  }
  trimZero(result);
  return (left instanceof Array) ? result : result.join('');
}

function debounce(fn, interval, immediate = false) {
  let timer, handler;
  return function (...args) {
    let _this = this;
    if (timer == null) {
      let ontimeout = () => {
        if (handler != null) {
          handler();
          handler = null;
          timer = setTimeout(ontimeout, interval);
        } else {
          timer = null;
        }
      };
      timer = setTimeout(ontimeout, interval);
      if (immediate) {
        fn.apply(_this, args);
      } else {
        handler = () => {
          fn.apply(_this, args);
        };
      }
    } else {
      handler = () => {
        fn.apply(_this, args);
      };
    }
  };
}

const estimate = debounce(function () {
  const res = calc(true);

  if (res.startsWith(ERROR)) {
    currentRes.textContent = res;
    currentRes.classList.add('error');
  }
  else {
    currentRes.textContent = formatResult(res);
    currentRes.classList.remove('error');
  }
  currentRes.classList.add('estimate');
}, 125, true);

/**
 * 
 * @param {string[]} l 
 * @param {string[]} r 
 */
function fractionAlign(l, r) {
  const dotL = l.indexOf(Seperator.decimal);
  const dotR = r.indexOf(Seperator.decimal);
  if (dotL >= 0 || dotR >= 0) {
    const fractionL = dotL >= 0 ? l.length - dotL - 1 : 0;
    const fractionR = dotR >= 0 ? r.length - dotR - 1 : 0;

    const distance = fractionL - fractionR;
    let fractionLength = distance > 0 ? fractionL : fractionR;
    if (distance < 0) {
      fractionPadding(l, fractionLength);
    }
    else if (distance > 0) {
      fractionPadding(r, fractionLength);
    }
  }
}

/**
 * @param {string[]} arr 
 * @param {number} length 小数部分的总长度（不含小数点）
 * @returns 
 */
function fractionPadding(arr, length) {
  if (arr.length === 0) {
    arr.push('0');
    return arr;
  }
  let dotIndex = arr.indexOf(Seperator.decimal);
  if (dotIndex < 0) { dotIndex = arr.length; arr.push(Seperator.decimal); }
  while (arr.length - dotIndex - 1 < length) {
    arr.push('0');
  }
  return arr;
}

function trimZero(arr) {
  const isNegative = arr[0] === Operator.MINUS;
  if (isNegative) { arr.shift(); }
  let dotIndex = arr.indexOf(Seperator.decimal);
  if (dotIndex < 0) { dotIndex = arr.length; }
  for (let i = 0; i < dotIndex; ++i) {
    if (!/[0-9]/.test(arr[i])) {
      continue;
    }
    if (arr[i] === '0' && i + 1 < dotIndex && arr[i + 1] !== Seperator.decimal) { arr.splice(i, 1); i--; dotIndex--; }
    else { break; }
  }
  for (let i = arr.length - 1; i >= dotIndex; --i) {
    if (arr[i] !== '0') {
      if (arr[i] === Seperator.decimal) { arr.splice(i, 1); }
      break;
    }
    arr.splice(i, 1);
  }
  if (arr.length === 3 && arr[0] === '0' && arr[1] === Seperator.decimal && arr[2] === '0') {
    arr.splice(1, 2);
  }
  if (arr.length === 1 && arr[0] === '0') {
    return arr;
  }
  if (isNegative) {
    arr.unshift(Operator.MINUS);
  }
  return arr;
}