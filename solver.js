const batchSize = 70000;
const LOGGING_DELAY = 40000;

class Queue {
  constructor() { this.head = null; this.tail = null; this._size = 0; }
  enqueue(value) {
    const node = { value, next: null };
    if (this.tail) this.tail.next = node;
    this.tail = node;
    if (!this.head) this.head = node;
    this._size++;
  }
  dequeue() {
    if (!this.head) return null;
    const val = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this._size--;
    return val;
  }
  get length() { return this._size; }
}

function findMinSequenceAsync(words) {
  return new Promise(resolve => {
    if (words.length === 0) return resolve({ steps: 0, sequence: [] });

    const n = words.length;
    const startTime = performance.now();

    // Letter map 
    const letterMap = {};
    words.forEach((word, wi) => {
      for (let pi = 0; pi < word.length; pi++) {
        const letter = word[pi];
        if (!letterMap[letter]) letterMap[letter] = [];
        letterMap[letter].push({ wordIndex: wi, pos: pi });
      }
    });

    // Packed state (BigInt) 
    const bitsPerWord = 4; // supports <=15 letters
    function encode(progress) {
      if (progress.length <= 5) {
        // For small word sets, string keys are faster in JS
        return progress.join(",");
      } else {
        // For larger word sets, use compact BigInt
        let code = 0n;
        const bitsPerWord = 4; // supports up to 15 letters per word
        for (let i = 0; i < progress.length; i++) {
          code |= BigInt(progress[i]) << BigInt(bitsPerWord * i);
        }
        return code;
      }
    }

    // BFS queue 
    const queue = new Queue();
    queue.enqueue({ progress: new Array(n).fill(0), sequence: [] });

    const visited = new Map();
    let processed = 0;
    let best = Infinity;

    function expandBatch() {
      const batchSize = 5000;
      let localCount = 0;

      while (queue.length > 0 && localCount < batchSize) {
        const { progress, sequence } = queue.dequeue();
        if (sequence.length >= best) continue; // Early pruning

        const key = encode(progress);
        if (visited.has(key) && visited.get(key) <= sequence.length) continue;
        visited.set(key, sequence.length);

        processed++;

        // Completion check
        if (progress.every((p, i) => p >= words[i].length)) {
          best = sequence.length;
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
          console.log(`✅ Minimal sequence found in ${best} letters after ${processed.toLocaleString()} states (${elapsed}s)`);
          return resolve({ steps: best, sequence });
        }

        // Next letters using letter map 
        const nextLetters = [];
        for (const [letter, entries] of Object.entries(letterMap)) {
          let count = 0;
          for (const { wordIndex, pos } of entries) {
            if (progress[wordIndex] === pos) {
              count++;
            }
          }
          if (count > 0) nextLetters.push({ letter, count });
        }

        // Sort letters by how many words they advance (descending)
        nextLetters.sort((a, b) => b.count - a.count);

        // Generate next states
        for (const { letter } of nextLetters) {
          const newProgress = progress.map((p, i) =>
            p < words[i].length && words[i][p] === letter ? p + 1 : p
          );
          queue.enqueue({ progress: newProgress, sequence: [...sequence, letter] });
        }

        localCount++;
      }

      // Periodic logging
      if (processed % LOGGING_DELAY < batchSize) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️ ${processed.toLocaleString()} states processed | Queue: ${queue.length} | Elapsed: ${elapsed}s`);
      }

      if (queue.length > 0) setTimeout(expandBatch, 0);
    }

    expandBatch();
  });
}


// MARK: Brute-Force Solver
function bruteForceMinSequenceAsync(words) {
  return new Promise(resolve => {
    if (words.length === 0) return resolve({ minSteps: 0, minSequence: [] });

    const n = words.length;
    const startTime = performance.now();

    // Build letter map: which positions each letter appears at in each word
    const letterMap = {};
    words.forEach((word, wi) => {
      for (let pi = 0; pi < word.length; pi++) {
        const letter = word[pi];
        if (!letterMap[letter]) letterMap[letter] = [];
        letterMap[letter].push({ wordIndex: wi, pos: pi });
      }
    });

    const queue = [{ progress: new Array(n).fill(0), sequence: [] }];
    const visited = new Map();
    let processed = 0;
    let minSteps = Infinity;
    let minSequence = null;

    function encode(progress) {
      if (progress.length <= 5) {
        // For small word sets, string keys are faster
        return progress.join(",");
      } else {
        // For larger word sets, use compact BigInt
        let code = 0n;
        const bitsPerWord = 4; // supports up to 15 letters per word
        for (let i = 0; i < progress.length; i++) {
          code |= BigInt(progress[i]) << BigInt(bitsPerWord * i);
        }
        return code;
      }
    }
    function processBatch() {
      let localCount = 0;

      while (queue.length > 0 && localCount < batchSize) {
        const { progress, sequence } = queue.shift();
        processed++;

        if (sequence.length >= minSteps) continue;

        const key = encode(progress);
        if (visited.has(key) && sequence.length >= visited.get(key)) continue;
        visited.set(key, sequence.length);

        // Completion check
        if (progress.every((p, i) => p >= words[i].length)) {
          if (sequence.length < minSteps) {
            minSteps = sequence.length;
            minSequence = sequence;
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Minimal sequence found in ${minSteps} letters after ${processed.toLocaleString()} states (${elapsed}s)`);
          }
          continue;
        }

        // Next letters using letter map
        const nextLetters = [];
        for (const [letter, entries] of Object.entries(letterMap)) {
          let count = 0;
          for (const { wordIndex, pos } of entries) {
            if (progress[wordIndex] === pos) count++;
          }
          if (count > 0) nextLetters.push({ letter, count });
        }

        // Prioritize letters that advance most words
        nextLetters.sort((a, b) => b.count - a.count);

        for (const { letter } of nextLetters) {
          const newProgress = progress.map((p, i) =>
            p < words[i].length && words[i][p] === letter ? p + 1 : p
          );
          queue.push({ progress: newProgress, sequence: [...sequence, letter] });
        }

        localCount++;
      }

      // Periodic Logging 
      if (processed % LOGGING_DELAY < batchSize) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️ ${processed.toLocaleString()} states processed | Queue: ${queue.length} | Elapsed: ${elapsed}s`);
      }

      if (queue.length > 0) {
        setTimeout(processBatch, 0);
      } else {
        resolve({ minSteps, minSequence });
      }
    }

    processBatch();
  });
}


// MARK: Compare Solvers
// Compare solvers (sync or async)
// Compare solvers with optional async mode
async function compareSolvers(words, solvers) {
  const results = {};

  for (const solver of solvers) {
    const start = performance.now();
    let result;

    if (solver === 'bruteForce') result = await bruteForceMinSequenceAsync(words);
    else if (solver === 'solver1') result = await findMinSequenceAsync(words);
    else if (solver === 'AStar') result = await findMinSequenceAStar(words);
    else continue;

    const end = performance.now();
    results[solver] = {
      steps: result.minSteps ?? result.steps,
      sequence: result.minSequence ?? result.sequence,
      time: end - start
    };
  }

  // Compare steps and find fastest (same as before)
  const [firstSolver, ...others] = Object.keys(results);
  const referenceSteps = results[firstSolver].steps;
  let allMatch = true;

  for (const solver of others) {
    if (results[solver].steps !== referenceSteps) allMatch = false;
  }

  const fastest = Object.entries(results).reduce((a, b) => (a[1].time < b[1].time ? a : b))[0][0];

  return { results, allMatch, fastest };
}

// Compare solver1 vs AStar
async function compareSolver1vsAStar(words) {
  return await compareSolvers(words, ['solver1', 'AStar']);
}

// Compare all three
async function compareAllSolvers(words) {
  return await compareSolvers(words, ['bruteForce', 'solver1', 'AStar']);
}

// Loop test for 100 random sets
async function compareSolvers(words, solvers) {
  const results = {};

  for (const solver of solvers) {
    const start = performance.now();
    let result;

    if (solver === 'bruteForce') {
      result = await bruteForceMinSequenceAsync(words);
    } else if (solver === 'solver1') {
      result = await findMinSequenceAsync(words);
    } else if (solver === 'AStar') {
      result = await findMinSequenceAStar(words);
    } else {
      console.warn(`Unknown solver: ${solver}`);
      continue;
    }

    const end = performance.now();
    results[solver] = {
      steps: result.minSteps ?? result.steps,
      sequence: result.minSequence ?? result.sequence,
      time: end - start
    };
  }

  // Compare only step counts
  const [firstSolver, ...others] = Object.keys(results);
  const referenceSteps = results[firstSolver].steps;
  let allMatch = true;

  for (const solver of others) {
    const steps = results[solver].steps;
    if (steps !== referenceSteps) {
      console.log(`❌ Step count mismatch between ${firstSolver} (${referenceSteps}) and ${solver} (${steps})`);
      allMatch = false;
    } else {
      console.log(`✅ ${solver} matches ${firstSolver} in step count (${steps})`);
    }
  }

  // Show all results
  console.log("Results:");
  for (const [solver, { steps, sequence, time }] of Object.entries(results)) {
    console.log(`${solver}: ${steps} steps | ${sequence.join("")} | ${time.toFixed(2)} ms`);
  }

  // Determine fastest solver
  const fastest = Object.entries(results).reduce((a, b) => (a[1].time < b[1].time ? a : b))[0];
  console.log(`⚡ Fastest: ${fastest}`);

  return { results, allMatch, fastest };
}

// Compare solver1 vs AStar
async function compareSolver1vsAStar(words) {
  return await compareSolvers(words, ['solver1', 'AStar']);
}

// Compare all three
async function compareAllSolvers(words) {
  return await compareSolvers(words, ['bruteForce', 'solver1', 'AStar']);
}

// Looped comparison with averages and speed stats
async function compareSolversLooped(wordCount, solverSet = ['bruteForce', 'solver1', 'AStar'], iterations = 100) {
  let matches = 0;
  let mismatches = 0;
  const totalTimeStart = performance.now();

  const solverStats = {};
  for (const solver of solverSet) {
    solverStats[solver] = { totalTime: 0, wins: 0 };
  }

  for (let i = 0; i < iterations; i++) {
    const words = pickRandomWords(wordCount);
    console.log(`\n🔹 Test ${i + 1}/${iterations}: ${words.join(", ")}`);

    const { results, allMatch, fastest } = await compareSolvers(words, solverSet);

    if (allMatch) matches++;
    else mismatches++;

    // Track per-solver total time
    for (const solver of solverSet) {
      solverStats[solver].totalTime += results[solver].time;
    }

    // Track who was fastest
    solverStats[fastest].wins++;
  }

  const totalTime = (performance.now() - totalTimeStart).toFixed(2);

  console.log(`\n=== Summary (${iterations} tests, ${wordCount} words each) ===`);
  console.log(`Matches: ${matches}`);
  console.log(`${mismatches == 0 ? "✅" : "❌"} Mismatches: ${mismatches}`);
  console.log(`Total time: ${totalTime} ms\n`);

  console.log("Average runtime and fastest counts:");
  for (const [solver, stats] of Object.entries(solverStats)) {
    const avg = (stats.totalTime / iterations).toFixed(2);
    console.log(`${solver}: avg ${avg} ms | fastest ${stats.wins} times`);
  }

  return { matches, mismatches, totalTime, solverStats };
}
