export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function typeText(text, cb) {
  if (!text || typeof text !== "string") { cb("No response"); return; }
  let out = "";
  for (const ch of text) { out += ch; cb(out); await sleep(6); }
}
