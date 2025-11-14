class PriorityQueue {
  constructor() {
    this.nodes = [];
  }

  enqueue(item, priority) {
    const nodes = this.nodes;
    const node = { item, priority };
    nodes.push(node);
    let n = nodes.length - 1;

    // Bubble up
    const nodePriority = node.priority;
    while (n) {
      const parentN = (n - 1) >> 1;
      const parent = nodes[parentN];
      if (nodePriority >= parent.priority) break;
      nodes[parentN] = node;
      nodes[n] = parent;
      n = parentN;
    }
  }

  dequeue() {
    const nodes = this.nodes;
    const length = nodes.length;
    if (!length) return undefined;

    const smallest = nodes[0];
    const end = nodes.pop();
    if (length > 1) {
      nodes[0] = end;

      // Sink down
      const node = end;
      const nodePriority = node.priority;
      let n = 0;
      const len = length - 1;
      while (true) {
        const child1N = (n << 1) + 1;
        const child2N = child1N + 1;
        let swap = null;

        if (child1N < len) {
          const child1 = nodes[child1N];
          if (child1.priority < nodePriority) swap = child1N;
        }

        if (child2N < len) {
          const child2 = nodes[child2N];
          const child1Priority = swap === null ? nodePriority : nodes[child1N].priority;
          if (nodes[child2N].priority < child1Priority) swap = child2N;
        }

        if (swap === null) break;

        nodes[n] = nodes[swap];
        nodes[swap] = node;
        n = swap;
      }
    }

    return smallest.item;
  }

  get length() {
    return this.nodes.length;
  }
}

let oldheuristicVictories = 0;
let newheuristicVictories = 0;
let ties = 0;

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

    const heuristic = (progress) => {
      let maxRem = 0;
      const remainingLetters = new Set();
      for (let i = 0; i < n; i++) {
        const wordLengthI = wordLengths[i];
        const progressI = progress[i];
        const rem = wordLengthI - progressI;
        if (rem > maxRem) maxRem = rem;
        for (let j = progressI; j < wordLengthI; j++) remainingLetters.add(wordLetterSets[i][j]);
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

      return Math.max(maxRem + extraLetters, remainingLetters.size);
    }

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