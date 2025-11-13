class PriorityQueue {
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
function findMinSequenceAStar(words) {
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
    const heuristic = (progress) => {
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

    const queue = new PriorityQueue();
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