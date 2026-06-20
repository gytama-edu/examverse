(() => {
  'use strict';

  const DATA_PATHS = {
    academic: '../data/ielts-academic/reading/table-completion.json',
    general: '../data/ielts-general/reading/table-completion.json'
  };

  const EXAM_CONFIG = {
    academic: {
      name: 'IELTS Academic',
      modeName: 'Academic',
      title: 'Academic Table Completion',
      hub: '../pages/ielts-academic.html',
      hubLabel: 'Back to IELTS Academic Hub',
      prefix: 'ielts-ac-tc-'
    },
    general: {
      name: 'IELTS General Training',
      modeName: 'General Training',
      title: 'General Training Table Completion',
      hub: '../pages/ielts-general.html',
      hubLabel: 'Back to IELTS General Hub',
      prefix: 'ielts-gt-tc-'
    }
  };

  const requestedExam = new URLSearchParams(window.location.search).get('exam');
  const initialExam = Object.prototype.hasOwnProperty.call(EXAM_CONFIG, requestedExam) ? requestedExam : 'academic';

  const state = {
    datasets: {},
    exam: initialExam,
    currentSetIndex: 0,
    selectedAnswers: {},
    score: 0,
    totalAnswered: 0,
    answered: false,
    wrongAnswers: [],
    loadVersion: 0
  };

  const el = {
    examCards: [...document.querySelectorAll('[data-exam]')],
    sessionTitle: document.querySelector('#tc-session-title'),
    examName: document.querySelector('#tc-exam-name'),
    setCounter: document.querySelector('#tc-set-counter'),
    scoreCount: document.querySelector('#tc-score-count'),
    progress: document.querySelector('#tc-progress'),
    progressBar: document.querySelector('#tc-progress-bar'),
    area: document.querySelector('#tc-question-area'),
    feedback: document.querySelector('#tc-feedback'),
    check: document.querySelector('#tc-check-answer'),
    next: document.querySelector('#tc-next-set'),
    restart: document.querySelector('#tc-restart'),
    hub: document.querySelector('#tc-hub-link'),
    hubLabel: document.querySelector('#tc-hub-label')
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const sets = () => state.datasets[state.exam] || [];
  const currentSet = () => sets()[state.currentSetIndex];
  const normalizeAnswer = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    el.progressBar.style.width = `${safeValue}%`;
    el.progress.setAttribute('aria-valuenow', String(safeValue));
  };

  const updateUrl = (exam) => {
    const url = new URL(window.location.href);
    url.searchParams.set('exam', exam);
    url.hash = 'practice-shell';
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const updateExamUi = () => {
    const config = EXAM_CONFIG[state.exam];
    el.examCards.forEach((card) => {
      const active = card.dataset.exam === state.exam;
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', String(active));
    });
    el.sessionTitle.textContent = config.title;
    el.examName.textContent = config.name;
    el.hub.href = config.hub;
    el.hubLabel.textContent = config.hubLabel;
  };

  const allAnswered = () => {
    const set = currentSet();
    return Boolean(set && set.rows.every((row) => row.cells.every((cell) => typeof cell === 'string' || normalizeAnswer(state.selectedAnswers[cell.blankId]))));
  };

  const updateCheckButton = () => {
    el.check.disabled = state.answered || !allAnswered();
  };

  const renderCell = (cell, rowIndex, colIndex, rowLabel) => {
    if (typeof cell === 'string') {
      const td = make('td', 'completion-table-static-cell', cell);
      return td;
    }

    const td = make('td', 'completion-table-blank-cell');
    td.dataset.blankId = cell.blankId;
    td.dataset.rowIndex = String(rowIndex);
    td.dataset.colIndex = String(colIndex);

    const inputId = `table-answer-${state.currentSetIndex + 1}-${cell.blankId}`;
    const input = make('input', 'completion-input completion-table-input');
    input.id = inputId;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.blankId = cell.blankId;
    input.placeholder = 'Type answer';
    input.setAttribute('aria-label', `${rowLabel}, blank ${rowIndex + 1}`);
    input.addEventListener('input', () => {
      state.selectedAnswers[cell.blankId] = input.value;
      updateCheckButton();
    });

    const note = make('div', 'completion-table-note');
    td.append(input, note);
    return td;
  };

  const renderSet = () => {
    const collection = sets();
    const set = currentSet();
    if (!set) {
      showResults();
      return;
    }

    state.selectedAnswers = {};
    state.answered = false;
    updateExamUi();
    el.setCounter.textContent = `Set ${state.currentSetIndex + 1} of ${collection.length}`;
    el.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress((state.currentSetIndex / collection.length) * 100);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = false;
    el.check.disabled = true;
    el.next.hidden = true;
    el.next.textContent = 'Next Set →';

    const top = make('div', 'completion-content-top');
    top.append(
      make('span', 'completion-difficulty', set.difficulty),
      make('span', 'completion-type', 'Table'),
      make('span', 'completion-word-limit', set.wordLimit)
    );

    const passage = make('section', 'completion-passage-card');
    passage.setAttribute('aria-labelledby', 'current-table-passage');
    passage.append(
      make('span', 'section-kicker', 'Reading passage'),
      make('h3', 'completion-passage-title', set.passageTitle),
      make('p', 'completion-passage-text', set.passage)
    );
    passage.querySelector('h3').id = 'current-table-passage';

    const task = make('section', 'completion-task-card');
    const taskHeader = make('header', 'completion-task-header');
    const taskCopy = make('div');
    taskCopy.append(make('span', null, 'Table completion'), make('h3', null, set.tableTitle));
    const limit = make('div', 'completion-limit-box');
    limit.append(make('span', null, 'Word limit'), make('strong', null, set.wordLimit));
    taskHeader.append(taskCopy, limit);
    task.append(taskHeader, make('p', 'completion-instructions', set.instructions));

    const tableWrap = make('div', 'table-completion-scroll');
    const table = make('table', 'table-completion-table');
    const caption = make('caption', null, set.tableTitle);
    table.append(caption);

    const thead = make('thead');
    const headRow = make('tr');
    set.columns.forEach((column) => headRow.append(make('th', null, column)));
    thead.append(headRow);
    table.append(thead);

    const tbody = make('tbody');
    set.rows.forEach((row, rowIndex) => {
      const tr = make('tr');
      row.cells.forEach((cell, colIndex) => {
        const rowLabel = set.columns[colIndex];
        tr.append(renderCell(cell, rowIndex, colIndex, rowLabel));
      });
      tbody.append(tr);
    });
    table.append(tbody);
    tableWrap.append(table);
    task.append(tableWrap);
    el.area.replaceChildren(top, passage, task);
  };

  const acceptedText = (cell) => cell.answers[0];

  const checkAnswers = () => {
    if (state.answered || el.check.disabled) return;
    const set = currentSet();
    let setScore = 0;
    const blanksInSet = set.rows.reduce((count, row) => count + row.cells.filter((cell) => typeof cell !== 'string').length, 0);
    state.answered = true;

    set.rows.forEach((row) => {
      row.cells.forEach((cell) => {
        if (typeof cell === 'string') return;
        const selectedAnswer = String(state.selectedAnswers[cell.blankId] ?? '').trim();
        const acceptedAnswers = cell.answers.map(normalizeAnswer);
        const normalizedSelected = normalizeAnswer(selectedAnswer);
        const correct = acceptedAnswers.includes(normalizedSelected);
        if (correct) {
          state.score += 1;
          setScore += 1;
        } else {
          state.wrongAnswers.push({
            setNumber: state.currentSetIndex + 1,
            passageTitle: set.passageTitle,
            blankLabel: cell.blankId,
            studentAnswer: selectedAnswer,
            correctAnswer: acceptedText(cell),
            evidence: cell.evidence,
            explanation: cell.explanation
          });
        }
        state.totalAnswered += 1;

        const td = el.area.querySelector(`.completion-table-blank-cell[data-blank-id="${CSS.escape(cell.blankId)}"]`);
        const input = td.querySelector('.completion-table-input');
        const note = td.querySelector('.completion-table-note');
        td.classList.add(correct ? 'correct' : 'wrong');
        input.classList.add(correct ? 'correct' : 'wrong');
        input.readOnly = true;
        input.setAttribute('aria-invalid', String(!correct));
        note.replaceChildren(
          make('strong', null, correct ? 'Correct answer' : `Correct answer: ${acceptedText(cell)}`),
          make('p', null, cell.evidence),
          make('em', null, cell.explanation)
        );
      });
    });

    el.scoreCount.textContent = `${state.score} / ${state.totalAnswered}`;
    setProgress(((state.currentSetIndex + 1) / sets().length) * 100);
    el.feedback.replaceChildren(
      make('strong', null, `${setScore} of ${blanksInSet} answers correct.`),
      make('span', null, 'Review the evidence and table order before continuing.')
    );
    el.feedback.hidden = false;
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = state.currentSetIndex === sets().length - 1 ? 'View Results →' : 'Next Set →';
    el.next.focus();
  };

  const teacherMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent table control. You are matching row labels and detail accurately.';
    if (percentage >= 70) return 'Strong work. Recheck the few rows where wording and placement were easy to mix up.';
    if (percentage >= 50) return 'A useful start. Follow the row labels carefully and keep the passage evidence close.';
    return 'Keep building the method. Read the table first, then find the exact words in the passage.';
  };

  const stat = (label, value, className = '') => {
    const item = make('div', `completion-review-stat ${className}`.trim());
    item.append(make('span', null, label), make('strong', null, String(value)));
    return item;
  };

  const mistakeCard = (mistake) => {
    const card = make('article', 'completion-mistake-card');
    const meta = make('div', 'completion-mistake-meta');
    meta.append(make('span', null, `Set ${mistake.setNumber} · Blank ${mistake.blankLabel}`), make('span', null, mistake.passageTitle));
    const answers = make('div', 'completion-mistake-answers');
    const student = make('div');
    student.append(make('span', null, 'Your answer'), make('strong', 'wrong', mistake.studentAnswer || 'No answer'));
    const correct = make('div');
    correct.append(make('span', null, 'Correct answer'), make('strong', 'correct', mistake.correctAnswer));
    answers.append(student, correct);
    card.append(
      meta,
      answers,
      make('p', 'completion-mistake-evidence', `Evidence: ${mistake.evidence}`),
      make('p', 'completion-mistake-explanation', mistake.explanation)
    );
    return card;
  };

  const showResults = () => {
    const total = sets().reduce((sum, set) => sum + set.rows.reduce((rowSum, row) => rowSum + row.cells.filter((cell) => typeof cell !== 'string').length, 0), 0);
    const percentage = total ? Math.round((state.score / total) * 100) : 0;
    el.setCounter.textContent = 'Session complete';
    el.scoreCount.textContent = `${state.score} / ${total}`;
    setProgress(100);

    const result = make('div', 'completion-result');
    result.append(
      make('span', 'section-kicker', 'Table sets complete'),
      make('strong', 'completion-result-score', `${state.score}/${total}`),
      make('h3', null, `${percentage}% correct`),
      make('small', null, 'Restart to practise the same passages and tables again.')
    );

    const review = make('section', 'completion-review');
    review.setAttribute('aria-label', 'Practice session review');
    review.append(make('h4', null, 'Session Review'));
    const grid = make('div', 'completion-review-grid');
    grid.append(
      stat('Total blanks', total),
      stat('Correct answers', state.score, 'correct'),
      stat('Wrong answers', state.wrongAnswers.length, 'wrong'),
      stat('Accuracy', `${percentage}%`, 'accuracy')
    );
    review.append(grid, make('p', 'completion-review-message', teacherMessage(percentage)));
    if (state.wrongAnswers.length) {
      const list = make('div', 'completion-mistake-list');
      list.append(make('h4', null, 'Review Mistakes'));
      state.wrongAnswers.forEach((mistake) => list.append(mistakeCard(mistake)));
      review.append(list);
    }
    el.area.replaceChildren(result, review);
    el.feedback.hidden = true;
    el.feedback.replaceChildren();
    el.check.hidden = true;
    el.next.hidden = true;
    el.restart.focus();
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

  const resetSession = () => {
    state.currentSetIndex = 0;
    state.selectedAnswers = {};
    state.score = 0;
    state.totalAnswered = 0;
    state.answered = false;
    state.wrongAnswers = [];
    renderSet();
  };

  const validateDataset = (exam, data) => {
    const path = DATA_PATHS[exam].replace('../', '');
    const config = EXAM_CONFIG[exam];
    if (!Array.isArray(data)) throw new Error(`Invalid dataset: ${path} must contain an array.`);
    if (!data.length) throw new Error(`Invalid dataset: ${path} is empty.`);

    const requiredFields = ['id', 'examKey', 'exam', 'section', 'questionType', 'interfaceType', 'difficulty', 'passageTitle', 'passage', 'instructions', 'wordLimit', 'tableTitle', 'columns', 'rows', 'status'];
    data.forEach((set, index) => {
      const label = set?.id || `set ${index + 1}`;
      if (set?.status !== 'active') throw new Error(`Invalid dataset: ${label} must have status active.`);
      if (set?.examKey !== exam || set?.interfaceType !== 'table-completion') {
        throw new Error(`Dataset mismatch: ${config.modeName} table completion mode received different data. Please check ${path}.`);
      }
      const missing = requiredFields.filter((field) => set?.[field] === undefined || set?.[field] === null || set?.[field] === '');
      if (missing.length) throw new Error(`Invalid dataset: ${label} is missing ${missing.join(', ')}.`);
      if (set.questionType !== 'Table Completion') throw new Error(`Invalid dataset: ${label} has the wrong questionType.`);
      if (!set.id.startsWith(config.prefix)) throw new Error(`Invalid dataset: ${label} has the wrong id prefix.`);
      if (!Array.isArray(set.columns)) throw new Error(`Invalid dataset: ${label} columns must be an array.`);
      if (!Array.isArray(set.rows)) throw new Error(`Invalid dataset: ${label} rows must be an array.`);
      if (set.rows.length !== 4) throw new Error(`Invalid dataset: ${label} must contain exactly 4 rows.`);

      const blankIds = new Set();
      let blankCount = 0;
      set.rows.forEach((row, rowIndex) => {
        const rowLabel = `${label} row ${rowIndex + 1}`;
        if (!Array.isArray(row?.cells)) throw new Error(`Invalid dataset: ${rowLabel} cells must be an array.`);
        if (row.cells.length !== set.columns.length) throw new Error(`Invalid dataset: ${rowLabel} must have the same number of cells as columns.`);
        row.cells.forEach((cell, cellIndex) => {
          if (typeof cell === 'string') return;
          const blankLabel = cell?.blankId || `${rowLabel} cell ${cellIndex + 1}`;
          const missingBlankFields = ['blankId', 'answers', 'evidence', 'explanation'].filter((field) => cell?.[field] === undefined || cell?.[field] === null || cell?.[field] === '');
          if (missingBlankFields.length) throw new Error(`Invalid dataset: ${rowLabel} blank cell is missing ${missingBlankFields.join(', ')}.`);
          if (blankIds.has(cell.blankId)) throw new Error(`Invalid dataset: ${label} repeats blankId ${cell.blankId}.`);
          blankIds.add(cell.blankId);
          blankCount += 1;
          if (!Array.isArray(cell.answers) || !cell.answers.length || cell.answers.some((answer) => !normalizeAnswer(answer))) {
            throw new Error(`Invalid dataset: ${blankLabel} must include at least one accepted answer.`);
          }
          if (cell.answers.some((answer) => normalizeAnswer(answer).split(/\s+/).filter(Boolean).length > 2)) {
            throw new Error(`Invalid dataset: ${blankLabel} has an accepted answer that exceeds the two-word limit.`);
          }
        });
      });
      if (blankCount !== 4) throw new Error(`Invalid dataset: ${label} must contain exactly 4 blanks.`);
    });
    return data;
  };

  const showLoading = () => {
    updateExamUi();
    el.restart.disabled = true;
    el.setCounter.textContent = 'Loading sets';
    el.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const loading = make('div', 'practice-loading');
    const spinner = make('span', 'practice-loader');
    spinner.setAttribute('aria-hidden', 'true');
    loading.append(spinner, make('p', null, `Loading ${EXAM_CONFIG[state.exam].modeName} table sets…`));
    el.area.replaceChildren(loading);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
  };

  const showLoadingError = (exam, error) => {
    if (state.exam !== exam) return;
    updateExamUi();
    el.restart.disabled = true;
    el.sessionTitle.textContent = 'Practice data unavailable';
    el.examName.textContent = 'Please retry';
    el.setCounter.textContent = 'Not loaded';
    el.scoreCount.textContent = '0 / 0';
    setProgress(0);
    const box = make('div', 'practice-load-error');
    box.append(
      make('span', 'practice-load-error-icon', '!'),
      make('h3', null, 'We could not load the table sets.'),
      make('p', null, error?.message || 'Please check the selected dataset and try again.')
    );
    const retry = make('button', 'button button-secondary', 'Try Loading Again');
    retry.type = 'button';
    retry.addEventListener('click', () => loadExam(exam));
    box.append(retry);
    el.area.replaceChildren(box);
    el.feedback.hidden = true;
    el.check.hidden = true;
    el.next.hidden = true;
  };

  async function loadExam(exam) {
    const requestVersion = ++state.loadVersion;
    showLoading();
    try {
      const response = await fetch(DATA_PATHS[exam], { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_PATHS[exam]} (${response.status}).`);
      const data = validateDataset(exam, await response.json());
      if (requestVersion !== state.loadVersion || state.exam !== exam) return;
      state.datasets[exam] = data;
      el.restart.disabled = false;
      resetSession();
    } catch (error) {
      if (requestVersion !== state.loadVersion || state.exam !== exam) return;
      console.error('Exam Verse IELTS Table Completion dataset validation failed:', error);
      showLoadingError(exam, error);
    }
  }

  const switchExam = (exam) => {
    if (!EXAM_CONFIG[exam] || exam === state.exam) return;
    state.exam = exam;
    updateUrl(exam);
    updateExamUi();
    if (state.datasets[exam]) {
      state.loadVersion += 1;
      el.restart.disabled = false;
      resetSession();
    } else {
      loadExam(exam);
    }
  };

  el.examCards.forEach((card) => {
    card.addEventListener('click', () => {
      switchExam(card.dataset.exam);
      document.querySelector('#practice-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  el.check.addEventListener('click', checkAnswers);
  el.next.addEventListener('click', nextSet);
  el.restart.addEventListener('click', resetSession);

  updateExamUi();
  loadExam(state.exam);
})();
