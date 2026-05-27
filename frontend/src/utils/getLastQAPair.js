/** Last completed user question + bot answer from message list */
export function getLastQAPair(messages) {
  let answer = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type === "bot" && !m.typing && m.text && !answer) {
      answer = m.text;
      continue;
    }
    if (m.type === "user" && m.text) {
      return { question: m.text, answer };
    }
  }
  return { question: null, answer: null };
}
