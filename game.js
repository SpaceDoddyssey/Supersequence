
let NUM_WORDS_TO_SHOW = 3;

// Randomly pick N unique words from the global word list.
// Returns an array like ["REACH", "RELISH", "LICH"].
function pickRandomWords(count) {
  const available = [...window.WORD_LIST];
  const chosen = [];

  while (chosen.length < count && available.length > 0) {
    const randomIndex = Math.floor(Math.random() * available.length);
    const word = available.splice(randomIndex, 1)[0];
    chosen.push(word);
  }

  return chosen;
}

//MARK: Game state
let targetWords = pickRandomWords(NUM_WORDS_TO_SHOW);

// For each word, track how many letters have been correctly matched so far.
// e.g., [2, 4, 1] means: word1 has 2 letters filled, word2 has 4, etc.
let progressByWord = targetWords.map(() => 0);
let victory = false;

// Keep a record of all letters the player has typed (for display and scoring)
let typedLetters = [];

// Cached DOM references 
const wordsContainer = document.getElementById("words");
const typedDisplay   = document.getElementById("typed");
const scoreDisplay   = document.getElementById("score");

function reset() {
  typedLetters = [];
  progressByWord = targetWords.map(() => 0);
  victory = false;
  render();
}

function newWords(){
  targetWords = pickRandomWords(NUM_WORDS_TO_SHOW);
  reset();
}

function updateWordCount(dropdown) {
  NUM_WORDS_TO_SHOW = parseInt(dropdown.value, 10);
  newWords();
}

//MARK: Rendering
// Redraws the list of words and the typed sequence on screen.
function render() {
  const wordElements = targetWords.map((word, i) => {
    const filledCount = progressByWord[i];
    const filledPart = word.slice(0, filledCount);
    const remainingPart = word.slice(filledCount);
    const complete = filledCount >= word.length;

    return `
      <div class="word ${complete ? "complete" : ""}">
        <span>${filledPart}</span>
        <span style="opacity:0.3">${remainingPart}</span>
      </div>
    `;
  });

  wordsContainer.innerHTML = wordElements.join("");
  typedDisplay.textContent = "Typed: " + typedLetters.join("");
}

// MARK: Input
function handleKey(event) {
  const letter = event.key.toUpperCase();
  if (letter < "A" || letter > "Z") return;

  let advancedAnyWord = false;

  // Check each target word.
  progressByWord = progressByWord.map((progress, i) => {
    const word = targetWords[i];
    const nextLetter = word[progress];
    const isMatch = nextLetter === letter;

    if (isMatch) {
      advancedAnyWord = true;
      return progress + 1; // move to next letter
    }

    return progress; // unchanged
  });

  // Only count keys that made progress.
  if (advancedAnyWord) typedLetters.push(letter);

  render();

  // === Win condition ===
  const allComplete = progressByWord.every(
    (p, i) => p >= targetWords[i].length
  );

  if (allComplete && !victory) {
    victory = true;
    setTimeout(() => {
      alert(
        `Completed in ${typedLetters.length} letters!\nWords: ${targetWords.join(", ")}`
      );
    }, 100);
  }
}

window.addEventListener("keydown", handleKey);
render();