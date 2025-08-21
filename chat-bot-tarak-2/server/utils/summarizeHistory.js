module.exports = async function summarizeHistory(historyArray) {
  if (!historyArray.length) return "No prior user information available.";

  const messages = historyArray.map(h => `User: ${h.userMessage}\nBot: ${h.botResponse}`).join("\n");

  // Very simple summarization
  const summary = `This user tends to ask about:\n` +
                  [...new Set(historyArray.map(h => h.topic || "general topics"))].join(', ') +
                  `\nRecent topics include:\n${messages.slice(0, 500)}...`;

  return summary;
};
