import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

const SKILL_NAME = "git-guidelines";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    let isGit = false;

    if (isToolCallEventType("bash", event) || isToolCallEventType("ctx_execute", event)) {
      const input = isToolCallEventType("bash", event) 
        ? (event.input.command || "")
        : (event.input.code || "");
      isGit = /(^|\s)git\s+(status|log|commit|push|pull|branch|checkout|merge|rebase|add|diff|clone|fetch|remote|stash|reset|revert|init|config)\b/.test(input);
    }

    if (!isGit) return;

    // Verifica se a skill git-guidelines está carregada no contexto
    // Busca no system prompt se a skill foi injetada (via /skill:git-guidelines)
    try {
      const systemPrompt = ctx.getSystemPrompt();
      const hasSkillInPrompt = systemPrompt.includes(SKILL_NAME) && 
                               systemPrompt.includes("Git Guidelines");
      
      if (hasSkillInPrompt) {
        // Skill carregada no system prompt, permite git
        return;
      }
    } catch {
      // Ignora se não conseguir ler system prompt
    }

    // Verifica se já houve git bloqueado antes (fallback)
    try {
      const entries = ctx.sessionManager.getEntries();
      const hasGitBlocked = entries.some(
        (e: any) => e.type === "custom" && e.customType === "git-blocked"
      );
      if (hasGitBlocked) {
        return; // Já bloqueou antes, permite git
      }
    } catch {
      // Ignora
    }

    // Primeira vez — marca como bloqueada e bloqueia
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
