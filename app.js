(() => {
  "use strict";

  const STORAGE_KEY = "lucky-six-state-v1";
  const MAX_GAME_COUNT = 5;
  const MAX_FIXED_COUNT = 5;
  const MAX_HISTORY = 5;
  const THEME_KEY = 'lucky-six-theme';

  const state = {
    gameCount: 1,
    fixedNumbers: new Set(),
    currentGames: [],
    history: [],
  };

  const elements = {
    decreaseCount: document.querySelector("#decrease-count"),
    increaseCount: document.querySelector("#increase-count"),
    gameCount: document.querySelector("#game-count"),
    fixedCount: document.querySelector("#fixed-count"),
    fixedHint: document.querySelector("#fixed-hint"),
    numberGrid: document.querySelector("#number-grid"),
    clearFixed: document.querySelector("#clear-fixed"),
    generateButton: document.querySelector("#generate-button"),
    generateSubtitle: document.querySelector("#generate-subtitle"),
    emptyState: document.querySelector("#empty-state"),
    results: document.querySelector("#results"),
    resultActions: document.querySelector("#result-actions"),
    resultFooter: document.querySelector("#result-footer"),
    copyAll: document.querySelector("#copy-all"),
    shareAll: document.querySelector("#share-all"),
    regenerateButton: document.querySelector("#regenerate-button"),
    historySection: document.querySelector("#history-section"),
    historyList: document.querySelector("#history-list"),
    clearHistory: document.querySelector("#clear-history"),
    toast: document.querySelector("#toast"),
    themeToggle: document.querySelector('#theme-toggle'),
    themeLabel: document.querySelector('#theme-label'),
  };

  let toastTimer;
  let isGenerating = false;

  function secureRandomInt(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be a positive integer");
    }

    if (!globalThis.crypto?.getRandomValues) {
      throw new Error("이 브라우저에서는 보안 난수를 사용할 수 없습니다.");
    }

    const range = 0x100000000;
    const limit = range - (range % maxExclusive);
    const buffer = new Uint32Array(1);
    let value;

    do {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);

    return value % maxExclusive;
  }

  function shuffle(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = secureRandomInt(index + 1);
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  function createGame() {
    const fixed = [...state.fixedNumbers];
    const available = Array.from({ length: 45 }, (_, index) => index + 1).filter(
      (number) => !state.fixedNumbers.has(number),
    );
    const requiredCount = 6 - fixed.length;
    return [...fixed, ...shuffle(available).slice(0, requiredCount)].sort((a, b) => a - b);
  }

  function generateUniqueGames(count) {
    const games = [];
    const seen = new Set();
    let attempts = 0;

    while (games.length < count && attempts < 250) {
      const game = createGame();
      const key = game.join("-");
      if (!seen.has(key)) {
        seen.add(key);
        games.push(game);
      }
      attempts += 1;
    }

    if (games.length !== count) {
      throw new Error("서로 다른 조합을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    return games;
  }

  function ballClass(number) {
    if (number <= 10) return "ball-yellow";
    if (number <= 20) return "ball-blue";
    if (number <= 30) return "ball-red";
    if (number <= 40) return "ball-gray";
    return "ball-green";
  }

  function gameLabel(index) {
    return String.fromCharCode(65 + index);
  }

  function formatGame(game) {
    return game.join(", ");
  }

  function formatGames(games) {
    return games.map((game, index) => `${gameLabel(index)}. ${formatGame(game)}`).join("\n");
  }

  function safeHistory(value) {
    if (!Array.isArray(value)) return [];

    return value
      .filter((entry) => {
        if (!entry || typeof entry !== "object" || !Array.isArray(entry.games)) return false;
        return entry.games.every(
          (game) =>
            Array.isArray(game) &&
            game.length === 6 &&
            new Set(game).size === 6 &&
            game.every((number) => Number.isInteger(number) && number >= 1 && number <= 45),
        );
      })
      .slice(0, MAX_HISTORY)
      .map((entry) => ({
        id: String(entry.id ?? createId()),
        createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
        games: entry.games.map((game) => [...game].sort((a, b) => a - b)),
      }));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (!saved || typeof saved !== "object") return;

      if (Number.isInteger(saved.gameCount) && saved.gameCount >= 1 && saved.gameCount <= MAX_GAME_COUNT) {
        state.gameCount = saved.gameCount;
      }

      if (Array.isArray(saved.fixedNumbers)) {
        const valid = saved.fixedNumbers.filter(
          (number) => Number.isInteger(number) && number >= 1 && number <= 45,
        );
        state.fixedNumbers = new Set(valid.slice(0, MAX_FIXED_COUNT));
      }

      state.history = safeHistory(saved.history);
    } catch {
      state.history = [];
    }
  }

  function persistState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          gameCount: state.gameCount,
          fixedNumbers: [...state.fixedNumbers],
          history: state.history,
        }),
      );
    } catch {
      // Private browsing or storage limits must not block number generation.
    }
  }

  function createId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${secureRandomInt(1_000_000)}`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
  }

  function applyTheme(theme, announce = false) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    elements.themeToggle.setAttribute('aria-pressed', String(isDark));
    elements.themeToggle.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
    elements.themeLabel.textContent = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', isDark ? '#10131c' : '#171c2b');
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Theme selection still works when browser storage is unavailable.
    }
    if (announce) showToast(isDark ? '다크 모드로 바꿨어요.' : '라이트 모드로 바꿨어요.');
  }

  function renderNumberGrid() {
    const fragment = document.createDocumentFragment();
    const maxReached = state.fixedNumbers.size >= MAX_FIXED_COUNT;

    for (let number = 1; number <= 45; number += 1) {
      const selected = state.fixedNumbers.has(number);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "number-choice";
      button.textContent = String(number);
      button.dataset.number = String(number);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", `${number}번${selected ? " 선택됨" : ""}`);
      button.disabled = maxReached && !selected;
      fragment.append(button);
    }

    elements.numberGrid.replaceChildren(fragment);
    elements.fixedCount.textContent = String(state.fixedNumbers.size);
    elements.clearFixed.disabled = state.fixedNumbers.size === 0;
    elements.fixedHint.innerHTML = maxReached
      ? '<span aria-hidden="true">✓</span> 5개를 모두 선택했어요.'
      : '<span aria-hidden="true">↗</span> 최대 5개까지 선택할 수 있어요.';
  }

  function renderCount() {
    elements.gameCount.value = String(state.gameCount);
    elements.gameCount.textContent = String(state.gameCount);
    elements.decreaseCount.disabled = state.gameCount <= 1;
    elements.increaseCount.disabled = state.gameCount >= MAX_GAME_COUNT;
    elements.generateSubtitle.textContent = `${state.gameCount}게임을 생성합니다`;
  }

  function createBall(number) {
    const ball = document.createElement("span");
    const isFixed = state.fixedNumbers.has(number);
    ball.className = `lotto-ball ${ballClass(number)}${isFixed ? " fixed" : ""}`;
    ball.textContent = String(number);
    if (isFixed) ball.title = "선택한 고정수";
    return ball;
  }

  function copyIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5.8A1.8 1.8 0 0 1 9.8 4h8.4A1.8 1.8 0 0 1 20 5.8v8.4a1.8 1.8 0 0 1-1.8 1.8H17v2.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.2V9.8A1.8 1.8 0 0 1 6.8 8H8Zm2 1h5.2A1.8 1.8 0 0 1 17 9.8V14h1V6h-8v2Zm-3 2v8h8v-8H7Z" /></svg>';
  }

  function renderResults() {
    const hasResults = state.currentGames.length > 0;
    elements.emptyState.hidden = hasResults;
    elements.resultActions.hidden = !hasResults;
    elements.resultFooter.hidden = !hasResults;
    elements.results.replaceChildren();

    if (!hasResults) return;

    const fragment = document.createDocumentFragment();
    state.currentGames.forEach((game, index) => {
      const row = document.createElement("article");
      row.className = "game-row";
      row.style.animationDelay = `${index * 70}ms`;
      row.setAttribute("aria-label", `${index + 1}게임, 번호 ${game.join(", ")}`);

      const label = document.createElement("span");
      label.className = "game-label";
      label.textContent = gameLabel(index);
      label.setAttribute("aria-hidden", "true");

      const balls = document.createElement("div");
      balls.className = "balls";
      balls.setAttribute("aria-hidden", "true");
      game.forEach((number) => balls.append(createBall(number)));

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "copy-game";
      copyButton.dataset.index = String(index);
      copyButton.setAttribute("aria-label", `${index + 1}게임 번호 복사`);
      copyButton.innerHTML = copyIcon();

      row.append(label, balls, copyButton);
      fragment.append(row);
    });

    elements.results.append(fragment);
  }

  function formatTimestamp(timestamp) {
    try {
      return new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(timestamp));
    } catch {
      return "최근 생성";
    }
  }

  function renderHistory() {
    const hasHistory = state.history.length > 0;
    elements.historySection.hidden = !hasHistory;
    elements.historyList.replaceChildren();
    if (!hasHistory) return;

    const fragment = document.createDocumentFragment();
    state.history.forEach((entry, index) => {
      const item = document.createElement("article");
      item.className = "history-item";

      const meta = document.createElement("div");
      meta.className = "history-meta";
      const title = document.createElement("strong");
      title.textContent = `${entry.games.length}게임 조합`;
      const time = document.createElement("time");
      time.dateTime = new Date(entry.createdAt).toISOString();
      time.textContent = formatTimestamp(entry.createdAt);
      meta.append(title, time);

      const numbers = document.createElement("div");
      numbers.className = "history-numbers";
      numbers.textContent = entry.games.map((game) => formatGame(game)).join("  ·  ");

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-history-item";
      deleteButton.dataset.historyId = entry.id;
      deleteButton.setAttribute("aria-label", `${index + 1}번째 기록 삭제`);
      deleteButton.textContent = "×";

      item.append(meta, numbers, deleteButton);
      fragment.append(item);
    });

    elements.historyList.append(fragment);
  }

  async function copyText(text, successMessage) {
    try {
      if (navigator.clipboard?.writeText && globalThis.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy command failed");
      }
      showToast(successMessage);
      return true;
    } catch {
      showToast("복사하지 못했어요. 다시 시도해 주세요.");
      return false;
    }
  }

  function handleGenerate() {
    if (isGenerating) return;
    isGenerating = true;
    elements.generateButton.disabled = true;

    try {
      state.currentGames = generateUniqueGames(state.gameCount);
      const historyEntry = {
        id: createId(),
        createdAt: Date.now(),
        games: state.currentGames.map((game) => [...game]),
      };
      state.history = [historyEntry, ...state.history].slice(0, MAX_HISTORY);
      renderResults();
      renderHistory();
      persistState();
      showToast(`${state.gameCount}게임의 행운 번호를 만들었어요.`);

      if (window.matchMedia("(max-width: 980px)").matches) {
        elements.results.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "번호를 만들지 못했어요.");
    } finally {
      window.setTimeout(() => {
        isGenerating = false;
        elements.generateButton.disabled = false;
      }, 220);
    }
  }

  function bindEvents() {
    elements.themeToggle.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });

    elements.decreaseCount.addEventListener("click", () => {
      state.gameCount = Math.max(1, state.gameCount - 1);
      renderCount();
      persistState();
    });

    elements.increaseCount.addEventListener("click", () => {
      state.gameCount = Math.min(MAX_GAME_COUNT, state.gameCount + 1);
      renderCount();
      persistState();
    });

    elements.numberGrid.addEventListener("click", (event) => {
      const button = event.target.closest(".number-choice");
      if (!button) return;
      const number = Number(button.dataset.number);

      if (state.fixedNumbers.has(number)) {
        state.fixedNumbers.delete(number);
      } else if (state.fixedNumbers.size < MAX_FIXED_COUNT) {
        state.fixedNumbers.add(number);
      }

      renderNumberGrid();
      persistState();
    });

    elements.clearFixed.addEventListener("click", () => {
      state.fixedNumbers.clear();
      renderNumberGrid();
      persistState();
      showToast("고정수 선택을 초기화했어요.");
    });

    elements.generateButton.addEventListener("click", handleGenerate);
    elements.regenerateButton.addEventListener("click", handleGenerate);

    elements.results.addEventListener("click", (event) => {
      const button = event.target.closest(".copy-game");
      if (!button) return;
      const index = Number(button.dataset.index);
      const game = state.currentGames[index];
      if (game) copyText(formatGame(game), `${index + 1}게임 번호를 복사했어요.`);
    });

    elements.copyAll.addEventListener("click", () => {
      copyText(formatGames(state.currentGames), "모든 게임 번호를 복사했어요.");
    });

    elements.shareAll.addEventListener("click", async () => {
      const text = `Lucky Six 행운 번호\n${formatGames(state.currentGames)}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Lucky Six 행운 번호", text });
          showToast("행운 번호를 공유했어요.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      copyText(text, "공유할 번호를 복사했어요.");
    });

    elements.historyList.addEventListener("click", (event) => {
      const button = event.target.closest(".delete-history-item");
      if (!button) return;
      state.history = state.history.filter((entry) => entry.id !== button.dataset.historyId);
      renderHistory();
      persistState();
      showToast("기록을 삭제했어요.");
    });

    elements.clearHistory.addEventListener("click", () => {
      const previousHistory = [...state.history];
      state.history = [];
      renderHistory();
      persistState();
      showToast("최근 기록을 모두 지웠어요.");

      window.clearTimeout(elements.clearHistory.undoTimer);
      elements.clearHistory.undoTimer = window.setTimeout(() => {
        previousHistory.length = 0;
      }, 5000);
    });
  }

  function init() {
    loadState();
    applyTheme(document.documentElement.dataset.theme);
    renderCount();
    renderNumberGrid();
    renderResults();
    renderHistory();
    bindEvents();
  }

  init();
})();
