import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

const SKILL_NAME = "git-guidelines";

/**
 * Verifica no histórico da sessão se a skill foi carregada,
 * seja por comando do usuário (/skill:git-guidelines)
 * ou por leitura do agente (tool 'read' no arquivo da skill).
 */
function isSkillLoaded(ctx: any): boolean {
  try {
    const entries = ctx.sessionManager.getEntries();
    return entries.some((entry: any) => {
      const content = JSON.stringify(entry);
      
      const usedCommand = content.includes(`skill:${SKILL_NAME}`) || content.includes(`/${SKILL_NAME}`);
      const wasReadByAgent = content.includes(SKILL_NAME) && content.includes("read");

      return usedCommand || wasReadByAgent;
    });
  } catch {
    return false;
  }
}

/**
 * Verifica se o comando tenta burlar os pré-commit hooks.
 */
function isBypassingPreCommitHooks(input: string): boolean {
  // 1. Flag explicitamente pedindo para ignorar verificações (--no-verify)
  const hasNoVerifyFlag = /--no-verify\b/.test(input);

  // 2. Flag curta '-n' especificamente no comando 'git commit'
  const hasCommitShortNoVerify = /\bgit\s+.*commit.*\b.*(?:\s+-[a-zA-Z]*n[a-zA-Z]*)/.test(input);

  // 3. Variáveis de ambiente comuns usadas para desativar Husky/Pre-commit
  const hasBypassEnv = /\b(HUSKY=0|HUSKY_SKIP_HOOKS=1|NO_VERIFY=1|SKIP=\S+)/i.test(input);

  // 4. Tentativa de anular a pasta de hooks via -c core.hooksPath
  const hasHooksPathBypass = /core\.hooksPath\s*=\s*(["']?\s*["']?|\/dev\/null)/i.test(input);

  return hasNoVerifyFlag || hasCommitShortNoVerify || hasBypassEnv || hasHooksPathBypass;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    let isGit = false;
    const isBash = isToolCallEventType("bash", event);
    const isCtxExecute = isToolCallEventType("ctx_execute", event);
    let input = "";

    if (isBash || isCtxExecute) {
      input = isBash 
        ? (event.input.command || "")
        : (event.input.code || "");

      isGit = /(^|\s)git\s+(status|log|commit|push|pull|branch|checkout|merge|rebase|add|diff|clone|fetch|remote|stash|reset|revert|init|config)\b/.test(input);
    }

    if (!isGit) return;

    // --- VALIDAÇÃO 1: Bloqueia qualquer tentativa de bypass de pre-commit hooks ---
    if (isBypassingPreCommitHooks(input)) {
      return {
        block: true,
        reason: `Action blocked: Bypassing pre-commit hooks (via --no-verify, -n, HUSKY=0, or core.hooksPath override) is strictly forbidden. Fix the underlying lint/test issues instead.`,
      };
    }

    // --- VALIDAÇÃO 2: Garante que a skill 'git-guidelines' está carregada ---
    if (isSkillLoaded(ctx)) {
      return;
    }

    // Bloqueia e solicita o carregamento da skill
    return {
      block: true,
      reason: `Action blocked: The '${SKILL_NAME}' skill is required before executing git commands. Please read the '${SKILL_NAME}' skill documentation or run \`/skill:${SKILL_NAME}\` first, then retry the git command.`,
    };
  });
}