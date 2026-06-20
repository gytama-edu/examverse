(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/matching-sentence-endings.json',
    general: '../data/ielts-general/reading/matching-sentence-endings.json'
  };

  const TYPE = 'sentence-endings';
  const PREFIXES = {
    academic: 'ielts-ac-mse-',
    general: 'ielts-gt-mse-'
  };

  const CONFIG = {
    academic: {
      name: 'IELTS Academic',
      mode: 'Academic',
      title: 'Academic Matching Sentence Endings',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub'
    },
    general: {
      name: 'IELTS General Training',
      mode: 'General Training',
      title: 'General Training Matching Sentence Endings',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub'
    }
  };

  const requested = new URLSearchParams(window.location.search).get('exam');
  const initialExam = Object.prototype.hasOwnProperty.call(CONFIG, requested) ? requested : 'academic';

  const state = {
    datasets: {},
    exam: initialExam,
    currentSetIndex: 0,
    selectedAnswers: {},
    score: 0,
    totalAnswered: 0,
    answered: false,
    loaded: false,
    wrongAnswers: []
  };

  const el = {
    cards: [...document.querySelectorAll('[data-exam]')],
    title: document.querySelector('#mse-session-title'),
    exam: document.querySelector('#mse-exam-name'),
    counter: document.querySelector('#mse-set-counter'),
    score: document.querySelector('#mse-score-count'),
    progress: document.querySelector('#mse-progress'),
    bar: document.querySelector('#mse-progress-bar'),
    area: document.querySelector('#mse-question-area'),
    feedback: document.querySelector('#mse-feedback'),
    check: document.querySelector('#mse-check-answer'),
    next: document.querySelector('#mse-next-set'),
    restart: document.querySelector('#mse-restart'),
    hub: document.querySelector('#mse-hub-link'),
    hubLabel: document.querySelector('#mse-hub-label')
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const sets = () => state.datasets[state.exam] || [];
  const current = () => sets()[state.currentSetIndex];
  const optionText = (set, id) => set.options.find(option => option.id === id)?.text || id;

  const setProgress = value => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    el.bar.style.width = `${safeValue}%`;
    el.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateUrl = exam => {
    const url = new URL(window.location.href);
    url.searchParams.set('exam', exam);
    url.hash = 'practice-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updateExamUi = () => {
    const config = CONFIG[state.exam];
    el.cards.forEach(card => {
      const active = card.dataset.exam === state.exam;
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.primary-nav a[href="../pages/ielts-academic.html"], .primary-nav a[href="../pages/ielts-general.html"]').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === config.hub);
    });
    el.title.textContent = config.title;
    el.exam.textContent = config.name;
    el.hub.href = config.hub;
    el.hubLabel.textContent = config.hubLabel;
  };

  const updateCheck = () => {
    const set = current();
    el.check.disabled = !set || set.items.some(item => !state.selectedAnswers[item.id]);
  };

  const createSelect = (set, item, index) => {
    const select = make('select', 'matching-engine-select');
    select.id = `mse-answer-${state.currentSetIndex}-${item.id}`;
    select.dataset.item = item.id;
    select.setAttribute('aria-label', `Choose an ending for item ${index + 1}`);

    const first = make('option', null, 'Select an ending...');
    first.value = '';
    select.append(first);

    set.options.forEach(option => {
      const choice = make('option', null, `${option.id}. ${option.text}`);
      choice.value = option.id;
      select.append(choice);
    });

    select.addEventListener('change', () => {
      state.selectedAnswers[item.id] = select.value;
      updateCheck();
    });

    return select;
  };

  const renderSet = () => {
    const collection = sets();
    const set = current();
    if (!set) {
      showResults();
      return;
    }

    state.selectedAnswers = {};
    state.answered = false;
    updateExamUi();
    el.counter.textContent = `Set ${state.currentSetIndex + 1} of ${collection.length}`;
    el.score.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress((state.currentSetIndex / collection.length) * 100);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = false;
    el.check.disabled = true;
    el.next.hidden = true;
    el.next.textContent = 'Next Set →';

    const top = make('div', 'matching-engine-content-top');
    top.append(
      make('span', 'matching-engine-difficulty', set.difficulty),
      make('span', 'matching-engine-type', 'Sentence endings')
    );

    const passage = make('section', 'matching-engine-passage-card');
    passage.append(
      make('span', 'section-kicker', 'Reading passage'),
      make('h3', 'matching-engine-passage-title', set.passageTitle)
    );
    const passageText = make('div', 'matching-engine-passage-text');
    set.passage.split(/\n\s*\n/).forEach(part => passageText.append(make('p', null, part)));
    passage.append(passageText);

    const bank = make('section', 'matching-engine-option-bank');
    bank.append(make('h4', null, 'Ending Bank'));
    const bankGrid = make('div', 'matching-engine-option-grid endings');
    set.options.forEach(option => {
      const item = make('div', 'matching-engine-option-item');
      item.append(make('span', null, option.id), make('p', null, option.text));
      bankGrid.append(item);
    });
    bank.append(bankGrid);

    const task = make('section', 'matching-engine-task-card');
    task.append(make('p', 'matching-engine-instructions', set.instructions));
    set.items.forEach((item, index) => {
      const row = make('div', 'matching-engine-row');
      row.dataset.item = item.id;

      const prompt = make('div', 'matching-engine-prompt');
      prompt.append(make('span', null, String(index + 1)), make('p', null, item.prompt));

      const control = make('div', 'matching-engine-control');
      const label = make('label', null, `Ending for item ${index + 1}`);
      const select = createSelect(set, item, index);
      label.htmlFor = select.id;
      control.append(label, select);

      row.append(prompt, control);
      task.append(row);
    });

    el.area.replaceChildren(top, passage, bank, task);
  };

  const checkAnswers = () => {
    if (state.answered || el.check.disabled) return;
    const set = current();
    let gained = 0;
    state.answered = true;

    set.items.forEach(item => {
      const chosen = state.selectedAnswers[item.id];
      const correct = chosen === item.answer;

      if (correct) {
        state.score += 1;
        gained += 1;
      } else {
        state.wrongAnswers.push({
          setNumber: state.currentSetIndex + 1,
          passageTitle: set.passageTitle,
          prompt: item.prompt,
          student: optionText(set, chosen),
          correct: optionText(set, item.answer),
          evidence: item.evidence || '',
          explanation: item.explanation
        });
      }

      state.totalAnswered += 1;

      const row = el.area.querySelector(`.matching-engine-row[data-item="${item.id}"]`);
      row.classList.add(correct ? 'correct' : 'wrong');
      row.querySelector('select').disabled = true;

      const note = make('div', 'matching-engine-explanation');
      note.append(
        make('strong', null, correct ? 'Correct match' : `Correct: ${optionText(set, item.answer)}`),
        make('p', null, item.explanation)
      );
      row.append(note);

      if (item.evidence) {
        const evidence = make('div', 'matching-engine-evidence');
        evidence.append(make('span', null, 'Evidence'), make('p', null, item.evidence));
        row.append(evidence);
      }
    });

    el.score.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress(((state.currentSetIndex + 1) / sets().length) * 100);
    el.feedback.replaceChildren(
      make('strong', null, `${gained} of ${set.items.length} matches correct.`),
      make('span', null, 'Review each completed sentence before continuing.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === sets().length - 1 ? 'View Results →' : 'Next Set →';
    el.next.focus();
  };

  const nextSet = () => {
    if (!state.answered) return;
    if (state.currentSetIndex >= sets().length - 1) {
      showResults();
      return;
    }
    state.currentSetIndex += 1;
    renderSet();
    el.area.focus();
  };

  const teacherMessage = percentage => {
    if (percentage >= 90) return 'Excellent control. You are using grammar, meaning, and evidence together very reliably.';
    if (percentage >= 70) return 'Strong work. Review the endings where two options were grammatically possible.';
    if (percentage >= 50) return 'A useful start. Predict the missing idea before reading the ending bank.';
    return 'Keep building the method. Match the complete thought, then confirm it in the passage.';
  };

  const stat = (label, value, extra = '') => {
    const node = make('div', `matching-engine-review-stat ${extra}`.trim());
    node.append(make('span', null, label), make('strong', null, value));
    return node;
  };

  const mistakeCard = item => {
    const card = make('article', 'matching-engine-mistake-card');
    const meta = make('div', 'matching-engine-mistake-meta');
    meta.append(make('span', null, `Set ${item.setNumber}`), make('span', null, item.passageTitle));

    const answers = make('div', 'matching-engine-mistake-answers');
    const student = make('div');
    student.append(make('span', null, 'Student answer'), make('strong', 'wrong', item.student));
    const correct = make('div');
    correct.append(make('span', null, 'Correct answer'), make('strong', 'correct', item.correct));
    answers.append(student, correct);

    card.append(meta, make('p', 'matching-engine-mistake-prompt', item.prompt), answers);
    if (item.evidence) card.append(make('p', 'matching-engine-mistake-evidence', `Evidence: ${item.evidence}`));
    card.append(make('p', 'matching-engine-mistake-explanation', item.explanation));
    return card;
  };

  function showResults() {
    const total = sets().reduce((sum, set) => sum + set.items.length, 0);
    const percentage = total ? Math.round((state.score / total) * 100) : 0;

    el.counter.textContent = 'Session complete';
    el.score.textContent = `${state.score} / ${total}`;
    setProgress(100);

    const result = make('div', 'matching-engine-result');
    result.append(
      make('span', 'section-kicker', 'Sentence-ending sets complete'),
      make('strong', null, `${state.score}/${total}`),
      make('h3', null, `${percentage}% correct`)
    );

    const review = make('section', 'matching-engine-review');
    review.append(make('h4', null, 'Session Review'));
    const grid = make('div', 'matching-engine-review-grid');
    grid.append(
      stat('Total matches', total),
      stat('Correct matches', state.score, 'correct'),
      stat('Wrong matches', state.wrongAnswers.length, 'wrong'),
      stat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, make('p', 'matching-engine-review-message', teacherMessage(percentage)));

    if (state.wrongAnswers.length) {
      const list = make('div', 'matching-engine-mistake-list');
      list.append(make('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach(item => list.append(mistakeCard(item)));
      review.append(list);
    }

    el.area.replaceChildren(result, review);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
    el.restart.focus();
  }

  const reset = () => {
    state.currentSetIndex = 0;
    state.selectedAnswers = {};
    state.score = 0;
    state.totalAnswered = 0;
    state.answered = false;
    state.wrongAnswers = [];
    renderSet();
  };

  const loading = () => {
    el.restart.disabled = true;
    el.check.hidden = true;
    el.next.hidden = true;
    el.counter.textContent = 'Loading set...';
    el.score.textContent = '0 / 0';
    setProgress(0);
    const box = make('div', 'practice-loading');
    box.append(make('span', 'practice-loader'), make('p', null, `Loading ${CONFIG[state.exam].name} sentence-ending sets...`));
    el.area.replaceChildren(box);
    el.feedback.hidden = true;
  };

  const loadError = (exam, error) => {
    el.restart.disabled = true;
    el.title.textContent = 'Practice data unavailable';
    el.exam.textContent = 'Please retry';
    el.counter.textContent = 'Not loaded';
    setProgress(0);

    const box = make('div', 'practice-load-error');
    box.append(
      make('span', 'practice-load-error-icon', '!'),
      make('h3', null, 'We could not load the Matching Sentence Endings sets.'),
      make('p', null, error?.message || 'Please check the dataset.')
    );

    const retry = make('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', () => loadExam(exam));
    box.append(retry);

    el.area.replaceChildren(box);
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const validateDataset = (exam, data) => {
    const path = DATA_PATHS[exam].replace('../', '');
    if (!Array.isArray(data)) throw new Error(`Invalid dataset: ${path} must contain an array.`);
    if (!data.length) throw new Error(`Invalid dataset: ${path} is empty.`);

    data.forEach((set, index) => {
      const label = set?.id || `set ${index + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${label} must be active.`);
      if (set?.examKey !== exam || set?.matchingType !== TYPE) {
        throw new Error(`Dataset mismatch: ${CONFIG[exam].mode} Matching Sentence Endings mode received different data. Please check ${path}.`);
      }

      const fields = ['id', 'examKey', 'exam', 'section', 'questionType', 'interfaceType', 'matchingType', 'difficulty', 'passageTitle', 'passage', 'instructions', 'options', 'items', 'status'];
      const missing = fields.filter(field => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);
      if (!set.id.startsWith(PREFIXES[exam])) throw new Error(`Invalid dataset: ${label} has the wrong id prefix.`);
      if (!Array.isArray(set.options) || !set.options.length || !Array.isArray(set.items) || !set.items.length) {
        throw new Error(`Invalid dataset: ${label} needs options and items arrays.`);
      }

      const optionIds = set.options.map(option => {
        if (!option?.id || !option?.text) throw new Error(`Invalid dataset: ${label} has an incomplete option.`);
        return option.id;
      });

      set.items.forEach(item => {
        if (!item?.id || !item?.prompt || !item?.answer || !item?.explanation) {
          throw new Error(`Invalid dataset: ${label} has an incomplete item.`);
        }
        if (!optionIds.includes(item.answer)) {
          throw new Error(`Invalid dataset: ${label} answer ${item.answer} has no option.`);
        }
      });
    });

    return data;
  };

  const fetchData = async exam => {
    const response = await fetch(DATA_PATHS[exam], { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${DATA_PATHS[exam]} (${response.status}).`);
    return validateDataset(exam, await response.json());
  };

  async function loadExam(exam) {
    if (!CONFIG[exam]) return;
    if (state.datasets[exam]) {
      if (state.exam === exam) {
        state.loaded = true;
        el.restart.disabled = false;
        reset();
      }
      return;
    }

    if (state.exam === exam) {
      state.loaded = false;
      loading();
    }

    try {
      const data = await fetchData(exam);
      state.datasets[exam] = data;
      if (state.exam !== exam) return;
      state.loaded = true;
      el.restart.disabled = false;
      reset();
    } catch (error) {
      console.error(`Exam Verse Matching Sentence Endings validation failed for ${exam}:`, error);
      if (state.exam === exam) loadError(exam, error);
    }
  }

  const switchExam = exam => {
    if (!CONFIG[exam]) return;
    state.exam = exam;
    updateUrl(exam);
    updateExamUi();
    if (state.datasets[exam]) {
      state.loaded = true;
      el.restart.disabled = false;
      reset();
    } else {
      loadExam(exam);
    }
  };

  el.cards.forEach(card => {
    card.addEventListener('click', () => {
      switchExam(card.dataset.exam);
      document.querySelector('#practice-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  el.check.addEventListener('click', checkAnswers);
  el.next.addEventListener('click', nextSet);
  el.restart.addEventListener('click', reset);
  updateExamUi();
  loadExam(state.exam);
})();
