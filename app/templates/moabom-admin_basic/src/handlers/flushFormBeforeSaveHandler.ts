/**
 * 저장 직전 활성 input/textarea blur — IME 조합 중 form state 미반영 방지.
 */
export async function flushFormBeforeSaveHandler(): Promise<void> {
  const active = document.activeElement;

  if (
    active instanceof HTMLInputElement
    || active instanceof HTMLTextAreaElement
    || active instanceof HTMLSelectElement
  ) {
    active.blur();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}
