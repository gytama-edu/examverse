(() => {
  'use strict';

  const DATA_PATHS = {
    1: '../data/ielts-speaking/part-1.json',
    2: '../data/ielts-speaking/part-2.json',
    3: '../data/ielts-speaking/part-3.json'
  };

  const hubTarget = /ielts-general\.html/i.test(document.referrer)
    ? '../pages/ielts-general.html'
    : '../pages/ielts-academic.html';
  const hubLabel = hubTarget.includes('general')
    ? 'Back to IELTS General Hub'
    : 'Back to IELTS Academic Hub';

  const PART_CONFIG = {
    1: {
      name: 'IELTS Speaking Part 1',
      title: 'Part 1 - Short Personal Questions',
      hub: hubTarget,
      hubLabel,
      prefix: 'ielts-sp-p1-',
      timerLabel: '40 seconds',
      startLabel: 'Start Timer',
      subtitle: 'Short answers, direct ideas, and one clear detail.'
    },
    2: {
      name: 'IELTS Speaking Part 2',
      title: 'Part 2 - Cue Card Practice',
      hub: hubTarget,
      hubLabel,
      prefix: 'ielts-sp-p2-',
      timerLabel: '1 minute prep / 2 minutes speak',
      startLabel: 'Start Timer',
      subtitle: 'Plan quickly, speak for longer, and keep the cue points moving.'
    },
    3: {
      name: 'IELTS Speaking Part 3',
      title: 'Part 3 - Discussion Questions',
      hub: hubTarget,
      hubLabel,
      prefix: 'ielts-sp-p3-',
      timerLabel: '60 seconds',
      startLabel: 'Start Timer',
      subtitle: 'Give a broader opinion, explain it, and keep the answer balanced.'
    }
  };

  const requestedPart = Number(new URLSearchParams(window.location.search).get('part'));
  const initialPart = Object.prototype.hasOwnProperty.call(PART_CONFIG, requestedPart) ? requestedPart : 1;

  const state = {
    datasets: {},
    part: initialPart,
    currentIndex: 0,
    timerId: null,
    timerMode: 'idle',
    timerRemaining: 0,
    sampleVisible: false,
    notes: {},
    loadVersion: 0
  };

  const el = {
    partCards: [...document.querySelectorAll('[data-part]')],
    sessionTitle: document.querySelector('#speaking-session-title'),
    partName: document.querySelector('#speaking-part-name'),
    promptCounter: document.querySelector('#speaking-prompt-counter'),
    timerDisplay: document.querySelector('#speaking-timer-display'),
    progress: document.querySelector('#speaking-progress'),
    progressBar: document.querySelector('#speaking-progress-bar'),
    area: document.querySelector('#speaking-question-area'),
    sampleToggle: document.querySelector('#speaking-sample-toggle'),
    next: document.querySelector('#speaking-next'),
    restart: document.querySelector('#speaking-restart'),
    hub: document.querySelector('#speaking-hub-link'),
    hubLabel: document.querySelector('#speaking-hub-label')
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const currentItems = () => state.datasets[state.part] || [];
  const currentItem = () => currentItems()[state.currentIndex];
  const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

  const setProgress = (value) => {
    const safe = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safe}%`;
    el.progress.setAttribute('aria-valuenow', String(safe));
  };

  const updateUrl = (part) => {
    const url = new URL(window.location.href);
    url.searchParams.set('part', String(part));
    url.hash = 'speaking-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updatePartUi = () => {
    const config = PART_CONFIG[state.part];
    el.partCards.forEach((card) => {
      const active = Number(card.dataset.part) === state.part;
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', String(active));
    });
    el.sessionTitle.textContent = config.title;
    el.partName.textContent = config.name;
    el.hub.href = config.hub;
    el.hubLabel.textContent = config.hubLabel;
  };

  const setTimerText = (label, value) => {
    document.querySelectorAll('[data-speaking-timer-label]').forEach((node) => {
      node.textContent = label;
    });
    document.querySelectorAll('[data-speaking-timer-text]').forEach((node) => {
      node.textContent = value;
    });
    el.timerDisplay.textContent = value;
  };

  const stopTimer = (label = 'Ready', value = 'Ready') => {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    state.timerMode = 'idle';
    state.timerRemaining = 0;
    setTimerText(label, value);
  };

  const formatTime = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
    const remaining = String(safe % 60).padStart(2, '0');
    return `${minutes}:${remaining}`;
  };

  const startTimer = (mode, seconds, label) => {
    stopTimer(label, formatTime(seconds));
    state.timerMode = mode;
    state.timerRemaining = seconds;
    setTimerText(label, formatTime(seconds));
    state.timerId = window.setInterval(() => {
      state.timerRemaining -= 1;
      if (state.timerRemaining <= 0) {
        stopTimer(label, 'Time is up');
        return;
      }
      setTimerText(label, formatTime(state.timerRemaining));
    }, 1000);
  };

  const group = (title, items) => {
    const section = make('section', 'speaking-group');
    section.append(make('h4', null, title));
    const list = make('ul');
    items.forEach((item) => list.append(make('li', null, item)));
    section.append(list);
    return section;
  };

  const renderVocabulary = (items) => {
    const wrap = make('div', 'speaking-vocab');
    items.forEach((item) => wrap.append(make('span', null, item)));
    return wrap;
  };

  const renderTimerControls = (item) => {
    const controls = make('div', 'practice-actions speaking-timer-actions');
    if (state.part === 2) {
      const prep = make('button', 'button', 'Start 1-minute preparation');
      prep.type = 'button';
      prep.addEventListener('click', () => startTimer('prep', item.prepTime, 'Preparation'));
      const speak = make('button', 'button button-secondary', 'Start 2-minute speaking');
      speak.type = 'button';
      speak.addEventListener('click', () => startTimer('speaking', item.speakingTime, 'Speaking'));
      const reset = make('button', 'button button-secondary', 'Reset Timer');
      reset.type = 'button';
      reset.addEventListener('click', () => stopTimer('Ready', 'Ready'));
      controls.append(prep, speak, reset);
      return controls;
    }

    const start = make('button', 'button', PART_CONFIG[state.part].startLabel);
    start.type = 'button';
    start.addEventListener('click', () => startTimer('countdown', item.suggestedTime, 'Speaking'));
    const reset = make('button', 'button button-secondary', 'Reset Timer');
    reset.type = 'button';
    reset.addEventListener('click', () => stopTimer('Ready', 'Ready'));
    controls.append(start, reset);
    return controls;
  };

  const renderPromptCard = (item) => {
    const card = make('section', 'completion-passage-card speaking-prompt-card');
    card.append(
      make('span', 'section-kicker', state.part === 2 ? 'Cue card prompt' : 'Speaking question'),
      make('h3', 'speaking-prompt-title', state.part === 2 ? item.cueCardTitle : item.topic),
      make('p', 'speaking-prompt-copy', state.part === 2 ? item.cueCardPrompt : item.question)
    );

    const meta = make('div', 'completion-content-top');
    meta.append(
      make('span', 'completion-difficulty', `Part ${state.part}`),
      make('span', 'completion-type', item.topic),
      make('span', 'completion-word-limit', state.part === 2 ? `${item.prepTime}s prep / ${item.speakingTime}s speak` : `${item.suggestedTime}s suggested`)
    );
    card.prepend(meta);

    if (state.part === 2) {
      const bullets = make('ul', 'speaking-prompt-list');
      item.bulletPoints.forEach((point) => bullets.append(make('li', null, point)));
      card.append(bullets);
    }

    const timerBox = make('div', 'speaking-timer-box');
    const label = make('span', null, 'Timer');
    label.dataset.speakingTimerLabel = 'true';
    const display = make('strong', null, 'Ready');
    display.dataset.speakingTimerText = 'true';
    timerBox.append(label, display);
    timerBox.append(renderTimerControls(item));
    card.append(timerBox);

    if (state.part === 2) {
      const notes = make('div', 'speaking-note-box');
      const labelNode = make('label', null, 'Planning notes');
      const textarea = make('textarea', 'completion-input');
      textarea.placeholder = 'Write quick keywords, not full sentences.';
      textarea.value = state.notes[item.id] || '';
      textarea.addEventListener('input', () => {
        state.notes[item.id] = textarea.value;
      });
      notes.append(labelNode, textarea);
      card.append(notes);
    }

    return card;
  };

  const renderSupportCard = (item) => {
    const card = make('aside', 'completion-task-card speaking-support-card');
    const header = make('header', 'completion-task-header');
    const copy = make('div');
    copy.append(make('span', null, 'Answer support'), make('h3', null, 'Use the structure, then speak naturally.'));
    const chip = make('div', 'completion-limit-box');
    chip.append(make('span', null, 'Focused skill'), make('strong', null, state.part === 2 ? 'Planning and expansion' : 'Natural speaking'));
    header.append(copy, chip);
    card.append(header);

    const wrapper = make('div', 'speaking-panel');
    wrapper.append(
      group('Answer structure', item.answerStructure),
      group('Tips', item.tips),
      (() => {
        const section = make('section', 'speaking-group');
        section.append(make('h4', null, 'Useful vocabulary'));
        section.append(renderVocabulary(item.usefulVocabulary));
        return section;
      })(),
      group('Signposting language', item.signpostingLanguage),
      (() => {
        const section = make('section', 'speaking-group');
        section.append(make('h4', null, 'Self-check checklist'));
        const list = make('ul', 'speaking-self-check');
        item.selfCheck.forEach((point) => list.append(make('li', null, point)));
        section.append(list);
        return section;
      })()
    );
    card.append(wrapper);
    return card;
  };

  const renderSampleCard = (item) => {
    const card = make('section', 'completion-task-card speaking-sample-card');
    card.hidden = !state.sampleVisible;
    card.setAttribute('aria-hidden', String(!state.sampleVisible));
    card.append(make('h3', null, 'Sample Answer'), make('p', null, item.sampleAnswer));
    return card;
  };

  const renderSession = () => {
    const items = currentItems();
    const item = currentItem();
    if (!item) {
      showError(new Error('Speaking data unavailable.'));
      return;
    }

    if (state.currentIndex >= items.length) {
      state.currentIndex = 0;
    }

    state.sampleVisible = false;
    stopTimer('Ready', 'Ready');
    updatePartUi();
    updateUrl(state.part);
    el.promptCounter.textContent = `Prompt ${state.currentIndex + 1} of ${items.length}`;
    setProgress(((state.currentIndex + 1) / items.length) * 100);
    el.sampleToggle.disabled = false;
    el.next.disabled = false;
    el.sampleToggle.textContent = 'Show Sample Answer';
    el.sampleToggle.setAttribute('aria-expanded', 'false');
    el.next.disabled = false;
    el.restart.disabled = false;

    const layout = make('div', 'speaking-layout');
    layout.append(renderPromptCard(item), renderSupportCard(item));

    const sample = renderSampleCard(item);
    el.area.replaceChildren(layout, sample);
    el.area.querySelector('textarea')?.focus?.({ preventScroll: true });
  };

  const showLoading = () => {
    updatePartUi();
    el.restart.disabled = true;
    el.promptCounter.textContent = 'Loading prompt';
    el.timerDisplay.textContent = 'Ready';
    setProgress(0);
    const loading = make('div', 'practice-loading');
    const spinner = make('span', 'practice-loader');
    spinner.setAttribute('aria-hidden', 'true');
    loading.append(spinner, make('p', null, `Loading ${PART_CONFIG[state.part].name}...`));
    el.area.replaceChildren(loading);
    el.sampleToggle.disabled = true;
    el.next.disabled = true;
  };

  const showError = (error) => {
    stopTimer('Ready', 'Ready');
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.partName.textContent = 'Please retry';
    el.promptCounter.textContent = 'Not loaded';
    el.timerDisplay.textContent = 'Ready';
    setProgress(0);
    const box = make('div', 'practice-load-error');
    box.append(
      make('span', 'practice-load-error-icon', '!'),
      make('h3', null, 'We could not load the speaking simulator.'),
      make('p', null, error?.message || 'Please check the selected dataset and try again.')
    );
    const retry = make('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', () => loadPart(state.part));
    box.append(retry);
    el.area.replaceChildren(box);
    el.sampleToggle.disabled = true;
    el.next.disabled = true;
  };

  const validateArray = (items, field, label) => {
    if (!Array.isArray(items) || !items.length) {
      throw new Error(`Invalid dataset: ${label} must include a non-empty ${field} array.`);
    }
    items.forEach((value, index) => {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Invalid dataset: ${label} ${field}[${index}] must be a non-empty string.`);
      }
    });
  };

  const validateDataset = (part, data) => {
    const path = DATA_PATHS[part].replace('../', '');
    const config = PART_CONFIG[part];
    if (!Array.isArray(data)) throw new Error(`Invalid dataset: ${path} must contain an array.`);
    if (!data.length) throw new Error(`Invalid dataset: ${path} must not be empty.`);

    data.forEach((item, index) => {
      const label = `${path} item ${index + 1}`;
      const required = ['id', 'examKey', 'interfaceType', 'part', 'topic', 'status'];
      const requiredForPart = part === 2
        ? ['cueCardTitle', 'cueCardPrompt', 'bulletPoints', 'prepTime', 'speakingTime']
        : ['question', 'suggestedTime'];
      const requiredCommon = ['answerStructure', 'tips', 'usefulVocabulary', 'signpostingLanguage', 'sampleAnswer', 'selfCheck'];
      const missing = [...required, ...requiredForPart, ...requiredCommon].filter((field) => item?.[field] === undefined || item?.[field] === null || item?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);
      if (item.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status active.`);
      if (item.examKey !== 'ielts-speaking') throw new Error(`Invalid dataset: ${label} must use examKey ielts-speaking.`);
      if (item.interfaceType !== 'ielts-speaking') throw new Error(`Invalid dataset: ${label} must use interfaceType ielts-speaking.`);
      if (item.part !== part) throw new Error(`Invalid dataset: ${label} must match part ${part}.`);
      if (!item.id.startsWith(config.prefix)) throw new Error(`Invalid dataset: ${item.id} has the wrong id prefix.`);
      if (part === 2) {
        if (!Array.isArray(item.bulletPoints) || item.bulletPoints.length !== 4) {
          throw new Error(`Invalid dataset: ${label} must include exactly 4 bullet points.`);
        }
        validateArray(item.bulletPoints, 'bulletPoints', label);
      }
      ['answerStructure', 'tips', 'usefulVocabulary', 'signpostingLanguage', 'selfCheck'].forEach((field) => validateArray(item[field], field, label));
      if (typeof item.sampleAnswer !== 'string' || !item.sampleAnswer.trim()) {
        throw new Error(`Invalid dataset: ${label} sampleAnswer must be a non-empty string.`);
      }
      if (part === 2) {
        if (typeof item.cueCardTitle !== 'string' || !item.cueCardTitle.trim()) throw new Error(`Invalid dataset: ${label} cueCardTitle must be a non-empty string.`);
        if (typeof item.cueCardPrompt !== 'string' || !item.cueCardPrompt.trim()) throw new Error(`Invalid dataset: ${label} cueCardPrompt must be a non-empty string.`);
        if (!Number.isFinite(item.prepTime) || item.prepTime <= 0) throw new Error(`Invalid dataset: ${label} prepTime must be a positive number.`);
        if (!Number.isFinite(item.speakingTime) || item.speakingTime <= 0) throw new Error(`Invalid dataset: ${label} speakingTime must be a positive number.`);
      } else {
        if (typeof item.question !== 'string' || !item.question.trim()) throw new Error(`Invalid dataset: ${label} question must be a non-empty string.`);
        if (!Number.isFinite(item.suggestedTime) || item.suggestedTime <= 0) throw new Error(`Invalid dataset: ${label} suggestedTime must be a positive number.`);
      }
    });

    return data;
  };

  async function loadPart(part) {
    const requestVersion = ++state.loadVersion;
    showLoading();
    try {
      const response = await fetch(DATA_PATHS[part], { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATHS[part]} (${response.status}).`);
      const data = validateDataset(part, await response.json());
      if (requestVersion !== state.loadVersion || state.part !== part) return;
      state.datasets[part] = data;
      renderSession();
    } catch (error) {
      if (requestVersion !== state.loadVersion || state.part !== part) return;
      console.error('Exam Verse IELTS Speaking dataset validation failed:', error);
      showError(error);
    }
  }

  const switchPart = (part) => {
    if (!PART_CONFIG[part] || part === state.part) return;
    state.part = part;
    state.currentIndex = 0;
    state.notes = {};
    updateUrl(part);
    if (state.datasets[part]) {
      state.loadVersion += 1;
      renderSession();
    } else {
      loadPart(part);
    }
  };

  const nextPrompt = () => {
    const items = currentItems();
    if (!items.length) return;
    state.currentIndex = (state.currentIndex + 1) % items.length;
    state.sampleVisible = false;
    renderSession();
  };

  const restartPart = () => {
    state.currentIndex = 0;
    state.sampleVisible = false;
    state.notes = {};
    stopTimer('Ready', 'Ready');
    renderSession();
  };

  const toggleSample = () => {
    state.sampleVisible = !state.sampleVisible;
    const item = currentItem();
    if (!item) return;
    const sample = el.area.querySelector('.speaking-sample-card');
    if (sample) {
      sample.hidden = !state.sampleVisible;
      sample.setAttribute('aria-hidden', String(!state.sampleVisible));
    }
    el.sampleToggle.textContent = state.sampleVisible ? 'Hide Sample Answer' : 'Show Sample Answer';
    el.sampleToggle.setAttribute('aria-expanded', String(state.sampleVisible));
  };

  el.partCards.forEach((card) => {
    card.addEventListener('click', () => {
      switchPart(Number(card.dataset.part));
      document.querySelector('#speaking-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  el.sampleToggle.addEventListener('click', toggleSample);
  el.next.addEventListener('click', nextPrompt);
  el.restart.addEventListener('click', restartPart);

  updatePartUi();
  updateUrl(state.part);
  loadPart(state.part);
})();
