const batchSize = 700000;
const LOGGING_DELAY = 500000;

class PriorityQueueOld {
  constructor() { this.nodes = []; }

  enqueue(item, priority) {
    this.nodes.push({ item, priority });
    this._bubbleUp(this.nodes.length - 1);
  }

  dequeue() {
    const smallest = this.nodes[0];
    const end = this.nodes.pop();
    if (this.nodes.length > 0) {
      this.nodes[0] = end;
      this._sinkDown(0);
    }
    return smallest.item;
  }

  _bubbleUp(n) {
    const node = this.nodes[n];
    while (n > 0) {
      const parentN = (n - 1) >> 1;
      const parent = this.nodes[parentN];
      if (node.priority >= parent.priority) break;
      this.nodes[parentN] = node;
      this.nodes[n] = parent;
      n = parentN;
    }
  }

  _sinkDown(n) {
    const length = this.nodes.length;
    const node = this.nodes[n];
    while (true) {
      const child1N = (n << 1) + 1;
      const child2N = child1N + 1;
      let swap = null;

      if (child1N < length) {
        const child1 = this.nodes[child1N];
        if (child1.priority < node.priority) swap = child1N;
      }

      if (child2N < length) {
        const child2 = this.nodes[child2N];
        if ((swap === null ? node.priority : this.nodes[child1N].priority) > child2.priority) swap = child2N;
      }

      if (swap === null) break;

      this.nodes[n] = this.nodes[swap];
      this.nodes[swap] = node;
      n = swap;
    }
  }

  get length() { return this.nodes.length; }
}

//MARK: A*
function findMinAstarOld(words) {
  return new Promise(resolve => {
    const n = words.length;
    if (n === 0) return resolve({ steps: 0, sequence: [] });

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

    // Packed state
    const bitsPerWord = 4;
    function encode(progress) {
      if (progress.length <= 5) {
        // For small word sets, string keys are faster in JS
        return progress.join(",");
      } else {
        // For larger word sets, use compact BigInt
        let code = 0n;
        for (let i = 0; i < progress.length; i++) {
          code |= BigInt(progress[i]) << BigInt(bitsPerWord * i);
        }
        return code;
      }
    }

    const wordLetterSets = words.map(word => {
      const letters = new Array(word.length);
      for (let i = 0; i < word.length; i++) letters[i] = word[i];
      return letters;
    });

    // MARK: Heuristic
    const newheuristic = (progress) => {
      let maxRem = 0;
      const remainingLetters = new Set();
      for (let i = 0; i < n; i++) {
        const rem = words[i].length - progress[i];
        if (rem > maxRem) maxRem = rem;
        for (let j = progress[i]; j < words[i].length; j++) remainingLetters.add(wordLetterSets[i][j]);
      }
      // Admissible lower bound: must perform at least the max remaining length,
      // and also must include each distinct remaining letter at least once.
      return Math.max(maxRem, remainingLetters.size);
    };
    
    const oldheuristic = (progress) => {
      let maxRem = 0;
      const remainingLetters = new Set();

      // Step 1: find max remaining letters of any word
      for (let i = 0; i < n; i++) {
        const rem = words[i].length - progress[i];
        if (rem > maxRem) maxRem = rem;

        // Add remaining letters for this word
        for (let j = progress[i]; j < words[i].length; j++) {
          remainingLetters.add(wordLetterSets[i][j]);
        }
      }

      // Step 2: remove letters that appear in the word(s) with maxRem
      const lettersInMaxRem = new Set();
      for (let i = 0; i < n; i++) {
        if (words[i].length - progress[i] === maxRem) {
          for (let j = progress[i]; j < words[i].length; j++) {
            lettersInMaxRem.add(wordLetterSets[i][j]);
          }
        }
      }

      // Step 3: count remaining letters not in maxRem word(s)
      let extraLetters = 0;
      for (const l of remainingLetters) {
        if (!lettersInMaxRem.has(l)) extraLetters++;
      }

      return maxRem + extraLetters;
    };

    const heuristic = (progress) => Math.max(newheuristic(progress), oldheuristic(progress));

    const queue = new PriorityQueueOld();
    const startProgress = new Uint8Array(n);
    queue.enqueue({ progress: startProgress, sequence: [] }, heuristic(startProgress));

    const visited = new Map();
    let processed = 0;
    let best = Infinity;

    //MARK: Expand batch
    function expandBatch() {
      let localCount = 0;

      while (queue.length > 0 && localCount < batchSize) {
        const { progress, sequence } = queue.dequeue();
        localCount++;

        if (sequence.length >= best) continue;

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
          for (const { wordIndex, pos } of entries) if (progress[wordIndex] === pos) count++;
          if (count > 0) nextLetters.push({ letter, count });
        }

        // Sort letters by how many words they advance (descending)
        nextLetters.sort((a, b) => b.count - a.count);

        // Generate next states
        for (const { letter } of nextLetters) {
          const newProgress = progress.slice(); // fresh copy
          for (let i = 0; i < n; i++) {
            if (newProgress[i] < words[i].length && words[i][newProgress[i]] === letter) {
              newProgress[i]++;
            }
          }

          const newSequence = sequence + letter;

          queue.enqueue({
            progress: newProgress,
            sequence: newSequence
          }, newSequence.length + heuristic(newProgress));
        }
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
    else if (solver === 'OldAStar') result = await findMinAstarOld(words);
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
  return await compareSolvers(words, ['OldAStar', 'OptimizedAStar']);
}

// Compare all three
async function compareAllSolvers(words) {
  return await compareSolvers(words, ['bruteForce', 'OldAStar', 'OptimizedAStar']);
}

// Loop test for 100 random sets
async function compareSolvers(words, solvers) {
  const results = {};

  for (const solver of solvers) {
    const start = performance.now();
    let result;

    if (solver === 'bruteForce') {
      result = await bruteForceMinSequenceAsync(words);
    } else if (solver === 'OldAStar') {
      result = await findMinAstarOld(words);
    } else if (solver === 'OptimizedAStar') {
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
    console.log(`${solver}: ${steps} steps | ${sequence} | ${time.toFixed(2)} ms`);
  }

  // Determine fastest solver
  const fastest = Object.entries(results).reduce((a, b) => (a[1].time < b[1].time ? a : b))[0];
  console.log(`⚡ Fastest: ${fastest}`);

  return { results, allMatch, fastest };
}

// Compare solver1 vs AStar
async function compareSolver1vsAStar(words) {
  return await compareSolvers(words, ['OldAStar', 'AStar']);
}

// Compare all three
async function compareAllSolvers(words) {
  return await compareSolvers(words, ['bruteForce', 'OldAStar', 'AStar']);
}

// Looped comparison with averages and speed stats
async function compareSolversLooped(wordCount, solverSet = ['bruteForce', 'OldAStar', 'AStar'], iterations = 100) {
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
