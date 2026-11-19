export function fallbackConfigured() {
  try {
    return Boolean(
      process.env.REPORT_LLM_API_KEY &&
      process.env.REPORT_LLM_MODEL &&
      process.env.REPORT_LLM_URL &&
      new URL(process.env.REPORT_LLM_URL).protocol === "https:",
    );
  } catch {
    return false;
  }
}

export const copilotConfigured = () =>
  Boolean(process.env.COPILOT_GITHUB_TOKEN);
