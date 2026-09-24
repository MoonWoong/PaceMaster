/**
 * Security verification module
 * Strict password requirement: 'ansdnd1!' for all create, update, delete operations.
 */

export const RUNNER_SECURITY_KEY = 'ansdnd1!';

// Event listener for opening the custom sleek security modal
type SecurityPromptCallback = (password: string | null) => void;

let activePromptResolver: SecurityPromptCallback | null = null;
let promptListener: ((actionName: string) => void) | null = null;

export function registerSecurityPromptListener(
  listener: (actionName: string) => void
) {
  promptListener = listener;
}

export function unregisterSecurityPromptListener() {
  promptListener = null;
}

export function resolveSecurityPrompt(inputKey: string | null): boolean {
  if (!activePromptResolver) return false;

  const isValid = inputKey === RUNNER_SECURITY_KEY;
  activePromptResolver(inputKey);
  activePromptResolver = null;
  return isValid;
}

/**
 * Main function to request security key confirmation.
 * Uses custom glassmorphic modal if registered, with graceful window.prompt fallback.
 */
export async function verifyRunnerSecurityKey(actionTitle = '데이터 변경'): Promise<boolean> {
  const currentListener = promptListener;
  if (currentListener) {
    return new Promise((resolve) => {
      activePromptResolver = (enteredKey) => {
        resolve(enteredKey === RUNNER_SECURITY_KEY);
      };
      currentListener(actionTitle);
    });
  }

  // Fallback to browser prompt if modal is unmounted
  const userInput = window.prompt(
    `[보안 인증] ${actionTitle}을(를) 진행하시려면 보안 키(비밀번호)를 입력하세요:`
  );

  if (userInput === null) {
    return false;
  }

  if (userInput.trim() === RUNNER_SECURITY_KEY) {
    return true;
  } else {
    alert('비밀번호가 올바르지 않습니다. 작업이 취소되었습니다.');
    return false;
  }
}
