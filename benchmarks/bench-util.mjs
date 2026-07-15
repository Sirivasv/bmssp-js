// Minimal timing helpers for the benchmarks. Dependency-free.

// Time `fn` once, returning milliseconds (high-resolution).
export function timeOnce(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  const end = process.hrtime.bigint();
  return { ms: Number(end - start) / 1e6, value };
}

// Run `fn` `iters` times after `warmup` untimed runs; return summary stats.
export function timeMany(fn, { iters = 5, warmup = 1 } = {}) {
  for (let i = 0; i < warmup; i++) fn();
  const samples = [];
  for (let i = 0; i < iters; i++) {
    samples.push(timeOnce(fn).ms);
  }
  samples.sort((a, b) => a - b);
  const sum = samples.reduce((s, x) => s + x, 0);
  return {
    min: samples[0],
    max: samples[samples.length - 1],
    median: samples[Math.floor(samples.length / 2)],
    mean: sum / samples.length,
    iters,
  };
}

// Render an array of row objects as a GitHub-flavored markdown table.
export function markdownTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${headers.map((h) => String(r[h] ?? "")).join(" | ")} |`)
    .join("\n");
  return [head, sep, body].join("\n");
}

export function fmt(ms) {
  return ms.toFixed(2);
}
