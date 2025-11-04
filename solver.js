// Naive solver with progress logging and non-blocking BFS batching
function findMinSolutionAsync(words, onUpdate, onComplete) {
  const n = words.length;
  const start = new Array(n).fill(0);
  const visited = new Set();
  const queue = [{ progress: start, steps: 0 }];
  let processed = 0;
  let best = Infinity;
  let startTime = performance.now();

  function serialize(prog) {
    return prog.join(",");
  }

  function expandBatch() {
    const batchSize = 5000; // adjust for responsiveness
    let localCount = 0;

    while (queue.length > 0 && localCount < batchSize) {
      const { progress, steps } = queue.shift();
      const key = serialize(progress);
      if (visited.has(key)) continue;
      visited.add(key);
      processed++;

      // Check if done
      if (progress.every((p, i) => p >= words[i].length)) {
        best = Math.min(best, steps);
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        console.log(
          `✅ Solution found in ${steps} steps after ${processed} states (${elapsed}s)`
        );
        onComplete?.(best, processed);
        return;
      }

      // Collect next letters
      const nextLetters = new Set();
      for (let i = 0; i < n; i++) {
        if (progress[i] < words[i].length)
          nextLetters.add(words[i][progress[i]]);
      }

      // Enqueue next states
      for (const letter of nextLetters) {
        const newProgress = progress.map((p, i) =>
          p < words[i].length && words[i][p] === letter ? p + 1 : p
        );
        queue.push({ progress: newProgress, steps: steps + 1 });
      }

      localCount++;
    }

    // Logging
    if (processed % 10000 < batchSize)
      onUpdate?.({
        processed,
        queueSize: queue.length,
        best,
      });

    if (queue.length > 0) {
      setTimeout(expandBatch, 0); // yield to browser
    } else {
      console.log("❌ Search exhausted, no solution found (shouldn't happen)");
      onComplete?.(best, processed);
    }
  }

  console.log(
    `Starting solver for ${n} words, lengths: [${words.map((w) => w.length).join(
      ", "
    )}]`
  );
  expandBatch();
}