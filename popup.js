// 网页填写助手 - 弹出窗口脚本

class FormFillerPopup {
  constructor() {
    this.dataInput = document.getElementById('dataInput');
    this.scanBtn = document.getElementById('scanBtn');
    this.fillBtn = document.getElementById('fillBtn');
    this.statusText = document.getElementById('statusText');
    this.fieldList = document.getElementById('fieldList');
    this.fieldItems = document.getElementById('fieldItems');
    this.scannedFieldList = document.getElementById('scannedFieldList');
    this.scannedFieldItems = document.getElementById('scannedFieldItems');

    this.parsedData = {};
    this.formFields = [];

    this.init();
  }

  init() {
    this.scanBtn.addEventListener('click', () => this.scanForm());
    this.fillBtn.addEventListener('click', () => this.fillForm());
    this.dataInput.addEventListener('input', () => this.parseInput());

    // 加载保存的数据
    this.loadSavedData();
  }

  // 解析输入数据
  parseInput() {
    const input = this.dataInput.value.trim();
    if (!input) {
      this.parsedData = {};
      this.hideFieldList();
      return;
    }

    try {
      // 尝试解析 JSON
      this.parsedData = JSON.parse(input);
      this.showParsedFields();
    } catch (e) {
      // 解析 "键: 值" 格式
      this.parsedData = this.parseKeyValueFormat(input);
      this.showParsedFields();
    }
  }

  // 解析键值对格式
  parseKeyValueFormat(input) {
    const data = {};
    const lines = input.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 支持多种分隔符：: ：= -
      const match = trimmed.match(/^([^:=\-：]+)[:=\-：]\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value) {
          data[key] = value;
        }
      }
    }

    return data;
  }

  // 显示已解析的字段
  showParsedFields() {
    const keys = Object.keys(this.parsedData);
    if (keys.length === 0) {
      this.hideFieldList();
      return;
    }

    this.fieldItems.innerHTML = keys.map(key => `
      <div class="field-item">
        <span class="field-name">${this.escapeHtml(key)}</span>
        <span class="field-value" title="${this.escapeHtml(this.parsedData[key])}">
          ${this.escapeHtml(this.parsedData[key])}
        </span>
      </div>
    `).join('');

    this.fieldList.classList.remove('hidden');
  }

  hideFieldList() {
    this.fieldList.classList.add('hidden');
  }

  // 显示扫描到的表单字段
  showScannedFields() {
    if (this.formFields.length === 0) {
      this.hideScannedFields();
      return;
    }

    this.scannedFieldItems.innerHTML = this.formFields.map(field => {
      // 获取最佳显示名称
      const displayName = field.labels[0] ||
                         field.placeholder ||
                         field.name ||
                         field.id ||
                         `字段 ${field.index + 1}`;

      // 获取标识符信息
      const identifiers = [];
      if (field.name) identifiers.push(`name="${field.name}"`);
      if (field.id) identifiers.push(`id="${field.id}"`);

      // 获取标签文本
      const labelsText = field.labels.length > 0
        ? field.labels.join(', ')
        : '';

      return `
        <div class="scanned-field-item">
          <div class="scanned-field-header">
            <span class="scanned-field-name">${this.escapeHtml(displayName)}</span>
            <span class="scanned-field-type">${field.type}</span>
          </div>
          ${identifiers.length > 0 ? `<div class="scanned-field-id">${this.escapeHtml(identifiers.join(', '))}</div>` : ''}
          ${labelsText ? `<div class="scanned-field-labels">标签: ${this.escapeHtml(labelsText)}</div>` : ''}
        </div>
      `;
    }).join('');

    this.scannedFieldList.classList.remove('hidden');
  }

  hideScannedFields() {
    this.scannedFieldList.classList.add('hidden');
  }

  // 扫描表单
  async scanForm() {
    this.setStatus('正在扫描网页表单...', 'normal');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanFormFields
      });

      this.formFields = results[0].result;
      const count = this.formFields.length;

      if (count > 0) {
        this.setStatus(`扫描完成！发现 ${count} 个可填充字段`, 'success');
        this.showScannedFields();
      } else {
        this.setStatus('未在页面上发现表单字段', 'error');
        this.hideScannedFields();
      }
    } catch (error) {
      this.setStatus(`扫描失败: ${error.message}`, 'error');
    }
  }

  // 填充表单
  async fillForm() {
    if (Object.keys(this.parsedData).length === 0) {
      this.setStatus('请先输入要填充的数据', 'error');
      return;
    }

    this.setStatus('正在填充表单...', 'normal');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillFormFields,
        args: [this.parsedData]
      });

      const result = results[0].result;

      if (result.success) {
        this.setStatus(
          `填充完成！成功: ${result.filled} 个, 跳过: ${result.skipped} 个`,
          'success'
        );
        // 保存数据供下次使用
        this.saveData();
      } else {
        this.setStatus(`填充失败: ${result.error}`, 'error');
      }
    } catch (error) {
      this.setStatus(`填充失败: ${error.message}`, 'error');
    }
  }

  // 设置状态文本
  setStatus(message, type) {
    this.statusText.textContent = message;
    this.statusText.className = 'status-content';
    if (type === 'success') {
      this.statusText.classList.add('success');
    } else if (type === 'error') {
      this.statusText.classList.add('error');
    }
  }

  // 保存数据到 storage
  async saveData() {
    try {
      await chrome.storage.local.set({
        lastData: this.dataInput.value,
        lastParsedData: this.parsedData
      });
    } catch (e) {
      console.error('保存数据失败:', e);
    }
  }

  // 加载保存的数据
  async loadSavedData() {
    try {
      const result = await chrome.storage.local.get(['lastData']);
      if (result.lastData) {
        this.dataInput.value = result.lastData;
        this.parseInput();
      }
    } catch (e) {
      console.error('加载数据失败:', e);
    }
  }

  // HTML 转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 在页面中执行的填充函数
function fillFormFields(data) {
  // 收集字段的所有标识符
  function collectFieldIdentifiers(input) {
    const identifiers = [];

    // 添加各种属性作为标识符
    if (input.name) identifiers.push(input.name);
    if (input.id) identifiers.push(input.id);
    if (input.placeholder) identifiers.push(input.placeholder);
    if (input.getAttribute('aria-label')) {
      identifiers.push(input.getAttribute('aria-label'));
    }

    // 获取 label 文本
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        identifiers.push(label.textContent.trim());
      }
    }

    // 检查父 label
    let parent = input.parentElement;
    while (parent && parent.tagName.toLowerCase() !== 'form') {
      if (parent.tagName.toLowerCase() === 'label') {
        identifiers.push(parent.textContent.trim());
        break;
      }
      parent = parent.parentElement;
    }

    // 获取 aria-labelledby
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        identifiers.push(labelElement.textContent.trim());
      }
    }

    return identifiers;
  }

  // 查找最佳匹配
  function findBestMatch(identifiers, dataKeys) {
    let bestMatch = null;
    let bestScore = 0;

    const SIMILARITY_THRESHOLD = 0.6;

    for (const identifier of identifiers) {
      if (!identifier) continue;

      const normalizedIdentifier = normalizeText(identifier);

      for (const key of dataKeys) {
        const normalizedKey = normalizeText(key);

        // 完全匹配
        if (normalizedIdentifier === normalizedKey) {
          return key;
        }

        // 包含匹配
        if (normalizedIdentifier.includes(normalizedKey) ||
            normalizedKey.includes(normalizedIdentifier)) {
          const score = 0.8;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = key;
          }
        }

        // 相似度匹配
        const similarity = calculateSimilarity(normalizedIdentifier, normalizedKey);
        if (similarity > bestScore && similarity >= SIMILARITY_THRESHOLD) {
          bestScore = similarity;
          bestMatch = key;
        }
      }
    }

    return bestMatch;
  }

  // 标准化文本
  function normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[_\-\s]+/g, '')
      .replace(/[.:：]/g, '')
      .trim();
  }

  // 计算字符串相似度 (Levenshtein 距离)
  function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = [];
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  // 填充输入值
  function fillInputValue(input, value) {
    const tagName = input.tagName.toLowerCase();
    const type = input.type || 'text';

    if (tagName === 'select') {
      // 处理下拉框
      const options = Array.from(input.options);
      const option = options.find(opt =>
        opt.text.trim() === value ||
        opt.value === value
      );

      if (option) {
        input.value = option.value;
        return true;
      }

      // 尝试模糊匹配
      const fuzzyOption = options.find(opt =>
        opt.text.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(opt.text.toLowerCase())
      );

      if (fuzzyOption) {
        input.value = fuzzyOption.value;
        return true;
      }

      return false;
    }

    if (type === 'radio') {
      // 处理单选框
      const radios = document.querySelectorAll(`input[name="${input.name}"]`);
      for (const radio of radios) {
        if (radio.value === value ||
            radio.nextElementSibling?.textContent.trim() === value) {
          radio.checked = true;
          return true;
        }
      }
      return false;
    }

    if (type === 'checkbox') {
      // 处理复选框
      const checkboxes = document.querySelectorAll(`input[name="${input.name}"]`);
      const values = value.split(/[,，]/).map(v => v.trim());

      for (const checkbox of checkboxes) {
        const label = checkbox.nextElementSibling?.textContent.trim() ||
                     checkbox.value;
        checkbox.checked = values.some(v =>
          label.includes(v) || v.includes(label)
        );
      }
      return true;
    }

    if (type === 'date') {
      // 处理日期
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        input.value = date.toISOString().split('T')[0];
        return true;
      }
      input.value = value;
      return true;
    }

    // 普通文本输入
    input.value = value;
    return true;
  }

  // 触发事件
  function triggerEvents(input) {
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      input.dispatchEvent(event);
    });
  }

  const result = {
    success: true,
    filled: 0,
    skipped: 0,
    error: null
  };

  try {
    const inputs = document.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
      // 跳过不可填充的字段
      if (input.type === 'hidden' ||
          input.type === 'submit' ||
          input.type === 'button' ||
          input.type === 'reset' ||
          input.type === 'image' ||
          input.disabled) {
        return;
      }

      // 获取字段的所有可能标识
      const identifiers = collectFieldIdentifiers(input);

      // 尝试匹配数据
      const matchedKey = findBestMatch(identifiers, Object.keys(data));

      if (matchedKey && data[matchedKey]) {
        const value = data[matchedKey];

        // 根据字段类型填充
        if (fillInputValue(input, value)) {
          result.filled++;

          // 触发 change 和 input 事件
          triggerEvents(input);
        } else {
          result.skipped++;
        }
      }
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 在页面中执行的扫描函数
function scanFormFields() {
  const fields = [];
  const inputs = document.querySelectorAll('input, textarea, select');

  inputs.forEach((input, index) => {
    // 跳过隐藏字段和按钮
    if (input.type === 'hidden' ||
        input.type === 'submit' ||
        input.type === 'button' ||
        input.type === 'reset' ||
        input.type === 'image' ||
        input.disabled) {
      return;
    }

    // 获取字段信息
    const fieldInfo = {
      index: index,
      tagName: input.tagName.toLowerCase(),
      type: input.type || 'text',
      name: input.name || '',
      id: input.id || '',
      placeholder: input.placeholder || '',
      labels: [],
      ariaLabel: input.getAttribute('aria-label') || '',
      ariaLabelledBy: input.getAttribute('aria-labelledby') || ''
    };

    // 获取关联的 label 文本
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        fieldInfo.labels.push(label.textContent.trim());
      }
    }

    // 检查父元素是否是 label
    let parent = input.parentElement;
    while (parent && parent.tagName.toLowerCase() !== 'form') {
      if (parent.tagName.toLowerCase() === 'label') {
        fieldInfo.labels.push(parent.textContent.trim());
        break;
      }
      parent = parent.parentElement;
    }

    // 获取 aria-labelledby 对应的文本
    if (fieldInfo.ariaLabelledBy) {
      const labelElement = document.getElementById(fieldInfo.ariaLabelledBy);
      if (labelElement) {
        fieldInfo.labels.push(labelElement.textContent.trim());
      }
    }

    fields.push(fieldInfo);
  });

  return fields;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new FormFillerPopup();
});
