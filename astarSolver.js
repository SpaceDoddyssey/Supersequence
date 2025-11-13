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
      const parentN = Math.floor((n + 1) / 2) - 1;
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
      const child2N = (n + 1) * 2;
      const child1N = child2N - 1;
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


function findMinSequenceAStar(words) {
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

    // Packed state
    const bitsPerWord = 4;
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

    // Heuristic: max remaining length
    const heuristic = (progress) => {
      let maxRem = 0;
      for (let i = 0; i < words.length; i++) {
        maxRem = Math.max(maxRem, words[i].length - progress[i]);
      }
      return maxRem;
    };

    const queue = new PriorityQueue();
    const startProgress = new Array(n).fill(0);
    queue.enqueue({ progress: startProgress, sequence: [] }, heuristic(startProgress));

    const visited = new Map();
    let processed = 0;
    let best = Infinity;

    function expandBatch() {
      let localCount = 0;

      while (queue.length > 0 && localCount < batchSize) {
        const { progress, sequence } = queue.dequeue();
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
          const oldProgress = [];
          for (let i = 0; i < n; i++) {
            oldProgress[i] = progress[i];
            if (progress[i] < words[i].length && words[i][progress[i]] === letter) {
              progress[i]++;
            }
          }

          // Only create new sequence array here (can optimize later if needed)
          queue.enqueue({ progress: [...progress], sequence: [...sequence, letter] }, sequence.length + 1 + heuristic(progress));

          // Restore progress for the next iteration
          for (let i = 0; i < n; i++) progress[i] = oldProgress[i];
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