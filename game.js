
let NUM_WORDS_TO_SHOW = 3;

// MARK: Word Selection
// Simple validation, will probably have more complex generation rules later
function isListValid(words) {
  const n = words.length;

  //ensure that at least 2 and at most n-1 of the initially available next letters are shared
  let firstMoveGoodness = false;
  let uniqueFirstLetters = [];
  for(let i = 0; i < n; i++){
    const firstLetter = words[i][0];
    if(!uniqueFirstLetters.includes(firstLetter)){
      uniqueFirstLetters.push(firstLetter);
    }
  }
  if(uniqueFirstLetters.length >= 2 && uniqueFirstLetters.length <= n - 1){
    firstMoveGoodness = true;
  }

  return firstMoveGoodness;
}

// Randomly pick N unique words from the global word list.
// Returns an array like ["REACH", "RELISH", "LICH"].
function pickRandomWords(count) {
  const available = [...window.WORD_LIST];
  let chosen = [];

  do {
    chosen = [];
    // Pick unique words
    while (chosen.length < count && available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const word = available.splice(randomIndex, 1)[0];
      chosen.push(word);
    }
  } while (!isListValid(chosen));

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
let wordElements = [];

function reset() {
  typedLetters = [];
  progressByWord = targetWords.map(() => 0);
  victory = false;
  scoreDisplay.textContent = ``;
  render();
}

function newWords(){
  targetWords = pickRandomWords(NUM_WORDS_TO_SHOW);
  createWordElements();
  reset();
}

// MARK: Solver Testing
const PRESET_WORD_SETS = [
  ["REACH", "RELISH", "LICH"],
  ["SAMPLE", "PRONE", "WORLD", "TOUCH"],
  ["TRAIN", "BRAIN", "DRAIN", "GRAIN", "CHAIN", "PLAIN", "STAIN"],
  ["SAMPLE", "PLAIN", "MATCH", "SIGHT", "DRAIN", "CROON", "ALONE", "BLEACH", "PLANT"],
  ["FLICK", "PRONE", "TRAIN", "DRAIN", "BRISK", "TOUCH", "STAIN"]
];

function pickWordPreset(preset){
  targetWords = PRESET_WORD_SETS[preset-1];
  createWordElements();
  reset();
  document.getElementById('presetDropdown').value = '';
}

async function testBruteForceSolver() {
  const brute = bruteForceMinSequenceAsync(targetWords);
  return brute;
}

function runSelectedSolver(value) {
  if (!value) return;
  console.log("Running solver:", value);
  document.getElementById('solverDropdown').value = '';
  if (value === 'bruteForce') return testBruteForceSolver();
  if (value === 'solver1') return testSolver1();
}

async function testSolver1() {
  let agreement = false;
  let i = 0;
  do {
    i++;
    reset();
    agreement = await compareSolvers(targetWords); // properly await the async function
  } while (agreement && i < 1); // repeat until solvers agree
}

// MARK: UI Handlers
function updateWordCount(dropdown) {
  NUM_WORDS_TO_SHOW = parseInt(dropdown.value, 10);
  newWords();
}

function createWordElements() {
  const leftCol = document.getElementById("leftColumn");
  const rightCol = document.getElementById("rightColumn");
  leftCol.innerHTML = '';
  rightCol.innerHTML = '';
  wordElements = [];

  targetWords.forEach((word, i) => {
    const leftWord = document.createElement('div');
    const rightWord = document.createElement('div');
    leftWord.classList.add('word', 'leftWord');
    rightWord.classList.add('word', 'rightWord');

    const filledSpan = document.createElement('span');
    filledSpan.classList.add('filled');
    leftWord.appendChild(filledSpan);

    const nextSpan = document.createElement('span');
    nextSpan.classList.add('next');
    rightWord.appendChild(nextSpan);

    const remainingSpan = document.createElement('span');
    remainingSpan.classList.add('remaining');
    rightWord.appendChild(remainingSpan);

    leftWord.addEventListener('click', () => inputLetter(word[progressByWord[i]]));
    rightWord.addEventListener('click', () => inputLetter(word[progressByWord[i]]));

    leftCol.appendChild(leftWord);
    rightCol.appendChild(rightWord);
    wordElements.push({ leftWord, rightWord, filledSpan, nextSpan, remainingSpan });
  });
}

//MARK: Rendering
// Redraws the list of words and the typed sequence on screen.
function render() {
  targetWords.forEach((word, i) => {
    const filledCount = progressByWord[i];
    const complete = filledCount >= word.length;
    const { leftWord, rightWord, filledSpan, nextSpan, remainingSpan } = wordElements[i];

    leftWord.classList.toggle('complete', complete);
    rightWord.classList.toggle('complete', complete);

    filledSpan.textContent = word.slice(0, filledCount);
    //if filledSpan is empty, make it a single space
    if (filledSpan.textContent === '') { filledSpan.textContent = ' ';}
    nextSpan.textContent = complete ? ' ' : word[filledCount];
    remainingSpan.textContent = complete ? ' ' : word.slice(filledCount + 1);
  });

  typedDisplay.textContent = 'Your Sequence: ' + typedLetters.join('');
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
newWords();