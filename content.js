// 网页填写助手 - 内容脚本
// 在网页上下文中运行，负责表单识别和填充

(function() {
  'use strict';

  // 防止重复注入
  if (window.formFillerInjected) {
    return;
  }
  window.formFillerInjected = true;

  // 字段类型映射
  const FIELD_TYPE_MAP = {
    // 姓名相关
    'name': ['姓名', '名字', 'name', 'username', 'realname', 'fullname'],
    'firstName': ['名', 'firstname', 'first_name', 'givenname'],
    'lastName': ['姓', 'lastname', 'last_name', 'surname', 'familyname'],

    // 联系方式
    'phone': ['电话', '手机', '手机号', 'phone', 'mobile', 'tel', 'telephone', 'cellphone'],
    'email': ['邮箱', '邮件', 'email', 'e-mail', 'mail'],
    'fax': ['传真', 'fax'],

    // 地址相关
    'address': ['地址', 'address', 'addr', 'street'],
    'city': ['城市', 'city', '市'],
    'province': ['省份', '省', 'province', 'state'],
    'country': ['国家', 'country', '国'],
    'zipcode': ['邮编', '邮政编码', 'zip', 'zipcode', 'postal'],

    // 身份信息
    'idCard': ['身份证', '身份证号', 'idcard', 'identity'],
    'passport': ['护照', 'passport'],

    // 公司信息
    'company': ['公司', '单位', 'company', 'organization', 'org'],
    'department': ['部门', 'department', 'dept'],
    'position': ['职位', '岗位', 'position', 'job', 'title'],

    // 其他常用字段
    'age': ['年龄', 'age'],
    'gender': ['性别', 'gender', 'sex'],
    'birthday': ['生日', '出生日期', 'birthday', 'birth', 'dob'],
    'website': ['网站', '网址', 'website', 'url', 'homepage'],
    'qq': ['QQ', 'qq'],
    'wechat': ['微信', '微信号', 'wechat', 'weixin'],
  };

  // 智能字段识别器
  class SmartFieldRecognizer {
    constructor() {
      this.fieldCache = new Map();
    }

    // 分析页面中的所有表单字段
    analyzeFields() {
      const fields = [];
      const inputs = document.querySelectorAll('input, textarea, select');

      inputs.forEach((input, index) => {
        if (this.isFillableField(input)) {
          const fieldInfo = this.extractFieldInfo(input, index);
          fields.push(fieldInfo);
        }
      });

      return fields;
    }

    // 判断字段是否可填充
    isFillableField(input) {
      const type = input.type || 'text';
      const skipTypes = ['hidden', 'submit', 'button', 'reset', 'image', 'file'];

      if (skipTypes.includes(type)) return false;
      if (input.disabled) return false;
      if (input.readOnly && type !== 'select-one' && type !== 'select-multiple') return false;

      return true;
    }

    // 提取字段信息
    extractFieldInfo(input, index) {
      const info = {
        element: input,
        index: index,
        tagName: input.tagName.toLowerCase(),
        type: input.type || 'text',
        name: input.name || '',
        id: input.id || '',
        className: input.className || '',
        placeholder: input.placeholder || '',
        value: input.value || '',
        required: input.required || false,

        // 语义分析结果
        semanticType: null,
        confidence: 0,

        // 所有可能的标识
        identifiers: this.collectIdentifiers(input),

        // 视觉信息
        visualInfo: this.getVisualInfo(input)
      };

      // 进行语义分析
      const semantic = this.analyzeSemanticType(info);
      info.semanticType = semantic.type;
      info.confidence = semantic.confidence;

      return info;
    }

    // 收集字段的所有标识符
    collectIdentifiers(input) {
      const identifiers = [];

      // 基础属性
      if (input.name) identifiers.push(input.name);
      if (input.id) identifiers.push(input.id);
      if (input.placeholder) identifiers.push(input.placeholder);
      if (input.getAttribute('aria-label')) {
        identifiers.push(input.getAttribute('aria-label'));
      }

      // 关联的 label
      const labelTexts = this.getLabelTexts(input);
      identifiers.push(...labelTexts);

      // 相邻文本
      const siblingText = this.getSiblingText(input);
      if (siblingText) identifiers.push(siblingText);

      // placeholder 分析
      if (input.placeholder) {
        identifiers.push(input.placeholder);
      }

      // 类名分析
      if (input.className) {
        const classWords = input.className
          .split(/\s+/)
          .filter(c => c.length > 2);
        identifiers.push(...classWords);
      }

      return identifiers.filter((v, i, a) => a.indexOf(v) === i); // 去重
    }

    // 获取 label 文本
    getLabelTexts(input) {
      const texts = [];

      // 通过 for 属性关联
      if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) {
          texts.push(label.textContent.trim());
        }
      }

      // 父元素是 label
      let parent = input.parentElement;
      while (parent && parent.tagName.toLowerCase() !== 'form') {
        if (parent.tagName.toLowerCase() === 'label') {
          texts.push(parent.textContent.trim());
          break;
        }
        // 检查兄弟 label
        const siblingLabel = parent.querySelector('label');
        if (siblingLabel) {
          texts.push(siblingLabel.textContent.trim());
        }
        parent = parent.parentElement;
      }

      // aria-labelledby
      const labelledBy = input.getAttribute('aria-labelledby');
      if (labelledBy) {
        const ids = labelledBy.split(' ');
        ids.forEach(id => {
          const element = document.getElementById(id);
          if (element) {
            texts.push(element.textContent.trim());
          }
        });
      }

      return texts;
    }

    // 获取相邻文本
    getSiblingText(input) {
      const prevSibling = input.previousElementSibling;
      if (prevSibling) {
        const text = prevSibling.textContent.trim();
        if (text && text.length < 50) {
          return text;
        }
      }

      const parent = input.parentElement;
      if (parent) {
        const firstChild = parent.firstElementChild;
        if (firstChild && firstChild !== input) {
          const text = firstChild.textContent.trim();
          if (text && text.length < 50) {
            return text;
          }
        }
      }

      return null;
    }

    // 获取视觉信息
    getVisualInfo(input) {
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);

      return {
        width: rect.width,
        height: rect.height,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        visible: rect.width > 0 && rect.height > 0,
        zIndex: style.zIndex
      };
    }

    // 分析语义类型
    analyzeSemanticType(fieldInfo) {
      const scores = {};

      // 对每个可能的类型计算匹配分数
      for (const [type, keywords] of Object.entries(FIELD_TYPE_MAP)) {
        let score = 0;

        for (const identifier of fieldInfo.identifiers) {
          const normalizedId = this.normalizeText(identifier);

          for (const keyword of keywords) {
            const normalizedKeyword = this.normalizeText(keyword);

            // 完全匹配
            if (normalizedId === normalizedKeyword) {
              score += 10;
            }
            // 包含匹配
            else if (normalizedId.includes(normalizedKeyword)) {
              score += 5;
            }
            // 被包含
            else if (normalizedKeyword.includes(normalizedId) && normalizedId.length > 2) {
              score += 3;
            }
            // 相似度
            else {
              const similarity = this.calculateSimilarity(normalizedId, normalizedKeyword);
              if (similarity > 0.7) {
                score += similarity * 3;
              }
            }
          }
        }

        if (score > 0) {
          scores[type] = score;
        }
      }

      // 找出最高分
      let bestType = null;
      let bestScore = 0;

      for (const [type, score] of Object.entries(scores)) {
        if (score > bestScore) {
          bestScore = score;
          bestType = type;
        }
      }

      // 根据 input type 进行额外判断
      if (fieldInfo.type === 'email' && (!bestType || bestScore < 5)) {
        bestType = 'email';
        bestScore = Math.max(bestScore, 8);
      } else if (fieldInfo.type === 'tel' && (!bestType || bestScore < 5)) {
        bestType = 'phone';
        bestScore = Math.max(bestScore, 8);
      }

      // 计算置信度
      const confidence = Math.min(bestScore / 10, 1);

      return {
        type: bestType,
        confidence: confidence
      };
    }

    // 标准化文本
    normalizeText(text) {
      return text
        .toLowerCase()
        .replace(/[_\-\s]+/g, '')
        .replace(/[.:：()（）\[\]]/g, '')
        .trim();
    }

    // 计算相似度
    calculateSimilarity(str1, str2) {
      if (str1 === str2) return 1;
      if (str1.length === 0 || str2.length === 0) return 0;

      const len1 = str1.length;
      const len2 = str2.length;

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
  }

  // 表单填充器
  class FormFiller {
    constructor() {
      this.recognizer = new SmartFieldRecognizer();
    }

    // 填充表单
    fill(data) {
      const result = {
        success: true,
        filled: [],
        failed: [],
        unmatched: []
      };

      // 分析所有字段
      const fields = this.recognizer.analyzeFields();

      // 创建数据副本
      const remainingData = { ...data };

      // 第一轮：高置信度匹配
      for (const field of fields) {
        if (field.semanticType && field.confidence > 0.5) {
          const dataKey = this.findDataKeyBySemanticType(
            field.semanticType,
            remainingData
          );

          if (dataKey) {
            const success = this.fillField(field, remainingData[dataKey]);
            if (success) {
              result.filled.push({
                field: field.identifiers[0] || field.name,
                value: remainingData[dataKey],
                type: field.semanticType
              });
              delete remainingData[dataKey];
            } else {
              result.failed.push({
                field: field.identifiers[0] || field.name,
                reason: '填充失败'
              });
            }
          }
        }
      }

      // 第二轮：文本匹配
      for (const field of fields) {
        const dataKey = this.findBestDataKey(field.identifiers, remainingData);

        if (dataKey) {
          const success = this.fillField(field, remainingData[dataKey]);
          if (success) {
            result.filled.push({
              field: field.identifiers[0] || field.name,
              value: remainingData[dataKey]
            });
            delete remainingData[dataKey];
          }
        }
      }

      // 记录未匹配的数据
      result.unmatched = Object.keys(remainingData).map(key => ({
        key: key,
        value: remainingData[key]
      }));

      return result;
    }

    // 根据语义类型查找数据键
    findDataKeyBySemanticType(semanticType, data) {
      const keywords = FIELD_TYPE_MAP[semanticType] || [];

      for (const key of Object.keys(data)) {
        const normalizedKey = this.normalizeText(key);

        for (const keyword of keywords) {
          if (normalizedKey.includes(this.normalizeText(keyword))) {
            return key;
          }
        }
      }

      // 直接匹配
      for (const key of Object.keys(data)) {
        if (this.normalizeText(key) === semanticType) {
          return key;
        }
      }

      return null;
    }

    // 查找最佳数据键
    findBestDataKey(identifiers, data) {
      let bestKey = null;
      let bestScore = 0;

      for (const identifier of identifiers) {
        if (!identifier) continue;

        const normalizedId = this.normalizeText(identifier);

        for (const key of Object.keys(data)) {
          const normalizedKey = this.normalizeText(key);

          // 完全匹配
          if (normalizedId === normalizedKey) {
            return key;
          }

          // 包含匹配
          let score = 0;
          if (normalizedId.includes(normalizedKey)) {
            score = 0.8;
          } else if (normalizedKey.includes(normalizedId)) {
            score = 0.6;
          } else {
            score = this.calculateSimilarity(normalizedId, normalizedKey);
          }

          if (score > bestScore && score > 0.6) {
            bestScore = score;
            bestKey = key;
          }
        }
      }

      return bestKey;
    }

    // 填充单个字段
    fillField(field, value) {
      const input = field.element;
      const type = field.type;
      const tagName = field.tagName;

      try {
        if (tagName === 'select') {
          return this.fillSelect(input, value);
        }

        if (type === 'radio') {
          return this.fillRadio(input, value);
        }

        if (type === 'checkbox') {
          return this.fillCheckbox(input, value);
        }

        if (type === 'date') {
          return this.fillDate(input, value);
        }

        // 普通文本输入
        input.value = value;
        this.triggerEvents(input);
        return true;
      } catch (error) {
        console.error('填充字段失败:', error);
        return false;
      }
    }

    // 填充下拉框
    fillSelect(select, value) {
      const options = Array.from(select.options);

      // 精确匹配
      let option = options.find(opt =>
        opt.text.trim() === value ||
        opt.value === value
      );

      // 忽略大小写匹配
      if (!option) {
        option = options.find(opt =>
          opt.text.toLowerCase().trim() === value.toLowerCase() ||
          opt.value.toLowerCase() === value.toLowerCase()
        );
      }

      // 包含匹配
      if (!option) {
        option = options.find(opt =>
          opt.text.toLowerCase().includes(value.toLowerCase()) ||
          value.toLowerCase().includes(opt.text.toLowerCase())
        );
      }

      if (option) {
        select.value = option.value;
        this.triggerEvents(select);
        return true;
      }

      return false;
    }

    // 填充单选框
    fillRadio(radio, value) {
      const name = radio.name;
      const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);

      for (const r of radios) {
        const label = this.getRadioLabel(r);
        if (r.value === value ||
            label === value ||
            label.toLowerCase() === value.toLowerCase()) {
          r.checked = true;
          this.triggerEvents(r);
          return true;
        }
      }

      return false;
    }

    // 获取单选框标签
    getRadioLabel(radio) {
      const id = radio.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          return label.textContent.trim();
        }
      }

      const parent = radio.parentElement;
      if (parent && parent.tagName.toLowerCase() === 'label') {
        return parent.textContent.trim();
      }

      const nextSibling = radio.nextElementSibling;
      if (nextSibling) {
        return nextSibling.textContent.trim();
      }

      return '';
    }

    // 填充复选框
    fillCheckbox(checkbox, value) {
      const name = checkbox.name;
      const checkboxes = document.querySelectorAll(`input[type="checkbox"][name="${name}"]`);
      const values = value.split(/[,，]/).map(v => v.trim().toLowerCase());

      let filled = false;
      for (const cb of checkboxes) {
        const label = this.getRadioLabel(cb).toLowerCase();
        const cbValue = cb.value.toLowerCase();

        const shouldCheck = values.some(v =>
          label.includes(v) ||
          v.includes(label) ||
          cbValue === v
        );

        if (shouldCheck) {
          cb.checked = true;
          this.triggerEvents(cb);
          filled = true;
        }
      }

      return filled;
    }

    // 填充日期
    fillDate(input, value) {
      // 尝试解析各种日期格式
      const date = this.parseDate(value);

      if (date) {
        input.value = date.toISOString().split('T')[0];
        this.triggerEvents(input);
        return true;
      }

      // 直接填充
      input.value = value;
      this.triggerEvents(input);
      return true;
    }

    // 解析日期
    parseDate(value) {
      // 尝试标准解析
      let date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }

      // 尝试中文日期格式
      const patterns = [
        /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})/,
        /(\d{4})(\d{2})(\d{2})/,
        /(\d{2})[月\-/](\d{1,2})[日\-/](\d{4})/
      ];

      for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match) {
          if (pattern.source.includes('月.*日')) {
            date = new Date(match[3], match[1] - 1, match[2]);
          } else {
            date = new Date(match[1], match[2] - 1, match[3]);
          }
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }

      return null;
    }

    // 触发事件
    triggerEvents(input) {
      const events = ['focus', 'input', 'change', 'blur'];
      events.forEach(eventType => {
        const event = new Event(eventType, { bubbles: true });
        input.dispatchEvent(event);
      });
    }

    // 标准化文本
    normalizeText(text) {
      return text
        .toLowerCase()
        .replace(/[_\-\s]+/g, '')
        .replace(/[.:：()（）\[\]]/g, '')
        .trim();
    }

    // 计算相似度
    calculateSimilarity(str1, str2) {
      if (str1 === str2) return 1;
      if (!str1 || !str2) return 0;

      const len1 = str1.length;
      const len2 = str2.length;

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
  }

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scan') {
      const recognizer = new SmartFieldRecognizer();
      const fields = recognizer.analyzeFields();

      // 简化返回的数据（不能传递 DOM 元素）
      const simplified = fields.map(f => ({
        index: f.index,
        tagName: f.tagName,
        type: f.type,
        name: f.name,
        id: f.id,
        placeholder: f.placeholder,
        identifiers: f.identifiers,
        semanticType: f.semanticType,
        confidence: f.confidence
      }));

      sendResponse({ fields: simplified });
    }

    if (request.action === 'fill') {
      const filler = new FormFiller();
      const result = filler.fill(request.data);
      sendResponse(result);
    }

    return true;
  });

  // 暴露到全局（用于调试）
  window.FormFiller = FormFiller;
  window.SmartFieldRecognizer = SmartFieldRecognizer;

  console.log('[网页填写助手] 已加载');
})();
