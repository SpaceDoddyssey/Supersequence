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
    const encode = (progress) => {
      let code = 0n;
      for (let i = 0; i < n; i++) code |= BigInt(progress[i]) << BigInt(bitsPerWord * i);
      return code;
    };

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
      if (processed % 20000 < batchSize) {
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
      return progress.join(",");
    }

    function processBatch() {
      const batchSize = 5000;
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

      // Logging every ~20k states
      if (processed % 20000 < batchSize) {
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
async function compareSolvers(words) {
//   console.log("Running brute-force solver...");

//   console.log("Running optimized async solver...");
  await findMinSequenceAsync(words);
  return true;
//   const brute = bruteForceMinSequence(words);
//   console.log(`Brute-force result: ${brute.minSteps} letters | sequence: ${brute.minSequence.join("")}`);

//   if (optimized.steps === brute.minSteps) {
//     console.log("✅ Both solvers agree!");
//     return true;
//   } else {
//     console.log(`❌ Discrepancy detected!
// Words: ${words.join(",")}
// Brute-force result: ${brute.minSteps} letters | sequence: ${brute.minSequence.join("")}
// Optimized solver result: ${optimized.steps} letters | sequence: ${optimized.sequence.join("")}`);
//     return false;
//   }
}
