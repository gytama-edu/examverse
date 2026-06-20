(() => {
  'use strict';

  const DATA_PATH = '../data/ielts-academic/writing/task1.json';
  const VALID_VISUAL_TYPES = new Set(['bar-chart', 'line-graph', 'pie-chart', 'table', 'process', 'map']);

  const state = {
    prompts: [],
    currentIndex: 0,
    sampleVisible: false,
    timerId: null,
    timerRemaining: 20 * 60,
    response: '',
    loadVersion: 0
  };

  const el = {
    sessionTitle: document.querySelector('#writing-session-title'),
    promptName: document.querySelector('#writing-prompt-name'),
    promptCounter: document.querySelector('#writing-prompt-counter'),
    wordDisplay: document.querySelector('#writing-word-display'),
    progress: document.querySelector('#writing-progress'),
    progressBar: document.querySelector('#writing-progress-bar'),
    area: document.querySelector('#writing-question-area'),
    sampleToggle: document.querySelector('#writing-sample-toggle'),
    next: document.querySelector('#writing-next'),
    restart: document.querySelector('#writing-restart'),
    hub: document.querySelector('#writing-hub-link'),
    hubLabel: document.querySelector('#writing-hub-label')
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };

  const currentPrompt = () => state.prompts[state.currentIndex];
  const wordsIn = (value) => String(value ?? '').trim().match(/\S+/g)?.length || 0;
  const formatTimer = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
    const remaining = String(safe % 60).padStart(2, '0');
    return `${minutes}:${remaining}`;
  };

  const setProgress = (value) => {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safe}%`;
    el.progress.setAttribute('aria-valuenow', String(safe));
  };

  const updateUrl = () => {
    const url = new URL(window.location.href);
    url.hash = 'writing-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updateHeader = () => {
    const item = currentPrompt();
    if (!item) return;
    el.sessionTitle.textContent = item.title;
    el.promptName.textContent = item.taskType;
    el.promptCounter.textContent = `Prompt ${state.currentIndex + 1} of ${state.prompts.length}`;
    el.hub.href = '../pages/ielts-academic.html';
    el.hubLabel.textContent = 'Back to IELTS Academic Hub';
    setProgress(((state.currentIndex + 1) / state.prompts.length) * 100);
  };

  const updateWordCount = () => {
    const count = wordsIn(state.response);
    el.wordDisplay.textContent = `${count} word${count === 1 ? '' : 's'}`;
    const status = document.querySelector('#writing-word-status');
    if (status) {
      status.textContent = count >= 150 ? 'Target reached' : 'Under 150';
      status.classList.toggle('ready', count >= 150);
    }
  };

  const stopTimer = (resetOnly = false) => {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    state.timerRemaining = 20 * 60;
    const display = document.querySelector('#writing-timer-display');
    if (display) display.textContent = formatTimer(state.timerRemaining);
    const status = document.querySelector('#writing-timer-status');
    if (status) status.textContent = resetOnly ? 'Reset and ready' : 'Ready to start';
  };

  const startTimer = () => {
    stopTimer(true);
    const display = document.querySelector('#writing-timer-display');
    const status = document.querySelector('#writing-timer-status');
    if (status) status.textContent = 'Writing time in progress';
    if (display) display.textContent = formatTimer(state.timerRemaining);
    state.timerId = window.setInterval(() => {
      state.timerRemaining -= 1;
      if (state.timerRemaining <= 0) {
        stopTimer();
        if (status) status.textContent = 'Time is up';
        if (display) display.textContent = '00:00';
        return;
      }
      if (display) display.textContent = formatTimer(state.timerRemaining);
    }, 1000);
  };

  const legendChips = (items) => {
    const wrap = make('div', 'writing-task1-language-bank');
    items.forEach((item) => wrap.append(make('span', 'writing-task1-language-chip', item)));
    return wrap;
  };

  const listBlock = (title, items, listClass) => {
    const section = make('section', 'writing-group');
    section.append(make('h4', null, title));
    const list = make('ul', listClass || '');
    items.forEach((item) => list.append(make('li', null, item)));
    section.append(list);
    return section;
  };

  const renderBarChart = (data) => {
    const wrap = make('div', 'writing-task1-graphic');
    const legend = make('div', 'writing-task1-legend');
    const palette = ['#74a7ff', '#61e7ae', '#ed83cf', '#ffbf69'];
    data.series.forEach((series, index) => {
      const chip = make('span', 'writing-task1-language-chip');
      chip.style.borderColor = `${palette[index % palette.length]}40`;
      chip.style.color = palette[index % palette.length];
      chip.textContent = series.name;
      legend.append(chip);
    });
    wrap.append(legend);

    const width = 680;
    const height = 300;
    const svgEl = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': data.caption || 'Bar chart preview' });
    const plot = { left: 48, right: 18, top: 18, bottom: 48 };
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const maxValue = Math.max(...data.series.flatMap((series) => series.values), 1);
    const groupWidth = plotWidth / data.labels.length;
    const barWidth = Math.min(26, (groupWidth * 0.68) / data.series.length);

    const xAxis = svg('line', { x1: plot.left, y1: height - plot.bottom, x2: width - plot.right, y2: height - plot.bottom, stroke: 'rgba(255,255,255,.18)' });
    const yAxis = svg('line', { x1: plot.left, y1: plot.top, x2: plot.left, y2: height - plot.bottom, stroke: 'rgba(255,255,255,.18)' });
    svgEl.append(xAxis, yAxis);

    data.labels.forEach((label, index) => {
      const labelX = plot.left + index * groupWidth + groupWidth / 2;
      const labelNode = svg('text', { x: labelX, y: height - 18, 'text-anchor': 'middle', fill: '#91a0b3', 'font-size': 11, 'font-family': 'ui-monospace, monospace' });
      labelNode.textContent = label;
      svgEl.append(labelNode);
    });

      data.series.forEach((series, seriesIndex) => {
        series.values.forEach((value, valueIndex) => {
          const barHeight = (value / maxValue) * plotHeight;
          const seriesGap = (groupWidth - barWidth * data.series.length) / 2;
          const x = plot.left + valueIndex * groupWidth + seriesGap + seriesIndex * barWidth;
          const y = height - plot.bottom - barHeight;
          const color = series.color || palette[seriesIndex % palette.length];
          const rect = svg('rect', { x, y, width: barWidth - 2, height: Math.max(barHeight, 2), rx: 4, fill: color, opacity: 0.95 });
          const text = svg('text', { x: x + (barWidth - 2) / 2, y: y - 6, 'text-anchor': 'middle', fill: '#d9e2ee', 'font-size': 10, 'font-family': 'ui-monospace, monospace' });
          text.textContent = String(value);
          svgEl.append(rect, text);
        });
      });

    wrap.append(svgEl);
    return wrap;
  };

  const renderLineGraph = (data) => {
    const wrap = make('div', 'writing-task1-graphic');
    const legend = make('div', 'writing-task1-legend');
    const palette = ['#74a7ff', '#61e7ae', '#ed83cf', '#ffbf69'];
    data.series.forEach((series, index) => {
      const chip = make('span', 'writing-task1-language-chip');
      chip.style.borderColor = `${palette[index % palette.length]}40`;
      chip.style.color = palette[index % palette.length];
      chip.textContent = series.name;
      legend.append(chip);
    });
    wrap.append(legend);

    const width = 680;
    const height = 300;
    const svgEl = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': data.caption || 'Line graph preview' });
    const plot = { left: 50, right: 18, top: 18, bottom: 48 };
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const maxValue = Math.max(...data.series.flatMap((series) => series.values), 1);
    const minValue = Math.min(...data.series.flatMap((series) => series.values), 0);
    const range = Math.max(maxValue - minValue, 1);

    svgEl.append(
      svg('line', { x1: plot.left, y1: height - plot.bottom, x2: width - plot.right, y2: height - plot.bottom, stroke: 'rgba(255,255,255,.18)' }),
      svg('line', { x1: plot.left, y1: plot.top, x2: plot.left, y2: height - plot.bottom, stroke: 'rgba(255,255,255,.18)' })
    );

    data.labels.forEach((label, index) => {
      const x = plot.left + (plotWidth / Math.max(data.labels.length - 1, 1)) * index;
      const text = svg('text', { x, y: height - 18, 'text-anchor': 'middle', fill: '#91a0b3', 'font-size': 11, 'font-family': 'ui-monospace, monospace' });
      text.textContent = label;
      svgEl.append(text);
    });

    data.series.forEach((series, seriesIndex) => {
      const color = series.color || palette[seriesIndex % palette.length];
      const points = series.values.map((value, index) => {
        const x = plot.left + (plotWidth / Math.max(series.values.length - 1, 1)) * index;
        const y = height - plot.bottom - ((value - minValue) / range) * plotHeight;
        return { x, y, value };
      });
      const poly = svg('polyline', {
        fill: 'none',
        stroke: color,
        'stroke-width': 3,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        points: points.map((point) => `${point.x},${point.y}`).join(' ')
      });
      svgEl.append(poly);
      points.forEach((point) => {
        const circle = svg('circle', { cx: point.x, cy: point.y, r: 5.5, fill: color, stroke: '#08111f', 'stroke-width': 2 });
        const text = svg('text', { x: point.x, y: point.y - 10, 'text-anchor': 'middle', fill: '#d9e2ee', 'font-size': 10, 'font-family': 'ui-monospace, monospace' });
        text.textContent = String(point.value);
        svgEl.append(circle, text);
      });
    });

    wrap.append(svgEl);
    return wrap;
  };

  const renderPieChart = (data) => {
    const wrap = make('div', 'writing-task1-graphic');
    const palette = ['#74a7ff', '#61e7ae', '#ed83cf', '#ffbf69', '#45e6f8'];
    const total = Math.max(data.slices.reduce((sum, slice) => sum + slice.value, 0), 1);
    const chart = make('div', 'writing-task1-pie');
    chart.style.background = `conic-gradient(${data.slices.map((slice, index) => {
      const start = data.slices.slice(0, index).reduce((sum, item) => sum + item.value, 0);
      const startPct = (start / total) * 100;
      const endPct = ((start + slice.value) / total) * 100;
      return `${slice.color || palette[index % palette.length]} ${startPct}% ${endPct}%`;
    }).join(', ')})`;
    const label = make('div', 'writing-task1-pie-label');
    label.textContent = data.caption || 'Pie chart preview';
    chart.append(label);
    wrap.append(chart, legendChips(data.slices.map((slice) => `${slice.label} (${slice.value}%)`)));
    return wrap;
  };

  const renderTable = (data) => {
    const wrap = make('div', 'writing-task1-graphic');
    const table = document.createElement('table');
    table.className = 'writing-task1-table';
    const caption = document.createElement('caption');
    caption.textContent = data.caption || 'Table preview';
    table.append(caption);
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    (data.columns || []).forEach((column) => headRow.append(make('th', null, column)));
    thead.append(headRow);
    table.append(thead);
    const tbody = document.createElement('tbody');
    (data.rows || []).forEach((row) => {
      const tr = document.createElement('tr');
      row.forEach((cell) => tr.append(make('td', null, cell)));
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    return wrap;
  };

  const renderProcess = (data) => {
    const wrap = make('div', 'writing-task1-graphic');
    const flow = make('div', 'writing-task1-process');
    (data.steps || []).forEach((step, index) => {
      const card = make('div', 'writing-task1-process-step');
      card.append(make('span', null, String(index + 1)), make('strong', null, step.title), make('p', null, step.detail));
      flow.append(card);
      if (index < (data.steps || []).length - 1) flow.append(make('div', 'writing-task1-process-arrow', '->'));
    });
    wrap.append(flow);
    return wrap;
  };

  const renderMap = (data) => {
    const wrap = make('div', 'writing-task1-graphic');
    const grid = make('div', 'writing-task1-map');
    [['beforeTitle', 'before'], ['afterTitle', 'after']].forEach(([titleKey, itemsKey]) => {
      const panel = make('section', 'writing-task1-map-panel');
      panel.append(make('h4', null, data[titleKey]));
      const plan = make('div', 'writing-task1-map-plan');
      (data[itemsKey] || []).forEach((item) => {
        const node = make('div', 'writing-task1-map-item');
        node.append(make('strong', null, item.label), make('span', null, item.note));
        plan.append(node);
      });
      panel.append(plan);
      grid.append(panel);
    });
    wrap.append(grid);
    return wrap;
  };

  const renderVisual = (item) => {
    switch (item.visualType) {
      case 'bar-chart':
        return renderBarChart(item.visualData);
      case 'line-graph':
        return renderLineGraph(item.visualData);
      case 'pie-chart':
        return renderPieChart(item.visualData);
      case 'table':
        return renderTable(item.visualData);
      case 'process':
        return renderProcess(item.visualData);
      case 'map':
        return renderMap(item.visualData);
      default:
        throw new Error(`Unsupported visual type: ${item.visualType}`);
    }
  };

  const renderPrompt = () => {
    const item = currentPrompt();
    if (!item) {
      showError(new Error('Task 1 data unavailable.'));
      return;
    }

    stopTimer(true);
    state.sampleVisible = false;
    state.response = '';
    updateHeader();
    el.wordDisplay.textContent = '0 words';
    el.sampleToggle.disabled = false;
    el.next.disabled = false;
    el.restart.disabled = false;
    el.sampleToggle.textContent = 'Show Sample Answer';
    el.sampleToggle.setAttribute('aria-expanded', 'false');

    const layout = make('div', 'writing-task1-grid');

    const promptCard = make('section', 'completion-passage-card writing-task1-prompt-card');
    const promptTop = make('div', 'completion-content-top');
    promptTop.append(
      make('span', 'completion-difficulty', item.taskType),
      make('span', 'completion-type', item.visualType.replace('-', ' ')),
      make('span', 'completion-word-limit', '150+ words')
    );
    promptCard.append(
      promptTop,
      make('span', 'section-kicker', 'Task prompt'),
      make('h3', 'writing-task1-title', item.title),
      make('p', 'completion-passage-text', item.prompt),
      renderVisual(item),
      listBlock('Overview tips', item.overviewTips, 'writing-task1-checklist')
    );

    const sidebar = make('div', 'writing-task1-sidebar');

    const timerCard = make('section', 'completion-task-card writing-task1-timer');
    const timerHeader = make('header', 'completion-task-header');
    const timerInfo = make('div');
    timerInfo.append(make('span', null, 'Writing timer'), make('h3', null, '20 minutes of focused writing'));
    const timerBox = make('div', 'writing-task1-timer-box');
    const timerDisplay = make('strong', null, '20:00');
    timerDisplay.id = 'writing-timer-display';
    const timerStatus = make('span', null, 'Ready to start');
    timerStatus.id = 'writing-timer-status';
    timerBox.append(timerDisplay, timerStatus);
    const timerActions = make('div', 'practice-actions writing-timer-actions');
    const start = make('button', 'button', 'Start Timer');
    start.type = 'button';
    start.addEventListener('click', startTimer);
    const reset = make('button', 'button button-secondary', 'Reset Timer');
    reset.type = 'button';
    reset.addEventListener('click', () => stopTimer(true));
    timerActions.append(start, reset);
    const timerLimit = make('div', 'completion-limit-box');
    timerLimit.append(make('span', null, 'Time'), make('strong', null, '20 min'));
    timerHeader.append(timerInfo, timerLimit);
    timerCard.append(timerHeader, timerBox, timerActions);

    const editorCard = make('section', 'completion-task-card writing-task1-editor');
    const editorHeader = make('header', 'completion-task-header');
    const editorInfo = make('div');
    editorInfo.append(make('span', null, 'Writing response'), make('h3', null, 'Write your Task 1 report'));
    const targetBox = make('div', 'completion-limit-box');
    targetBox.append(make('span', null, 'Target'), make('strong', null, '150+ words'));
    editorHeader.append(editorInfo, targetBox);
    const textareaWrap = make('div', 'writing-task1-textarea-wrap');
    const textarea = make('textarea', 'completion-input writing-task1-textarea');
    textarea.id = 'writing-response';
    textarea.placeholder = 'Write your Task 1 response here...';
    textarea.value = state.response;
    textarea.addEventListener('input', () => {
      state.response = textarea.value;
      updateWordCount();
    });
    const wordMeta = make('div', 'writing-task1-counter');
    wordMeta.append(make('span', null, 'Live word count'), make('strong', 'writing-task1-counter-value', '0 words'), make('em', 'writing-task1-counter-status', 'Under 150'));
    wordMeta.querySelector('strong').id = 'writing-word-live';
    wordMeta.querySelector('em').id = 'writing-word-status';
    textareaWrap.append(textarea, wordMeta);
    editorCard.append(editorHeader, textareaWrap);

    sidebar.append(timerCard, editorCard);

    const guideCard = make('section', 'completion-task-card writing-task1-guide');
    const guideHeader = make('header', 'completion-task-header');
    const guideInfo = make('div');
    guideInfo.append(make('span', null, 'Structure guide'), make('h3', null, 'Keep the report clear and selective'));
    const guideLimit = make('div', 'completion-limit-box');
    guideLimit.append(make('span', null, 'Focus'), make('strong', null, 'Overview + detail'));
    guideHeader.append(guideInfo, guideLimit);
    const guideList = make('ol', 'writing-task1-guide-list');
    item.structureGuide.forEach((step) => guideList.append(make('li', null, step)));
    guideCard.append(guideHeader, guideList);

    const languageCard = make('section', 'completion-task-card writing-task1-language');
    const languageHeader = make('header', 'completion-task-header');
    const languageInfo = make('div');
    languageInfo.append(make('span', null, 'Language bank'), make('h3', null, 'Useful Task 1 phrases'));
    const languageLimit = make('div', 'completion-limit-box');
    languageLimit.append(make('span', null, 'Language'), make('strong', null, 'Academic phrases'));
    languageHeader.append(languageInfo, languageLimit);
    languageCard.append(languageHeader, legendChips(item.usefulLanguage));

    layout.append(promptCard, sidebar);

    const sampleCard = make('section', 'completion-task-card writing-task1-sample');
    sampleCard.id = 'writing-sample-card';
    sampleCard.hidden = true;
    const sampleHeader = make('header', 'completion-task-header');
    const sampleInfo = make('div');
    sampleInfo.append(make('span', null, 'Sample answer'), make('h3', null, 'Reveal after you finish writing'));
    sampleHeader.append(sampleInfo, make('div', 'completion-limit-box', ''));
    sampleCard.append(sampleHeader, make('p', null, item.sampleAnswer));

    const checkCard = make('section', 'completion-task-card writing-task1-check');
    const checkHeader = make('header', 'completion-task-header');
    const checkInfo = make('div');
    checkInfo.append(make('span', null, 'Self-check'), make('h3', null, 'Review your report before moving on'));
    checkHeader.append(checkInfo, make('div', 'completion-limit-box', ''));
    const checklist = make('ul', 'writing-task1-checklist');
    item.selfCheck.forEach((point) => checklist.append(make('li', null, point)));
    checkCard.append(checkHeader, checklist);

    el.area.replaceChildren(layout, sampleCard, checkCard);
    updateWordCount();
    textarea.focus({ preventScroll: true });
  };

  const showError = (error) => {
    stopTimer();
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.promptName.textContent = 'Please retry';
    el.promptCounter.textContent = 'Not loaded';
    el.wordDisplay.textContent = '0 words';
    setProgress(0);
    const box = make('div', 'practice-load-error');
    box.append(
      make('span', 'practice-load-error-icon', '!'),
      make('h3', null, 'We could not load the writing studio.'),
      make('p', null, error?.message || 'Please check the dataset and try again.')
    );
    const retry = make('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', () => loadPrompts());
    box.append(retry);
    el.area.replaceChildren(box);
    el.sampleToggle.disabled = true;
    el.next.disabled = true;
    el.restart.disabled = true;
  };

  const validateArray = (value, label) => {
    if (!Array.isArray(value) || !value.length) {
      throw new Error(`Invalid dataset: ${label} must be a non-empty array.`);
    }
    value.forEach((item, index) => {
      if (typeof item !== 'string' || !item.trim()) {
        throw new Error(`Invalid dataset: ${label}[${index}] must be a non-empty string.`);
      }
    });
  };

  const validateDataset = (data) => {
    if (!Array.isArray(data)) throw new Error('Invalid dataset: task1.json must contain an array.');
    if (!data.length) throw new Error('Invalid dataset: task1.json must not be empty.');

    data.forEach((item, index) => {
      const label = `item ${index + 1}`;
      const required = ['id', 'examKey', 'interfaceType', 'taskType', 'title', 'prompt', 'visualType', 'visualData', 'overviewTips', 'structureGuide', 'usefulLanguage', 'sampleAnswer', 'selfCheck', 'status'];
      const missing = required.filter((field) => item?.[field] === undefined || item?.[field] === null || item?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);
      if (item.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status active.`);
      if (item.examKey !== 'ielts-academic-writing') throw new Error(`Invalid dataset: ${label} must use examKey ielts-academic-writing.`);
      if (item.interfaceType !== 'writing-task1') throw new Error(`Invalid dataset: ${label} must use interfaceType writing-task1.`);
      if (!item.id.startsWith('ielts-awt1-')) throw new Error(`Invalid dataset: ${item.id} has the wrong id prefix.`);
      if (!VALID_VISUAL_TYPES.has(item.visualType)) throw new Error(`Invalid dataset: ${label} has an unsupported visualType ${item.visualType}.`);
      if (!item.visualData || typeof item.visualData !== 'object') throw new Error(`Invalid dataset: ${label} visualData must be an object.`);
      validateArray(item.overviewTips, `${label} overviewTips`);
      validateArray(item.structureGuide, `${label} structureGuide`);
      validateArray(item.usefulLanguage, `${label} usefulLanguage`);
      validateArray(item.selfCheck, `${label} selfCheck`);
      if (typeof item.sampleAnswer !== 'string' || !item.sampleAnswer.trim()) {
        throw new Error(`Invalid dataset: ${label} sampleAnswer must be a non-empty string.`);
      }
    });

    return data;
  };

  async function loadPrompts() {
    const requestVersion = ++state.loadVersion;
    try {
      const response = await fetch(DATA_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATH} (${response.status}).`);
      const data = validateDataset(await response.json());
      if (requestVersion !== state.loadVersion) return;
      state.prompts = data;
      state.currentIndex = 0;
      renderPrompt();
    } catch (error) {
      if (requestVersion !== state.loadVersion) return;
      console.error('Exam Verse IELTS Writing Task 1 dataset validation failed:', error);
      showError(error);
    }
  }

  const nextPrompt = () => {
    if (!state.prompts.length) return;
    state.currentIndex = (state.currentIndex + 1) % state.prompts.length;
    state.response = '';
    state.sampleVisible = false;
    renderPrompt();
  };

  const restartWriting = () => {
    state.response = '';
    state.sampleVisible = false;
    renderPrompt();
  };

  const toggleSample = () => {
    state.sampleVisible = !state.sampleVisible;
    const sample = document.querySelector('#writing-sample-card');
    if (sample) sample.hidden = !state.sampleVisible;
    el.sampleToggle.textContent = state.sampleVisible ? 'Hide Sample Answer' : 'Show Sample Answer';
    el.sampleToggle.setAttribute('aria-expanded', String(state.sampleVisible));
  };

  el.sampleToggle.addEventListener('click', toggleSample);
  el.next.addEventListener('click', nextPrompt);
  el.restart.addEventListener('click', restartWriting);

  updateUrl();
  loadPrompts();
})();
