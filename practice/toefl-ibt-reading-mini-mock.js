(() => {
  'use strict';

  const DATA_PATHS = {
    completeWords: '../data/toefl-ibt/reading/complete-the-words.json',
    dailyLife: '../data/toefl-ibt/reading/read-in-daily-life.json',
    academic: '../data/toefl-ibt/reading/academic-passage.json'
  };
  const HUB_URL = '../pages/toefl-ibt.html';
  const COMPLETE_WORDS_URL = '../practice/toefl-ibt-complete-words.html#practice-shell';
  const DAILY_LIFE_URL = '../practice/toefl-ibt-reading.html?mode=daily-life#practice-shell';
  const ACADEMIC_URL = '../practice/toefl-ibt-reading.html?mode=academic#practice-shell';
  const TOTAL_TIME = 25 * 60;
  const TOTAL_ITEMS = 20;

  const TASKS = [
    { key: 'completeWords', title: 'Complete the Words', shortTitle: 'Complete the Words', count: 10, focusLabel: 'Word completion' },
    { key: 'dailyLife', title: 'Read in Daily Life', shortTitle: 'Read in Daily Life', count: 5, focusLabel: 'Practical reading' },
    { key: 'academic', title: 'Read an Academic Passage', shortTitle: 'Read an Academic Passage', count: 5, focusLabel: 'Academic reading' }
  ];

  const state = {
    loaded: false,
    started: false,
    submitted: false,
    remainingSeconds: TOTAL_TIME,
    timerId: null,
    reviewOpen: false,
    confirmOpen: false,
    activeTaskIndex: 0,
    focusItemId: null,
    answers: {},
    datasets: {
      completeWords: [],
      dailyLife: [],
      academic: []
    },
    selectedSets: null,
    items: []
  };

  const el = {
    sessionTitle: document.querySelector('#mock-session-title'),
    statusPill: document.querySelector('#mock-status-pill'),
    intro: document.querySelector('#mock-intro'),
    test: document.querySelector('#mock-test'),
    results: document.querySelector('#mock-results'),
    error: document.querySelector('#mock-error'),
    errorMessage: document.querySelector('#mock-error-message'),
    start: document.querySelector('#start-mini-mock'),
    timerMetric: document.querySelector('#mock-timer-metric'),
    timerDisplay: document.querySelector('#mock-timer-display'),
    timerStatus: document.querySelector('#mock-timer-status'),
    taskDisplay: document.querySelector('#mock-task-display'),
    taskSubtitle: document.querySelector('#mock-task-subtitle'),
    answeredDisplay: document.querySelector('#mock-answered-display'),
    progress: document.querySelector('#mock-progress'),
    progressBar: document.querySelector('#mock-progress-bar'),
    progressLabel: document.querySelector('#mock-progress-label'),
    taskTabs: document.querySelector('#mock-task-tabs'),
    navigator: document.querySelector('#mock-navigator'),
    contentTop: document.querySelector('#mock-content-top'),
    stage: document.querySelector('#mock-stage'),
    passageCard: document.querySelector('#mock-passage-card'),
    questionList: document.querySelector('#mock-question-list'),
    prevTask: document.querySelector('#mock-prev-task'),
    nextTask: document.querySelector('#mock-next-task'),
    restart: document.querySelector('#mock-restart'),
    submit: document.querySelector('#mock-submit'),
    reviewButton: document.querySelector('#review-answers-btn'),
    reviewPanel: document.querySelector('#mock-review-panel'),
    confirmPanel: document.querySelector('#mock-confirm-panel'),
    confirmBackdrop: document.querySelector('#mock-confirm-backdrop'),
    confirmText: document.querySelector('#mock-confirm-text'),
    continueButton: document.querySelector('#mock-continue'),
    submitNowButton: document.querySelector('#mock-submit-now'),
    retry: document.querySelector('#mock-retry')
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

  const formatTime = (seconds) => {
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60);
    const remaining = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  };

  const setVisible = (node, visible) => {
    if (node) node.hidden = !visible;
  };

  const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

  const requiredFields = (obj, fields) => fields.filter((field) => obj?.[field] === undefined || obj?.[field] === null || obj?.[field] === '');

  const validateCompleteWordsData = (data) => {
    if (!Array.isArray(data)) throw new Error('Complete the Words data must be an array.');
    const activeSets = data.filter((set) => set?.status === 'active');
    if (!activeSets.length) throw new Error('Complete the Words data must contain at least one active set.');

    activeSets.forEach((set, index) => {
      const label = set?.id || `complete-the-words set ${index + 1}`;
      const missing = requiredFields(set, ['id', 'examKey', 'exam', 'section', 'taskType', 'interfaceType', 'difficulty', 'title', 'instructions', 'passageTemplate', 'gaps', 'status']);
      if (missing.length) throw new Error(`${label} is missing ${missing.join(', ')}.`);
      if (set.examKey !== 'toefl-ibt' || set.section !== 'reading' || set.taskType !== 'complete-the-words' || set.interfaceType !== 'complete-the-words') {
        throw new Error(`${label} has invalid metadata.`);
      }
      if (!Array.isArray(set.gaps) || set.gaps.length !== 10) throw new Error(`${label} must contain exactly 10 gaps.`);

      const placeholderMatches = String(set.passageTemplate).match(/\{\{\d+\}\}/g) || [];
      const placeholderIds = placeholderMatches.map((token) => token.match(/\d+/)?.[0]).filter(Boolean);
      const placeholderSet = new Set(placeholderIds);
      if (placeholderIds.length !== 10 || placeholderSet.size !== 10 || !Array.from({ length: 10 }, (_, i) => String(i + 1)).every((id) => placeholderSet.has(id))) {
        throw new Error(`${label} passageTemplate must contain placeholders {{1}} through {{10}} exactly once.`);
      }

      const seenGapIds = new Set();
      set.gaps.forEach((gap, gapIndex) => {
        const gapLabel = `${label}, gap ${gapIndex + 1}`;
        const gapMissing = requiredFields(gap, ['id', 'prefix', 'missingLetters', 'fullWord', 'explanation']);
        if (gapMissing.length) throw new Error(`${gapLabel} is missing ${gapMissing.join(', ')}.`);
        if (seenGapIds.has(gap.id)) throw new Error(`${label} repeats gap id ${gap.id}.`);
        seenGapIds.add(gap.id);
        const suffix = gap.suffix ?? '';
        if (`${gap.prefix}${gap.missingLetters}${suffix}` !== gap.fullWord) {
          throw new Error(`${gapLabel} fullWord must equal prefix + missingLetters + optional suffix.`);
        }
      });
      if (seenGapIds.size !== 10) throw new Error(`${label} must have 10 unique gap ids.`);
      placeholderIds.forEach((id) => {
        if (!seenGapIds.has(id)) throw new Error(`${label} is missing a gap for placeholder {{${id}}}.`);
      });
    });

    return activeSets;
  };

  const validateMcqDataset = (data, label, expectedTaskType, expectedInterfaceType, expectedQuestionCount) => {
    if (!Array.isArray(data)) throw new Error(`${label} data must be an array.`);
    const activeSets = data.filter((set) => set?.status === 'active');
    if (!activeSets.length) throw new Error(`${label} data must contain at least one active set.`);

    activeSets.forEach((set, index) => {
      const setLabel = set?.id || `${label} set ${index + 1}`;
      const missing = requiredFields(set, ['id', 'examKey', 'exam', 'section', 'taskType', 'interfaceType', 'difficulty', 'title', 'passage', 'questions', 'status']);
      if (missing.length) throw new Error(`${setLabel} is missing ${missing.join(', ')}.`);
      if (set.examKey !== 'toefl-ibt' || set.section !== 'reading' || set.taskType !== expectedTaskType || set.interfaceType !== expectedInterfaceType) {
        throw new Error(`${setLabel} has invalid metadata.`);
      }
      if (!Array.isArray(set.questions) || set.questions.length !== expectedQuestionCount) {
        throw new Error(`${setLabel} must contain exactly ${expectedQuestionCount} questions.`);
      }

      const seenQuestionIds = new Set();
      set.questions.forEach((question, questionIndex) => {
        const questionLabel = `${setLabel}, question ${questionIndex + 1}`;
        const questionMissing = requiredFields(question, ['id', 'number', 'prompt', 'options', 'answer', 'evidence', 'explanation']);
        if (questionMissing.length) throw new Error(`${questionLabel} is missing ${questionMissing.join(', ')}.`);
        if (seenQuestionIds.has(question.id)) throw new Error(`${setLabel} repeats question id ${question.id}.`);
        seenQuestionIds.add(question.id);
        if (question.number !== questionIndex + 1) throw new Error(`${questionLabel} must be numbered ${questionIndex + 1}.`);
        if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`${questionLabel} must contain exactly four options.`);
        const optionIds = question.options.map((option) => option?.id);
        const uniqueOptionIds = new Set(optionIds);
        if (uniqueOptionIds.size !== 4 || !['A', 'B', 'C', 'D'].every((id) => uniqueOptionIds.has(id))) {
          throw new Error(`${questionLabel} must use option ids A, B, C, and D.`);
        }
        if (!question.options.every((option) => option?.text)) throw new Error(`${questionLabel} has an empty option.`);
        if (!uniqueOptionIds.has(question.answer)) throw new Error(`${questionLabel} answer must match one option id.`);
      });
    });

    return activeSets;
  };

  const buildItems = () => {
    if (!state.selectedSets) return [];
    const items = [];
    let globalNumber = 1;

    state.selectedSets.completeWords.gaps.forEach((gap, index) => {
      items.push({
        id: `ctw-${gap.id}`,
        taskIndex: 0,
        globalNumber,
        localNumber: index + 1,
        kind: 'gap',
        data: gap,
        set: state.selectedSets.completeWords
      });
      globalNumber += 1;
    });

    state.selectedSets.dailyLife.questions.forEach((question, index) => {
      items.push({
        id: `dl-${question.id}`,
        taskIndex: 1,
        globalNumber,
        localNumber: index + 1,
        kind: 'mcq',
        data: question,
        set: state.selectedSets.dailyLife
      });
      globalNumber += 1;
    });

    state.selectedSets.academic.questions.forEach((question, index) => {
      items.push({
        id: `ac-${question.id}`,
        taskIndex: 2,
        globalNumber,
        localNumber: index + 1,
        kind: 'mcq',
        data: question,
        set: state.selectedSets.academic
      });
      globalNumber += 1;
    });

    return items;
  };

  const allItems = () => state.items;
  const taskItems = (taskIndex) => allItems().filter((item) => item.taskIndex === taskIndex);
  const getItem = (itemId) => allItems().find((item) => item.id === itemId);
  const answeredCount = () => allItems().filter((item) => normalize(state.answers[item.id])).length;
  const unansweredCount = () => allItems().length - answeredCount();
  const taskAnsweredCount = (taskIndex) => taskItems(taskIndex).filter((item) => normalize(state.answers[item.id])).length;
  const taskUnansweredItems = (taskIndex) => taskItems(taskIndex).filter((item) => !normalize(state.answers[item.id]));

  const updateTimerState = () => {
    el.timerDisplay.textContent = formatTime(state.remainingSeconds);
    el.timerMetric.classList.toggle('mini-mock-timer-warning', state.remainingSeconds <= 300 && state.remainingSeconds > 60);
    el.timerMetric.classList.toggle('mini-mock-timer-urgent', state.remainingSeconds <= 60);
    el.timerStatus.textContent =
      state.remainingSeconds <= 0 ? 'Time is up' :
      state.remainingSeconds <= 60 ? 'Urgent' :
      state.remainingSeconds <= 300 ? 'Warning' :
      state.started ? 'In progress' : 'Ready to start';
    el.statusPill.textContent =
      state.remainingSeconds <= 0 ? 'Finished' :
      state.remainingSeconds <= 60 ? 'Urgent' :
      state.remainingSeconds <= 300 ? 'Warning' :
      state.started ? 'Timed' : 'Ready';
  };

  const updateProgress = () => {
    const total = allItems().length || TOTAL_ITEMS;
    const done = answeredCount();
    const percent = total ? Math.round((done / total) * 100) : 0;
    el.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    el.progress.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, percent))));
    el.answeredDisplay.textContent = `${done} / ${total}`;
    el.progressLabel.textContent = done ? `${done} answered` : 'No answers yet';
  };

  const updateTaskMetric = () => {
    const task = TASKS[state.activeTaskIndex];
    const set = state.selectedSets?.[task.key];
    el.taskDisplay.textContent = `Task ${state.activeTaskIndex + 1} of 3`;
    el.taskSubtitle.textContent = set?.title || task.shortTitle;
  };

  const updateTaskTabs = () => {
    el.taskTabs.replaceChildren();
    TASKS.forEach((task, index) => {
      const button = create('button', 'mini-mock-summary-card ibt-mini-mock-task-tab');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(index === state.activeTaskIndex));
      button.classList.toggle('active', index === state.activeTaskIndex);
      button.append(
        create('span', null, `Task ${index + 1}`),
        create('strong', null, task.title),
        create('small', null, `${task.count} items`)
      );
      button.addEventListener('click', () => switchTask(index));
      el.taskTabs.append(button);
    });
  };

  const updateNavigator = () => {
    el.navigator.replaceChildren();
    allItems().forEach((item) => {
      const button = create('button', 'mini-mock-nav-btn');
      button.type = 'button';
      const answered = Boolean(normalize(state.answers[item.id]));
      button.textContent = String(item.globalNumber);
      button.classList.toggle('answered', answered);
      button.classList.toggle('unanswered', !answered);
      button.classList.toggle('current-set', item.taskIndex === state.activeTaskIndex);
      button.classList.toggle('focused', state.focusItemId === item.id);
      button.setAttribute('aria-label', `Question ${item.globalNumber} ${answered ? 'answered' : 'unanswered'}`);
      button.addEventListener('click', () => jumpToItem(item.id));
      el.navigator.append(button);
    });
  };

  const renderCompleteWord = (item) => {
    const gap = item.data;
    const word = create('span', 'complete-word');
    word.dataset.itemId = item.id;
    if (state.submitted) {
      const isCorrect = normalize(state.answers[item.id]) === normalize(gap.missingLetters);
      word.classList.add(isCorrect ? 'complete-word-correct' : 'complete-word-wrong', isCorrect ? 'correct' : 'wrong');
    }

    const prefix = create('span', 'complete-word-prefix', gap.prefix);
    const input = create('input', 'complete-word-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.inputMode = 'text';
    input.maxLength = Math.max(1, gap.missingLetters.length);
    input.style.width = `${Math.max(gap.missingLetters.length, 1.8)}ch`;
    input.value = state.answers[item.id] || '';
    input.setAttribute('aria-label', `Question ${item.globalNumber}, missing letters`);
    if (state.submitted) {
      input.readOnly = true;
      input.setAttribute('aria-invalid', String(normalize(state.answers[item.id]) !== normalize(gap.missingLetters)));
    }
    input.addEventListener('input', () => {
      if (state.submitted) return;
      state.answers[item.id] = input.value;
      updateProgress();
      updateNavigator();
      if (state.reviewOpen) updateReviewPanel();
    });

    word.append(prefix, input);
    if (gap.suffix) word.append(create('span', 'complete-word-suffix', gap.suffix));
    return word;
  };

  const renderCompleteWordsTask = () => {
    const set = state.selectedSets.completeWords;
    const task = TASKS[0];
    el.contentTop.replaceChildren(
      create('span', 'completion-difficulty', set.difficulty),
      create('span', 'completion-type', task.focusLabel),
      create('span', 'completion-word-limit', '10 blanks')
    );

    el.passageCard.replaceChildren(
      create('span', 'section-kicker', 'Task 1'),
      Object.assign(create('h3', 'completion-passage-title'), { id: 'mock-passage-title', textContent: set.title }),
      create('p', 'complete-words-instructions', set.instructions),
      (() => {
        const passage = create('p', 'complete-words-passage');
        const parts = String(set.passageTemplate).split(/(\{\{\d+\}\})/);
        parts.forEach((part) => {
          const match = part.match(/^\{\{(\d+)\}\}$/);
          if (!match) {
            passage.append(document.createTextNode(part));
            return;
          }
          const gap = set.gaps.find((entry) => entry.id === match[1]);
          if (gap) passage.append(renderCompleteWord({
            id: `ctw-${gap.id}`,
            taskIndex: 0,
            globalNumber: Number(match[1]),
            data: gap
          }));
        });
        return passage;
      })(),
      create('p', 'mini-mock-note', 'Type only the missing letters. Each blank stays inline with the passage.')
    );
    el.questionList.replaceChildren();
  };

  const answerLabel = (question, value) => question.options.find((option) => option.id === value)?.text || value || 'No answer';

  const renderMcqQuestion = (item) => {
    const question = item.data;
    const card = create('article', 'daily-life-question-card mini-mock-question-card');
    card.dataset.itemId = item.id;
    if (state.submitted) {
      const isCorrect = normalize(state.answers[item.id]) === normalize(question.answer);
      card.classList.add(isCorrect ? 'correct' : state.answers[item.id] ? 'wrong' : 'unanswered');
    }

    const header = create('div', 'daily-life-question-header');
    header.append(
      create('span', 'daily-life-question-number', `Question ${item.globalNumber}`),
      create('span', 'mini-mock-skill', TASKS[item.taskIndex].focusLabel),
      create('h3', null, question.prompt)
    );

    const options = create('div', 'daily-life-option-grid');
    question.options.forEach((option) => {
      const button = create('button', 'daily-life-option mini-mock-option');
      button.type = 'button';
      button.dataset.optionId = option.id;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Question ${item.globalNumber} option ${option.id}: ${option.text}`);
      button.append(
        create('span', 'daily-life-option-key', option.id),
        create('span', 'daily-life-option-text', option.text)
      );
      const selected = normalize(state.answers[item.id]) === normalize(option.id);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      if (state.submitted) button.disabled = true;
      button.addEventListener('click', () => selectAnswer(item.id, option.id));
      options.append(button);
    });

    card.append(header, options);
    return card;
  };

  const renderTask = (focusItemId = null) => {
    const task = TASKS[state.activeTaskIndex];
    const set = state.selectedSets[task.key];
    if (!set) return;

    state.focusItemId = focusItemId;
    updateTaskTabs();
    updateTaskMetric();
    updateNavigator();
    updateProgress();

    if (task.key === 'completeWords') {
      renderCompleteWordsTask();
      return;
    }

    el.contentTop.replaceChildren(
      create('span', 'completion-difficulty', set.difficulty),
      create('span', 'completion-type', set.textType || set.discipline || task.focusLabel),
      create('span', 'completion-word-limit', `${task.count} ${task.count === 1 ? 'question' : 'questions'}`)
    );

    el.passageCard.replaceChildren(
      create('span', 'section-kicker', `Task ${state.activeTaskIndex + 1}`),
      Object.assign(create('h3', 'completion-passage-title'), { id: 'mock-passage-title', textContent: set.title }),
      create('p', 'complete-words-instructions', set.instructions || 'Read the passage and choose the best answer for each question.'),
      ...String(set.passage).split(/\n\s*\n/).map((part) => create('p', 'daily-life-passage', part.trim())).filter((node) => node.textContent)
    );
    el.questionList.replaceChildren(...set.questions.map((question, index) => renderMcqQuestion({
      id: `${task.key}-${question.id}`,
      taskIndex: state.activeTaskIndex,
      globalNumber: allItems().find((item) => item.taskIndex === state.activeTaskIndex && item.localNumber === index + 1)?.globalNumber || (state.activeTaskIndex === 1 ? 10 + index + 1 : 15 + index + 1),
      data: question
    })));
  };

  const focusRenderedItem = (itemId) => {
    if (!itemId) return;
    const item = getItem(itemId);
    if (!item) return;
    const selector = `[data-item-id="${itemId}"]`;
    const card = el.stage.querySelector(selector);
    if (!card) return;

    const selected = state.answers[itemId];
    const focusTarget = item.kind === 'gap'
      ? card.querySelector('.complete-word-input')
      : (selected
        ? card.querySelector(`.daily-life-option[data-option-id="${selected}"]`)
        : card.querySelector('.daily-life-option'));
    window.requestAnimationFrame(() => {
      focusTarget?.focus?.();
      card.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });
  };

  const renderCurrentTask = (focusItemId = null) => {
    renderTask(focusItemId);
    updateTaskTabs();
    updateTaskMetric();
    updateTaskButtons();
    if (focusItemId) focusRenderedItem(focusItemId);
  };

  const selectAnswer = (itemId, answer) => {
    if (state.submitted) return;
    state.answers[itemId] = answer;
    const card = el.questionList.querySelector(`[data-item-id="${itemId}"]`);
    if (card) {
      card.querySelectorAll('.daily-life-option').forEach((button) => {
        const selected = button.dataset.optionId === answer;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    updateProgress();
    updateNavigator();
    if (state.reviewOpen) updateReviewPanel();
  };

  const jumpToItem = (itemId) => {
    const item = getItem(itemId);
    if (!item) return;
    state.activeTaskIndex = item.taskIndex;
    state.focusItemId = itemId;
    renderCurrentTask(itemId);
    updateNavigator();
  };

  const switchTask = (taskIndex, focusItemId = null) => {
    if (taskIndex < 0 || taskIndex >= TASKS.length) return;
    state.activeTaskIndex = taskIndex;
    state.focusItemId = focusItemId;
    renderCurrentTask(focusItemId);
    if (state.reviewOpen) updateReviewPanel();
  };

  const updateReviewPanel = () => {
    if (!state.reviewOpen) return;
    const summary = create('div', 'mini-mock-review-summary', `Answered ${answeredCount()} of ${allItems().length} items.`);
    const groups = TASKS.map((task, index) => {
      const group = create('article', 'mini-mock-review-group');
      const unanswered = taskUnansweredItems(index);
      group.append(create('div', 'mini-mock-review-group-head', `Task ${index + 1}. ${task.title} - ${unanswered.length} unanswered`));
      const chips = create('div', 'mini-mock-review-questions');
      if (!unanswered.length) {
        chips.append(create('p', 'mini-mock-review-summary', 'All items answered.'));
      } else {
        unanswered.forEach((item) => {
          const button = create('button', 'mini-mock-review-chip unanswered');
          button.type = 'button';
          button.textContent = String(item.globalNumber);
          button.setAttribute('aria-label', `Question ${item.globalNumber} unanswered`);
          button.addEventListener('click', () => jumpToItem(item.id));
          chips.append(button);
        });
      }
      group.append(chips);
      return group;
    });
    el.reviewPanel.replaceChildren(summary, ...groups);
  };

  const openReviewPanel = () => {
    state.reviewOpen = !state.reviewOpen;
    el.reviewPanel.hidden = !state.reviewOpen;
    el.reviewButton.textContent = state.reviewOpen ? 'Close Review' : 'Review Answers';
    if (state.reviewOpen) updateReviewPanel();
  };

  const openConfirmPanel = () => {
    if (!state.started || state.submitted) return;
    state.confirmOpen = true;
    el.confirmText.textContent = unansweredCount()
      ? `You still have ${unansweredCount()} unanswered questions.`
      : 'All 20 questions are filled in. Submit now?';
    el.confirmPanel.hidden = false;
    el.confirmPanel.classList.add('is-open');
    el.confirmPanel.setAttribute('aria-hidden', 'false');
    el.continueButton.focus();
  };

  const closeConfirmPanel = () => {
    state.confirmOpen = false;
    el.confirmPanel.classList.remove('is-open');
    el.confirmPanel.hidden = true;
    el.confirmPanel.setAttribute('aria-hidden', 'true');
  };

  const stopTimer = () => {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    state.timerId = window.setInterval(() => {
      state.remainingSeconds -= 1;
      updateTimerState();
      if (state.remainingSeconds <= 0) {
        submitTest(true);
      }
    }, 1000);
  };

  const buildReviewCardForGap = (item) => {
    const gap = item.data;
    const selected = state.answers[item.id] || '';
    const correct = normalize(selected) === normalize(gap.missingLetters);
    const card = create('article', `mini-mock-review-card ${correct ? 'correct' : selected ? 'wrong' : 'unanswered'}`);
    const header = create('div', 'mini-mock-review-header');
    header.append(
      create('span', 'mini-mock-review-number', `Question ${item.globalNumber}`),
      create('span', 'mini-mock-review-skill', 'Word completion'),
      create('span', `mini-mock-review-status ${correct ? 'correct' : selected ? 'wrong' : 'unanswered'}`, correct ? 'Correct' : selected ? 'Incorrect' : 'Not Answered')
    );
    const prompt = create('p', 'mini-mock-review-question', item.set.title);
    const answers = create('div', 'mini-mock-review-answers');
    const student = create('div');
    student.append(create('span', null, 'Student answer'), create('strong', correct ? 'correct' : selected ? 'wrong' : 'unanswered', selected || 'No answer'));
    const correctAnswer = create('div');
    correctAnswer.append(create('span', null, 'Correct missing letters'), create('strong', 'correct', gap.missingLetters));
    answers.append(student, correctAnswer);
    const word = create('p', 'mini-mock-review-evidence');
    word.append(create('strong', null, 'Full word: '), document.createTextNode(gap.fullWord));
    const explanation = create('p', 'mini-mock-review-explanation');
    explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(gap.explanation));
    card.append(header, prompt, answers, word, explanation);
    return card;
  };

  const buildReviewCardForMcq = (item) => {
    const question = item.data;
    const selected = state.answers[item.id] || '';
    const correct = normalize(selected) === normalize(question.answer);
    const card = create('article', `mini-mock-review-card ${correct ? 'correct' : selected ? 'wrong' : 'unanswered'}`);
    const header = create('div', 'mini-mock-review-header');
    header.append(
      create('span', 'mini-mock-review-number', `Question ${item.globalNumber}`),
      create('span', 'mini-mock-review-skill', TASKS[item.taskIndex].focusLabel),
      create('span', `mini-mock-review-status ${correct ? 'correct' : selected ? 'wrong' : 'unanswered'}`, correct ? 'Correct' : selected ? 'Incorrect' : 'Not Answered')
    );
    const prompt = create('p', 'mini-mock-review-question', question.prompt);
    const answers = create('div', 'mini-mock-review-answers');
    const student = create('div');
    student.append(create('span', null, 'Student answer'), create('strong', correct ? 'correct' : selected ? 'wrong' : 'unanswered', answerLabel(question, selected)));
    const correctAnswer = create('div');
    correctAnswer.append(create('span', null, 'Correct answer'), create('strong', 'correct', answerLabel(question, question.answer)));
    answers.append(student, correctAnswer);
    const evidence = create('p', 'mini-mock-review-evidence');
    evidence.append(create('strong', null, 'Evidence: '), document.createTextNode(question.evidence));
    const explanation = create('p', 'mini-mock-review-explanation');
    explanation.append(create('strong', null, 'Explanation: '), document.createTextNode(question.explanation));
    card.append(header, prompt, answers, evidence, explanation);
    return card;
  };

  const renderResults = () => {
    const total = allItems().length;
    const correctCount = allItems().filter((item) => {
      const selected = state.answers[item.id];
      if (!selected) return false;
      if (item.kind === 'gap') return normalize(selected) === normalize(item.data.missingLetters);
      return normalize(selected) === normalize(item.data.answer);
    }).length;
    const incorrectCount = allItems().filter((item) => normalize(state.answers[item.id]) && !(
      item.kind === 'gap'
        ? normalize(state.answers[item.id]) === normalize(item.data.missingLetters)
        : normalize(state.answers[item.id]) === normalize(item.data.answer)
    )).length;
    const unanswered = total - answeredCount();
    const usedSeconds = TOTAL_TIME - state.remainingSeconds;
    const accuracy = total ? Math.round((correctCount / total) * 100) : 0;

    el.results.replaceChildren();

    const summary = create('section', 'mini-mock-results-summary');
    summary.append(
      create('span', 'section-kicker', 'Mini mock results'),
      create('h3', null, `${correctCount} / ${total} correct`),
      create('p', null, `${accuracy}% accuracy`),
      create('p', 'mini-mock-results-message', performanceMessage(correctCount, total))
    );

    const grid = create('div', 'mini-mock-results-grid');
    [
      ['Correct answers', String(correctCount), 'correct'],
      ['Incorrect answers', String(incorrectCount), 'wrong'],
      ['Unanswered items', String(unanswered), 'unanswered'],
      ['Time used', formatTime(usedSeconds), 'time']
    ].forEach(([label, value, tone]) => {
      const stat = create('div', `mini-mock-result-stat ${tone}`);
      stat.append(create('span', null, label), create('strong', null, value));
      grid.append(stat);
    });

    const linksSection = create('section', 'skill-practice-section');
    const linksWrap = create('div', 'skill-practice-header');
    const linksHeadCopy = create('div');
    linksHeadCopy.append(create('span', 'section-kicker', 'Continue practicing'), create('h3', 'section-title', 'Jump back into the individual reading tasks'));
    linksWrap.append(linksHeadCopy, create('p', 'section-description', 'Use the direct practice links below to work on each task in isolation.'));
    linksSection.append(linksWrap);
    const linkGrid = create('div', 'skill-practice-grid featured');
    [
      ['R26.01', 'Complete the Words', 'Practice the inline missing-letter passage.', COMPLETE_WORDS_URL],
      ['R26.02', 'Read in Daily Life', 'Practice the practical reading set on its own.', DAILY_LIFE_URL],
      ['R26.03', 'Read an Academic Passage', 'Practice the academic passage with evidence-based questions.', ACADEMIC_URL]
    ].forEach(([code, title, description, href]) => {
      const card = create('a', 'skill-practice-card reveal');
      card.href = href;
      card.setAttribute('aria-label', `Open TOEFL iBT ${title} practice`);
      card.append(
        create('span', 'skill-practice-code', code),
        create('h3', null, title),
        create('p', null, description),
        create('span', 'skill-practice-status skill-practice-status-live', 'Practice Now')
      );
      linkGrid.append(card);
    });
    linksSection.append(linkGrid);

    const review = create('section', 'mini-mock-final-review');
    review.append(create('h4', null, 'Detailed Review'));
    [
      { title: 'Complete the Words', items: taskItems(0), builder: buildReviewCardForGap },
      { title: 'Read in Daily Life', items: taskItems(1), builder: buildReviewCardForMcq },
      { title: 'Read an Academic Passage', items: taskItems(2), builder: buildReviewCardForMcq }
    ].forEach((section) => {
      const group = create('article', 'mini-mock-final-group');
      group.append(create('div', 'mini-mock-final-group-head', section.title));
      section.items.forEach((item) => {
        group.append(section.builder(item));
      });
      review.append(group);
    });

    const actions = create('div', 'practice-actions mini-mock-result-actions');
    const restart = create('button', 'button', 'Restart Mini Mock');
    restart.type = 'button';
    restart.addEventListener('click', resetMock);
    const hubLink = create('a', 'practice-hub-link', null);
    hubLink.href = HUB_URL;
    hubLink.append(create('span', null, '\u2190'), document.createTextNode(' Back to TOEFL iBT Hub'));
    actions.append(restart, hubLink);

    el.results.append(summary, grid, linksSection, review, actions);
    setVisible(el.results, true);
    setVisible(el.test, false);
  };

  const performanceMessage = (score, total) => {
    const ratio = total ? score / total : 0;
    if (ratio >= 0.85) return 'Excellent control of the mixed reading tasks. Keep the pace and accuracy going.';
    if (ratio >= 0.7) return 'Strong performance. Review the wrong items and keep building speed.';
    if (ratio >= 0.5) return 'Solid progress, with a few task types still needing attention.';
    return 'More focused reading practice would help before another timed mock.';
  };

  const finalizeSubmission = (auto = false) => {
    if (state.submitted) return;
    state.submitted = true;
    state.started = false;
    closeConfirmPanel();
    state.reviewOpen = false;
    el.reviewPanel.hidden = true;
    el.reviewButton.textContent = 'Review Answers';
    stopTimer();
    updateTimerState();
    el.sessionTitle.textContent = 'TOEFL iBT Reading Mini Mock Review';
    el.taskDisplay.textContent = 'Review mode';
    el.taskSubtitle.textContent = 'Detailed results';
    renderResults();
    el.statusPill.textContent = auto ? 'Time up' : 'Submitted';
  };

  const submitTest = (auto = false) => {
    if (state.submitted) return;
    if (!auto) {
      openConfirmPanel();
      return;
    }
    finalizeSubmission(true);
  };

  const prepareAttempt = () => {
    const completeWords = pickRandom(state.datasets.completeWords);
    const dailyLife = pickRandom(state.datasets.dailyLife);
    const academic = pickRandom(state.datasets.academic);
    state.selectedSets = { completeWords, dailyLife, academic };
    state.items = buildItems();
    state.answers = {};
    state.activeTaskIndex = 0;
    state.focusItemId = null;
    state.reviewOpen = false;
    state.confirmOpen = false;
  };

  const renderIntro = () => {
    setVisible(el.intro, true);
    setVisible(el.test, false);
    setVisible(el.results, false);
    setVisible(el.reviewPanel, false);
    setVisible(el.error, false);
    closeConfirmPanel();
    el.sessionTitle.textContent = 'TOEFL iBT Reading Mini Mock';
    el.statusPill.textContent = state.loaded ? 'Ready' : 'Preparing data';
    el.start.disabled = !state.loaded;
    el.start.textContent = 'Start Mini Mock';
    updateTimerState();
    updateProgress();
  };

  const resetMock = () => {
    stopTimer();
    state.started = false;
    state.submitted = false;
    state.remainingSeconds = TOTAL_TIME;
    state.reviewOpen = false;
    state.confirmOpen = false;
    state.activeTaskIndex = 0;
    state.focusItemId = null;
    state.selectedSets = null;
    state.items = [];
    state.answers = {};
    el.reviewButton.textContent = 'Review Answers';
    renderIntro();
  };

  const startMock = () => {
    if (!state.loaded) return;
    prepareAttempt();
    state.started = true;
    state.submitted = false;
    state.remainingSeconds = TOTAL_TIME;
    setVisible(el.intro, false);
    setVisible(el.results, false);
    setVisible(el.test, true);
    el.reviewPanel.hidden = true;
    el.reviewButton.textContent = 'Review Answers';
    updateTimerState();
    updateProgress();
    renderCurrentTask();
    startTimer();
    el.statusPill.textContent = 'Timed';
  };

  const showError = (error) => {
    setVisible(el.intro, false);
    setVisible(el.test, false);
    setVisible(el.results, false);
    setVisible(el.reviewPanel, false);
    closeConfirmPanel();
    el.reviewButton.textContent = 'Review Answers';
    el.error.hidden = false;
    el.errorMessage.textContent = error?.message || 'Please check the dataset and try again.';
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.statusPill.textContent = 'Error';
  };

  async function loadDatasets() {
    el.start.disabled = true;
    try {
      const [completeWordsResponse, dailyLifeResponse, academicResponse] = await Promise.all([
        fetch(DATA_PATHS.completeWords, { cache: 'no-store' }),
        fetch(DATA_PATHS.dailyLife, { cache: 'no-store' }),
        fetch(DATA_PATHS.academic, { cache: 'no-store' })
      ]);
      if (!completeWordsResponse.ok) throw new Error(`Could not load ${DATA_PATHS.completeWords} (${completeWordsResponse.status}).`);
      if (!dailyLifeResponse.ok) throw new Error(`Could not load ${DATA_PATHS.dailyLife} (${dailyLifeResponse.status}).`);
      if (!academicResponse.ok) throw new Error(`Could not load ${DATA_PATHS.academic} (${academicResponse.status}).`);

      state.datasets.completeWords = validateCompleteWordsData(await completeWordsResponse.json());
      state.datasets.dailyLife = validateMcqDataset(await dailyLifeResponse.json(), 'Daily Life', 'read-in-daily-life', 'daily-life-reading', 5);
      state.datasets.academic = validateMcqDataset(await academicResponse.json(), 'Academic Passage', 'read-an-academic-passage', 'academic-passage-reading', 5);
      state.loaded = true;
      el.error.hidden = true;
      resetMock();
    } catch (error) {
      console.error('Exam Verse TOEFL iBT reading mini mock dataset validation failed:', error);
      showError(error);
    }
  }

  const updateTaskButtons = () => {
    el.prevTask.disabled = state.activeTaskIndex === 0;
    el.nextTask.disabled = state.activeTaskIndex === TASKS.length - 1;
    el.nextTask.textContent = state.activeTaskIndex === TASKS.length - 1 ? 'Last Task' : 'Next Task';
  };

  el.start.addEventListener('click', startMock);
  el.prevTask.addEventListener('click', () => switchTask(Math.max(0, state.activeTaskIndex - 1)));
  el.nextTask.addEventListener('click', () => switchTask(Math.min(TASKS.length - 1, state.activeTaskIndex + 1)));
  el.restart.addEventListener('click', resetMock);
  el.submit.addEventListener('click', () => submitTest(false));
  el.reviewButton.addEventListener('click', openReviewPanel);
  el.continueButton.addEventListener('click', closeConfirmPanel);
  el.submitNowButton.addEventListener('click', () => finalizeSubmission(false));
  el.confirmBackdrop.addEventListener('click', closeConfirmPanel);
  el.retry.addEventListener('click', loadDatasets);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !el.confirmPanel.hidden) {
      closeConfirmPanel();
    }
  });

  updateTimerState();
  updateProgress();
  renderIntro();
  loadDatasets();
})();
