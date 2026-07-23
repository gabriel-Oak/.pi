import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

const SKILL_NAME = "git-guidelines";

export default function (pi: ExtensionAPI) {
  // Instrui o agente a carregar a skill no início de cada agent run
  pi.on("before_agent_start", async (event) => {
    event.systemPrompt +=
      `\n\n# Git Guidelines\n` +
      `Before performing ANY git operation, you MUST run \`/skill:${SKILL_NAME}\` to load the git guidelines and follow them.\n` +
      `Rules: never commit .gitignore files, never force push without approval, never bypass hooks, always ask before commit/push/pull.`;
  });

  pi.on("tool_call", async (event, ctx) => {
    let isGit = false;

    if (isToolCallEventType("bash", event)) {
      const cmd = event.input.command || "";
      isGit = /(^|\s)git\s+(status|log|commit|push|pull|branch|checkout|merge|rebase|add|diff|clone|fetch|remote|stash|reset|revert|init|config)\b/.test(cmd);
    } else if (isToolCallEventType("ctx_execute", event)) {
      const code = event.input.code || "";
      isGit = /(^|\s)git\s+(status|log|commit|push|pull|branch|checkout|merge|rebase|add|diff|clone|fetch|remote|stash|reset|revert|init|config)\b/.test(code);
    }

    if (!isGit) return;

    // Verifica se já houve alguma tentativa de git bloqueada anteriormente
    // (verifica entry custom no session)
    try {
      const entries = ctx.sessionManager.getEntries();
      const hasGitBlocked = entries.some(
        (e: any) => e.type === "custom" && e.customType === "git-blocked"
      );
      if (hasGitBlocked) {
        return; // Já bloqueou antes, permite git agora
      }
    } catch {
      return;
    }

    // Primeira vez — marca e bloqueia
    try {
      pi.appendEntry("git-blocked", {});
    } catch {
      // Ignora se entry já existe
    }

    return {
      block: true,
      reason: `Run \`/skill:${SKILL_NAME}\` first to load git guidelines, then retry the git command.`,
    };
  });
}
