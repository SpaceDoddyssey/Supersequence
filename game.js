
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
  scoreDisplay.textContent = ``;
  render();
}

function newWords(){
  targetWords = pickRandomWords(NUM_WORDS_TO_SHOW);
  reset();
  // compareSolvers(targetWords);
}

// function testNewWords(){
//   targetWords = ["PIRONE",
//   "BRITER",
//   "BALLOON",
//   "GRANT",
//   'FLAMBE',
//   "FROSTY",
//   "RIDER"]
//   reset();
//   compareSolvers(targetWords);
// }

// async function testSolvers() {
//   let agreement = false;
//   do {
//     targetWords = pickRandomWords(NUM_WORDS_TO_SHOW);
//     reset();
//     agreement = await compareSolvers(targetWords); // properly await the async function
//   } while (agreement); // repeat until solvers agree
// }

function updateWordCount(dropdown) {
  wordsContainer.innerHTML = ""
  NUM_WORDS_TO_SHOW = parseInt(dropdown.value, 10);
  newWords();
}

//MARK: Rendering
// Redraws the list of words and the typed sequence on screen.
function render() {
  targetWords.forEach((word, i) => {
    let wordEl = wordsContainer.children[i];
    const filledCount = progressByWord[i];
    const complete = filledCount >= word.length;

    if (!wordEl) {
      // Create element on first render
      wordEl = document.createElement("div");
      wordEl.classList.add("word");
      wordsContainer.appendChild(wordEl);

      // Create child spans
      const filledSpan = document.createElement("span");
      filledSpan.classList.add("filled");
      wordEl.appendChild(filledSpan);

      const nextSpan = document.createElement("span");
      nextSpan.classList.add("next");
      wordEl.appendChild(nextSpan);

      const remainingSpan = document.createElement("span");
      remainingSpan.classList.add("remaining");
      wordEl.appendChild(remainingSpan);
    }

    wordEl.classList.toggle("complete", complete);

    const [filledSpan, nextSpan, remainingSpan] = wordEl.children;

    filledSpan.textContent = word.slice(0, filledCount);
    nextSpan.textContent = complete ? "" : word[filledCount] || "";
    remainingSpan.textContent = complete ? "" : word.slice(filledCount + 1);

    wordEl.onclick = () => {
      if (complete || victory) return;
      const nextLetter = word[filledCount];
      if (!nextLetter) return;
      inputLetter(nextLetter);
    };
  });

  if (targetWords.length > 5) {
    wordsContainer.classList.add("grid-layout");
  } else {
    wordsContainer.classList.remove("grid-layout");
  }

  typedDisplay.textContent = "Your Sequence: " + typedLetters.join("");
}



// MARK: Input
function inputLetter(letter) {
  letter = letter.toUpperCase();
  if (letter < "A" || letter > "Z") return;

  let advancedAnyWord = false;

  progressByWord = progressByWord.map((progress, i) => {
    const word = targetWords[i];
    const nextLetter = word[progress];
    const isMatch = nextLetter === letter;
    if (isMatch) {
      advancedAnyWord = true;
      return progress + 1;
    }
    return progress;
  });

  if (advancedAnyWord) typedLetters.push(letter);
  render();

  const allComplete = progressByWord.every(
    (p, i) => p >= targetWords[i].length
  );

  if (allComplete && !victory) {
    victory = true;
    scoreDisplay.innerHTML = `Completed in <span class="value">${typedLetters.length}</span> letters`;
  }
}

function handleKey(event) {
  inputLetter(event.key);
}



window.addEventListener("keydown", handleKey);
// compareSolvers(targetWords);
render();