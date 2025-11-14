const batchSize = 200000;
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
    const letterEntries = Object.entries(letterMap);

    // Packed state
    const bitsPerWord = 4;
    function encode(progress) {
      // For small word sets, about <= 5, string keys are slightly faster than bigInt
      // But it's such a small improvement that I'd rather save the if on large sets
      // return progress.join(",");
      let code = 0n;
      const b = BigInt(bitsPerWord);
      let shift = 0n;
      for (let i = 0; i < progress.length; i++) {
        code |= BigInt(progress[i]) << shift;
        shift += b;
      }
      return code;
    }

    const wordLetterSets = words.map(word => {
      const letters = new Array(word.length);
      for (let i = 0; i < word.length; i++) letters[i] = word[i];
      return letters;
    });
    const wordLengths = words.map(w => w.length);

    // MARK: Heuristic
    const newheuristic = (progress) => {
      let maxRem = 0;
      const remainingLetters = new Set();
      for (let i = 0; i < n; i++) {
        const wordLengthI = wordLengths[i];
        const progressI = progress[i];
        const rem = wordLengthI - progressI;
        if (rem > maxRem) maxRem = rem;
        for (let j = progressI; j < wordLengthI; j++) remainingLetters.add(wordLetterSets[i][j]);
      }
      // Admissible lower bound: must perform at least the max remaining length,
      // and also must include each distinct remaining letter at least once.
      return Math.max(maxRem, remainingLetters.size);
    };
    
    const oldheuristic = (progress) => {
      // Step 1: find max remaining letters of any word
      let maxRem = 0;
      const remainingLetters = new Set();
      for (let i = 0; i < n; i++) {
        const wordLengthI = wordLengths[i];
        const progressI = progress[i];
        const rem = wordLengthI - progressI;
        if (rem > maxRem) maxRem = rem;

        // Add remaining letters for this word
        for (let j = progressI; j < wordLengthI; j++) {
          remainingLetters.add(wordLetterSets[i][j]);
        }
      }

      // Step 2: remove letters that appear in the word(s) with maxRem
      const lettersInMaxRem = new Set();
      for (let i = 0; i < n; i++) {
        const wordLengthI = wordLengths[i];
        const progressI = progress[i];
        if (wordLengthI - progressI === maxRem) {
          for (let j = progressI; j < wordLengthI; j++) {
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

    const heuristic = (progress) => {
      const newH = newheuristic(progress);
      const oldH = oldheuristic(progress);
      return Math.max(newH, oldH);
    }

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
        const node = queue.dequeue();
        if (!node) break; // queue is empty
        const { progress, sequence } = node;
        localCount++;

        if (sequence.length >= best) continue;

        const key = encode(progress);
        if (visited.has(key) && visited.get(key) <= sequence.length) continue;
        visited.set(key, sequence.length);

        processed++;

        // Completion check
        let done = true;
        for (let i = 0; i < n; i++) { if (progress[i] < wordLengths[i]) { done = false; break; } }
        if (done) {
          best = sequence.length;
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
          console.log(`✅ Minimal sequence found in ${best} letters after ${processed.toLocaleString()} states (${elapsed}s)`);
          return resolve({ steps: best, sequence });
        }

        // Next letters using letter map
        const nextLetters = [];
        for (const [letter, entries] of letterEntries) {
          let count = 0;
          for (const { wordIndex, pos } of entries) if (progress[wordIndex] === pos) count++;
          if (count > 0) nextLetters.push({ letter, count });
        }

        // Sort letters by how many words they advance (descending)
        nextLetters.sort((a, b) => b.count - a.count);

        // Generate next states
        for (const { letter } of nextLetters) {
          const newProgress = new Uint8Array(progress);
          for (let i = 0; i < n; i++) {
            if (newProgress[i] < wordLengths[i] && words[i][newProgress[i]] === letter) {
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
// Compare solver1 vs AStar
async function compareSolver1vsAStar() {
  return await compareSolvers(targetWords, ['OldAStar', 'OptimizedAStar']);
}

// Compare all three
async function compareAllSolvers() {
  return await compareSolvers(targetWords, ['bruteForce', 'OldAStar', 'OptimizedAStar']);
}

// Compare solver1 vs AStar over 100 random sets
async function compareSolver1vsAStarLooped(wordCount = targetWords.length, iterations = 500) {
  return await compareSolversLooped(wordCount, ['OldAStar', 'OptimizedAStar'], iterations);
}

// Compare all three solvers over 100 random sets
async function compareAllSolversLooped(wordCount = targetWords.length, iterations = 300) {
  return await compareSolversLooped(wordCount, ['bruteForce', 'OldAStar', 'OptimizedAStar'], iterations);
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

// Looped comparison with averages and speed stats
async function compareSolversLooped(wordCount, solverSet = ['bruteForce', 'OldAStar', 'AStar'], iterations = 100) {
  let matches = 0;
  let mismatches = 0;
  oldheuristicVictories = 0;
  newheuristicVictories = 0;
  ties = 0;
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

  console.log(`Old H wins: ${oldheuristicVictories}`)
  console.log(`New H wins: ${newheuristicVictories}`)
  console.log(`Ties: ${ties}`)

  return { matches, mismatches, totalTime, solverStats };
}
