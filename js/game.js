const state = {
    player: "", questions: [], current: 0, score: 0, lives: 3, streak: 0,
    bestStreak: 0, correct: 0, secondsLeft: 0, startedAt: 0, timerId: null,
    audio: new Audio(), audioContext: null, songDeck: [], answered: false, selectedWords: [], currentQuestion: null
};

const $ = (selector) => document.querySelector(selector);
const screens = document.querySelectorAll(".screen");
const timeByQuestion = [15, 14, 13, 12, 10];
const levelLabels = ["WARM UP / LEVEL 1", "EASY GROOVE / LEVEL 2", "STEADY FLOW / LEVEL 3", "DEEP LISTEN / LEVEL 4", "FINAL CHORUS / LEVEL 5"];

function showScreen(id) {
    screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
    if (id === "ranking-screen") renderRanking();
}

function shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

function makeQuestions() {
    if (!state.songDeck.length) {
        const savedDeck = JSON.parse(sessionStorage.getItem("emc-song-deck") || "[]");
        state.songDeck = savedDeck.map((title) => songs.find((song) => song.title === title)).filter(Boolean);
    }
    if (state.songDeck.length < 5) state.songDeck = state.songDeck.concat(shuffle(songs));
    const roundSongs = state.songDeck.splice(0, 5);
    sessionStorage.setItem("emc-song-deck", JSON.stringify(state.songDeck.map((song) => song.title)));
    return roundSongs.map((selectedSong) => {
        const questionId = selectedSong.questions[Math.floor(Math.random() * selectedSong.questions.length)];
        return { song: selectedSong, question: questionBank[questionId] };
    });
}

function startGame() {
    const name = $("#player-name").value.trim();
    if (!name) { $("#name-error").textContent = "Please enter your name"; $("#player-name").focus(); return; }
    state.player = name; state.current = 0; state.score = 0; state.lives = 3; state.streak = 0; state.bestStreak = 0; state.correct = 0; $("#name-error").textContent = "";
    state.questions = makeQuestions();
    showScreen("game-screen");
    renderQuestion();
}

function stopAudio() {
    state.audio.pause(); state.audio.currentTime = 0; state.audio.removeAttribute("src"); state.audio.load();
    $("#audio-dot").classList.remove("playing"); $("#audio-label").textContent = "Clip ready"; $("#play-clip").textContent = "▶";
}

function renderQuestion() {
    clearInterval(state.timerId); stopAudio(); state.answered = false; state.selectedWords = [];
    const round = state.questions[state.current]; state.currentQuestion = round.question;
    const { song, question } = round; const seconds = timeByQuestion[state.current];
    $("#question-number").textContent = state.current + 1; $("#question-progress").style.width = `${((state.current + 1) / 5) * 100}%`;
    $("#score").textContent = String(state.score).padStart(3, "0"); $("#streak").textContent = state.streak; updateLives();
    $("#song-title").textContent = song.title; $("#artist-name").textContent = song.artist; $("#song-initials").textContent = song.title.slice(0, 1).toUpperCase(); $("#song-art").style.background = song.color;
    $("#difficulty-label").textContent = levelLabels[state.current]; $("#timer").textContent = seconds; $("#timer").classList.remove("warning"); $("#feedback").textContent = ""; $("#feedback").className = "feedback"; $("#check-answer").disabled = false;
    renderSentence(question); renderWords(question); loadAudio(song.audio); startTimer(seconds);
}

function renderSentence(question) {
    const sentence = $("#sentence"); sentence.innerHTML = "";
    question.sentence.forEach((token) => {
        if (token === "___") { const slot = document.createElement("span"); slot.className = "drop-slot"; slot.dataset.slot = "0"; slot.textContent = "___"; slot.addEventListener("dragover", (event) => event.preventDefault()); slot.addEventListener("drop", dropWord); sentence.appendChild(slot); }
        else { const word = document.createElement("span"); word.className = "sentence-token"; word.textContent = token; sentence.appendChild(word); }
    });
}

function renderWords(question) {
    const bank = $("#word-bank"); bank.innerHTML = "";
    shuffle(question.options).forEach((value) => {
        const chip = document.createElement("button"); chip.className = "word-chip"; chip.textContent = value; chip.draggable = true; chip.dataset.word = value;
        chip.addEventListener("dragstart", (event) => { event.dataTransfer.setData("text/plain", value); chip.classList.add("dragging"); });
        chip.addEventListener("dragend", () => chip.classList.remove("dragging")); chip.addEventListener("click", () => chooseWord(value)); bank.appendChild(chip);
    });
}

function chooseWord(word) {
    if (state.answered) return; state.selectedWords = [word];
    const slot = $(".drop-slot"); slot.textContent = word; slot.classList.add("filled");
    document.querySelectorAll(".word-chip").forEach((chip) => chip.classList.toggle("used", chip.dataset.word === word));
}

function dropWord(event) { event.preventDefault(); chooseWord(event.dataTransfer.getData("text/plain")); }

function loadAudio(source) {
    state.audio.src = source; state.audio.preload = "auto"; state.audio.addEventListener("ended", () => { $("#audio-dot").classList.remove("playing"); $("#audio-label").textContent = "Clip ended"; $("#play-clip").textContent = "▶"; }, { once: true });
    state.audio.play().then(() => markAudioPlaying()).catch(() => { $("#audio-label").textContent = "Press play to listen"; });
}

function markAudioPlaying() { $("#audio-dot").classList.add("playing"); $("#audio-label").textContent = "Playing clip"; $("#play-clip").textContent = "Ⅱ"; }

function toggleAudio() { if (!state.audio.src) return; if (state.audio.paused) { state.audio.play().then(markAudioPlaying); } else { state.audio.pause(); $("#audio-dot").classList.remove("playing"); $("#audio-label").textContent = "Clip paused"; $("#play-clip").textContent = "▶"; } }

function startTimer(seconds) {
    state.secondsLeft = seconds; state.startedAt = Date.now(); state.timerId = setInterval(() => { state.secondsLeft -= 1; $("#timer").textContent = state.secondsLeft; if (state.secondsLeft <= 5) $("#timer").classList.add("warning"); if (state.secondsLeft <= 0) { clearInterval(state.timerId); resolveAnswer(false, true); } }, 1000);
}

function checkAnswer() { if (state.answered) return; if (!state.selectedWords.length) { $("#feedback").textContent = "Place a word before checking."; $("#feedback").className = "feedback wrong"; $("#sentence").classList.add("shake"); setTimeout(() => $("#sentence").classList.remove("shake"), 400); return; } resolveAnswer(state.selectedWords[0] === state.currentQuestion.answers[0], false); }

function resolveAnswer(isCorrect, timedOut) {
    if (state.answered) return; state.answered = true; clearInterval(state.timerId); stopAudio(); $("#check-answer").disabled = true;
    if (isCorrect) { const elapsed = (Date.now() - state.startedAt) / 1000; const speedBonus = elapsed <= 2 ? 100 : elapsed <= 5 ? 75 : elapsed <= 8 ? 50 : elapsed <= 12 ? 25 : 0; state.streak += 1; state.bestStreak = Math.max(state.bestStreak, state.streak); state.correct += 1; const streakBonus = state.streak >= 5 ? 100 : state.streak === 4 ? 75 : state.streak === 3 ? 50 : state.streak === 2 ? 25 : 0; const gained = 100 + speedBonus + streakBonus; state.score += gained; playFeedbackSound("correct"); showFeedback(`CORRECT! +${gained}`, "correct", "★"); } else { state.lives -= 1; state.streak = 0; playFeedbackSound("wrong"); updateLives(); showFeedback(timedOut ? `TIME! Correct answer: ${state.currentQuestion.answers.join(" ")}` : `WRONG! Correct answer: ${state.currentQuestion.answers.join(" ")}`, "wrong", "✕"); }
    $("#score").textContent = String(state.score).padStart(3, "0"); $("#streak").textContent = state.streak;
    setTimeout(() => { if (state.lives <= 0 || state.current >= 4) finishGame(); else { state.current += 1; renderQuestion(); } }, 1300);
}

function updateLives() { const full = "♥ ".repeat(Math.max(0, state.lives)); const empty = "♡ ".repeat(3 - state.lives); $("#lives").textContent = full + empty; $("#lives").setAttribute("aria-label", `${state.lives} lives remaining`); }

function showFeedback(message, type, icon) {
    $("#feedback").innerHTML = `<span class="feedback-icon" aria-hidden="true">${icon}</span><span>${message}</span>`;
    $("#feedback").className = `feedback ${type}`;
}

function playFeedbackSound(result) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!state.audioContext) state.audioContext = new AudioContext();
    const context = state.audioContext;
    if (context.state === "suspended") context.resume();
    const now = context.currentTime;
    const frequencies = result === "correct" ? [523.25, 659.25, 783.99] : [220, 174.61, 130.81];
    frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = result === "correct" ? "square" : "sawtooth";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.3, now + index * 0.09 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.3);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(now + index * 0.09); oscillator.stop(now + index * 0.09 + 0.32);
    });
}

function finishGame() { clearInterval(state.timerId); stopAudio(); $("#results-kicker").textContent = state.lives > 0 ? "CHALLENGE COMPLETE" : "GAME OVER"; $("#results-title").innerHTML = state.lives > 0 ? "You made<br><em>some noise.</em>" : "Keep the<br><em>beat alive.</em>"; $("#final-score").textContent = state.score; $("#result-player").textContent = state.player; $("#result-correct").textContent = `${state.correct} / 5`; $("#result-streak").textContent = state.bestStreak; $("#result-lives").textContent = `${state.lives} / 3`; saveResult(); renderRanking(); showScreen("results-screen"); }

function prepareNextPlayer() {
    clearInterval(state.timerId); stopAudio(); state.player = ""; state.questions = []; state.current = 0; state.score = 0; state.lives = 3; state.streak = 0; state.bestStreak = 0; state.correct = 0; state.answered = false; state.selectedWords = []; $("#player-name").value = ""; $("#name-error").textContent = ""; showScreen("name-screen"); $("#player-name").focus();
}

function saveResult() { const results = JSON.parse(localStorage.getItem("emc-ranking") || "[]"); results.push({ name: state.player, score: state.score, correct: state.correct, streak: state.bestStreak, date: new Date().toLocaleDateString() }); results.sort((a, b) => b.score - a.score); localStorage.setItem("emc-ranking", JSON.stringify(results.slice(0, 10))); }

function renderRanking() { const list = $("#ranking-list"); if (!list) return; const results = JSON.parse(localStorage.getItem("emc-ranking") || "[]"); list.innerHTML = results.length ? results.map((result, index) => `<div class="rank-row"><small>${String(index + 1).padStart(2, "0")}</small><span>${escapeHtml(result.name)}<br><small>${result.correct}/5 correct</small></span><strong>${result.score}</strong></div>`).join("") : `<p class="drag-hint">No scores yet. Your name could be first.</p>`; }

function clearRanking() {
    if (!localStorage.getItem("emc-ranking") || !window.confirm("Clear all ranking scores?")) return;
    localStorage.removeItem("emc-ranking");
    renderRanking();
}

function escapeHtml(value) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }

document.addEventListener("click", (event) => { const target = event.target.closest("[data-screen]"); if (target) showScreen(target.dataset.screen); });
$("#start-game").addEventListener("click", startGame); $("#player-name").addEventListener("keydown", (event) => { if (event.key === "Enter") startGame(); }); $("#check-answer").addEventListener("click", checkAnswer); $("#play-clip").addEventListener("click", toggleAudio); $("#play-again").addEventListener("click", prepareNextPlayer); $("#clear-ranking").addEventListener("click", clearRanking); renderRanking();