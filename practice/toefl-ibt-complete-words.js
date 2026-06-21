(() => {
  'use strict';

  const DATA_PATH = '../data/toefl-ibt/reading/complete-the-words.json';
  const HUB_URL = '../pages/toefl-ibt.html';
  const SET_TOTAL = 10;

  const state = {
    data: [],
    currentSetIndex: 0,
    answers: {},
    locked: false,
    reviews: []
  };

  const el = {
    sessionTitle: document.querySelector('#practice-session-title'),
    examName: document.querySelector('#ctw-exam-name'),
    setCounter: document.querySelector('#ctw-set-counter'),
    scoreCount: document.querySelector('#ctw-score-count'),
    progress: document.querySelector('#ctw-progress'),
    progressBar: document.querySelector('#ctw-progress-bar'),
    questionArea: document.querySelector('#ctw-question-area'),
    feedback: document.querySelector('#ctw-feedback'),
    check: document.querySelector('#ctw-check'),
    next: document.querySelector('#ctw-next'),
    restart: document.querySelector('#ctw-restart'),
    hubLink: document.querySelector('#ctw-hub-link'),
    hubLabel: document.querySelector('#ctw-hub-label')
  };

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const getSets = () => state.data;
  const getSet = () => getSets()[state.currentSetIndex];

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safeValue}%`;
    el.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateButtons = () => {
    const set = getSet();
    const allFilled = Boolean(set && set.gaps.every((gap) => normalize(state.answers[gap.id])));
    el.check.disabled = state.locked || !allFilled;
  };

  const updateHeader = () => {
    const set = getSet();
    if (!set) return;
    el.sessionTitle.textContent = set.title;
    el.examName.textContent = `${set.difficulty} - TOEFL iBT 2026`;
    el.hubLink.href = HUB_URL;
    el.hubLabel.textContent = 'Back to TOEFL iBT 2026 Hub';
    el.setCounter.textContent = `Set ${state.currentSetIndex + 1} of ${getSets().length}`;
    el.scoreCount.textContent = `0 / ${SET_TOTAL}`;
    setProgress((state.currentSetIndex / getSets().length) * 100);
  };

  const makeWord = (gap, index) => {
    const word = create('span', 'complete-word');
    word.dataset.gapId = gap.id;

    const prefix = create('span', 'complete-word-prefix', gap.prefix);
    const input = create('input', 'complete-word-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.autocapitalize = 'off';
    input.inputMode = 'text';
    input.maxLength = Math.max(1, gap.missingLetters.length);
    const widthInCh = Math.min(Math.max(gap.missingLetters.length + 0.5, 2.2), 7);
    input.style.width = `${widthInCh}ch`;
    input.value = state.answers[gap.id] || '';
    input.setAttribute('aria-label', `Missing letters for question ${index + 1}`);
    input.addEventListener('input', () => {
      state.answers[gap.id] = input.value;
      updateButtons();
    });

    word.append(prefix, input);
    if (gap.suffix) {
      word.append(create('span', 'complete-word-suffix', gap.suffix));
    }
    return word;
  };

  const renderPassage = (set) => {
    const passage = create('p', 'complete-words-passage');
    const parts = set.passageTemplate.split(/(\{\{\d+\}\})/);
    parts.forEach((part) => {
      const match = part.match(/^\{\{(\d+)\}\}$/);
      if (!match) {
        passage.append(document.createTextNode(part));
        return;
      }
      const gap = set.gaps.find((item) => item.id === match[1]);
      if (gap) passage.append(makeWord(gap, Number(match[1]) - 1));
    });
    return passage;
  };

  const clearFeedback = () => {
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
  };

  const renderQuestionArea = () => {
    const set = getSet();
    if (!set) return;

    const top = create('div', 'completion-content-top');
    top.append(
      create('span', 'completion-difficulty', set.difficulty),
      create('span', 'completion-type', 'Complete the Words'),
      create('span', 'completion-word-limit', '10 blanks')
    );

    const passageCard = create('section', 'completion-passage-card');
    passageCard.append(
      create('span', 'section-kicker', 'Reading passage'),
      create('h3', 'completion-passage-title', set.title),
      create('p', 'complete-words-instructions', set.instructions),
      renderPassage(set)
    );

    const review = create('section', 'complete-word-review');
    review.id = 'ctw-review';
    review.hidden = true;

    el.questionArea.replaceChildren(top, passageCard, review);
  };

  const showLoading = () => {
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Loading practice...';
    el.examName.textContent = 'Preparing data';
    el.setCounter.textContent = 'Set -';
    el.scoreCount.textContent = `0 / ${SET_TOTAL}`;
    setProgress(0);

    const loading = create('div', 'practice-loading');
    loading.append(create('span', 'practice-loader'), create('p', null, 'Loading your complete-the-words sets...'));
    el.questionArea.replaceChildren(loading);
    clearFeedback();
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const showLoadingError = (error) => {
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.examName.textContent = 'Please retry';
    el.setCounter.textContent = 'Not loaded';
    el.scoreCount.textContent = `0 / ${SET_TOTAL}`;
    setProgress(0);

    const box = create('div', 'practice-load-error');
    box.append(
      create('span', 'practice-load-error-icon', '!'),
      create('h3', null, 'We could not load the complete-the-words sets.'),
      create('p', null, error?.message || 'Please check the dataset and try again.')
    );
    const retry = create('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', loadDataset);
    box.append(retry);
    el.questionArea.replaceChildren(box);
    clearFeedback();
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const buildWrongCard = (gap, index, studentAnswer) => {
    const card = create('article', 'complete-word-review-item wrong');
    card.append(
      create('span', null, `Question ${index + 1}`),
      create('strong', null, gap.fullWord),
      create('p', null, `Missing letters: ${gap.missingLetters}`),
      create('p', null, gap.explanation),
      create('p', null, `Your answer: ${studentAnswer || 'No answer'}`)
    );
    return card;
  };

  const checkAnswers = () => {
    if (state.locked) return;
    const set = getSet();
    if (!set) return;

    state.locked = true;
    const wrongCards = [];
    let score = 0;

    set.gaps.forEach((gap, index) => {
      const word = el.questionArea.querySelector(`.complete-word[data-gap-id="${CSS.escape(gap.id)}"]`);
      const input = word?.querySelector('.complete-word-input');
      const userAnswer = normalize(state.answers[gap.id]);
      const correctAnswer = normalize(gap.missingLetters);
      const isCorrect = userAnswer === correctAnswer;

      if (isCorrect) score += 1;

      if (word) word.classList.add(isCorrect ? 'complete-word-correct' : 'complete-word-wrong', isCorrect ? 'correct' : 'wrong');
      if (input) {
        input.readOnly = true;
        input.classList.add(isCorrect ? 'complete-word-correct' : 'complete-word-wrong');
        input.setAttribute('aria-invalid', String(!isCorrect));
      }

      if (!isCorrect) wrongCards.push(buildWrongCard(gap, index, state.answers[gap.id]));
    });

    state.reviews[state.currentSetIndex] = {
      setTitle: set.title,
      difficulty: set.difficulty,
      score,
      total: SET_TOTAL
    };

    el.scoreCount.textContent = `${score} / ${SET_TOTAL}`;
    setProgress(((state.currentSetIndex + 1) / getSets().length) * 100);
    el.feedback.replaceChildren(
      create('strong', null, `${score} of ${SET_TOTAL} correct.`),
      create('span', null, 'Review the missing letters, then move to the next set.')
    );
    el.feedback.hidden = false;

    const review = el.questionArea.querySelector('#ctw-review');
    if (review) {
      review.hidden = false;
      review.replaceChildren(
        create('h4', null, 'Set Review'),
        create('div', 'completion-review-message', wrongCards.length
          ? 'Wrong answers show the correct missing letters, the full word, and a short explanation.'
          : 'All ten words are correct. Nice work.')
      );
      if (wrongCards.length) {
        const grid = create('div', 'complete-word-review-grid');
        grid.replaceChildren(...wrongCards);
        review.append(grid);
      }
    }

    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === getSets().length - 1 ? 'View Results ->' : 'Next Set ->';
    el.next.focus();
  };

  const showResults = () => {
    const result = create('div', 'completion-result');
    result.append(
      create('span', 'section-kicker', 'Complete the Words sets complete'),
      create('strong', 'completion-result-score', `${state.reviews.length} sets`),
      create('h3', null, 'Session complete'),
      create('small', null, 'Restart to practise the three passages again.')
    );

    const review = create('section', 'complete-word-review');
    review.append(create('h4', null, 'Session Review'));

    const grid = create('div', 'complete-word-review-grid');
    state.reviews.forEach((item, index) => {
      grid.append(buildSummaryCard(`Set ${index + 1}`, `${item.score} / ${item.total}`, 'correct'));
    });
    review.append(grid);

    el.sessionTitle.textContent = 'Session review';
    el.examName.textContent = 'Finished';
    el.setCounter.textContent = 'Complete';
    el.scoreCount.textContent = `${state.reviews[state.reviews.length - 1]?.score ?? 0} / ${SET_TOTAL}`;
    setProgress(100);
    clearFeedback();
    el.questionArea.replaceChildren(result, review);
    el.check.hidden = true;
    el.next.hidden = true;
    el.restart.disabled = false;
    el.restart.focus();
  };

  const buildSummaryCard = (label, value, className = '') => {
    const item = create('article', `complete-word-review-item ${className}`.trim());
    item.append(create('span', null, label), create('strong', null, value));
    return item;
  };

  const nextSet = () => {
    if (!state.locked) return;
    if (state.currentSetIndex >= getSets().length - 1) {
      showResults();
      return;
    }

    state.currentSetIndex += 1;
    state.answers = {};
    state.locked = false;
    renderQuestionArea();
    updateHeader();
    clearFeedback();
    el.check.hidden = false;
    el.next.hidden = true;
    el.restart.disabled = false;
    updateButtons();
    el.questionArea.focus();
  };

  const restart = () => {
    state.currentSetIndex = 0;
    state.answers = {};
    state.locked = false;
    state.reviews = [];
    renderQuestionArea();
    updateHeader();
    clearFeedback();
    el.check.hidden = false;
    el.next.hidden = true;
    el.restart.disabled = false;
    updateButtons();
  };

  const validateDataset = (data) => {
    if (!Array.isArray(data)) throw new Error('Invalid dataset: complete-the-words.json must contain an array.');
    if (!data.length) throw new Error('Invalid dataset: complete-the-words.json is empty.');

    const requiredSetFields = ['id', 'examKey', 'exam', 'section', 'taskType', 'interfaceType', 'difficulty', 'title', 'instructions', 'passageTemplate', 'gaps', 'status'];
    const placeholderPattern = /\{\{(\d+)\}\}/g;

    data.forEach((set, index) => {
      const label = set?.id || `set ${index + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status "active".`);
      if (set?.examKey !== 'toefl-ibt') throw new Error(`Invalid dataset: ${label} must use examKey "toefl-ibt".`);
      if (set?.section !== 'reading') throw new Error(`Invalid dataset: ${label} must use section "reading".`);
      if (set?.taskType !== 'complete-the-words') throw new Error(`Invalid dataset: ${label} must use taskType "complete-the-words".`);
      if (set?.interfaceType !== 'complete-the-words') throw new Error(`Invalid dataset: ${label} must use interfaceType "complete-the-words".`);

      const missing = requiredSetFields.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);

      if (/[A-Za-z]\{\{\d+\}\}/.test(set.passageTemplate) || /\{\{\d+\}\}[A-Za-z]/.test(set.passageTemplate)) {
        throw new Error(`Invalid dataset: ${label} placeholders must stand alone and not attach to letters.`);
      }

      const placeholders = [...String(set.passageTemplate).matchAll(placeholderPattern)].map((match) => match[1]);
      const placeholderIds = new Set(placeholders);
      if (placeholders.length !== 10) throw new Error(`Invalid dataset: ${label} passageTemplate must contain exactly 10 placeholders.`);
      for (let i = 1; i <= 10; i += 1) {
        if (!placeholderIds.has(String(i))) throw new Error(`Invalid dataset: ${label} passageTemplate must include {{${i}}}.`);
      }
      if (!Array.isArray(set.gaps) || set.gaps.length !== 10) throw new Error(`Invalid dataset: ${label} must include exactly 10 gaps.`);

      const gapIds = new Set();
      set.gaps.forEach((gap, gapIndex) => {
        const gapLabel = gap?.id || `gap ${gapIndex + 1}`;
        const missingGapFields = ['id', 'prefix', 'missingLetters', 'fullWord', 'explanation'].filter((field) => gap?.[field] === undefined || gap?.[field] === null || gap?.[field] === '');
        if (missingGapFields.length) throw new Error(`Invalid dataset: ${label}, ${gapLabel} is missing ${missingGapFields.join(', ')}.`);
        if (gapIds.has(String(gap.id))) throw new Error(`Invalid dataset: ${label} repeats gap id ${gap.id}.`);
        gapIds.add(String(gap.id));
        if (!placeholderIds.has(String(gap.id))) throw new Error(`Invalid dataset: ${label} gap ${gap.id} has no matching placeholder.`);
        const suffix = gap.suffix || '';
        if (`${gap.prefix}${gap.missingLetters}${suffix}` !== gap.fullWord) {
          throw new Error(`Invalid dataset: ${label} gap ${gap.id} fullWord must equal prefix + missingLetters + optional suffix.`);
        }
      });

      for (let i = 1; i <= 10; i += 1) {
        if (!gapIds.has(String(i))) throw new Error(`Invalid dataset: ${label} is missing gap ${i}.`);
      }
    });

    return data;
  };

  async function loadDataset() {
    showLoading();
    try {
      const response = await fetch(DATA_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATH} (${response.status}).`);
      state.data = validateDataset(await response.json());
      el.restart.disabled = false;
      restart();
    } catch (error) {
      console.error('Exam Verse TOEFL iBT Complete the Words dataset validation failed:', error);
      showLoadingError(error);
    }
  }

  el.check.addEventListener('click', checkAnswers);
  el.next.addEventListener('click', nextSet);
  el.restart.addEventListener('click', restart);

  updateButtons();
  loadDataset();
})();
