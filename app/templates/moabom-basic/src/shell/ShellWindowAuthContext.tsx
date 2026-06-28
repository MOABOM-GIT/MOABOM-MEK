import { createContext, useContext, type ReactNode } from 'react';
import { useShellAuthStateKey } from './moaShellAuthStateKey';

const ShellWindowAuthContext = createContext<string | undefined>(undefined);

export function ShellWindowAuthProvider({
  authStateKey,
  children,
}: {
  authStateKey: string;
  children: ReactNode;
}) {
  return (
    <ShellWindowAuthContext.Provider value={authStateKey}>
      {children}
    </ShellWindowAuthContext.Provider>
  );
}

/** 셸 창 렌더러가 주입한 `authStateKey` 우선, 없으면 전역 스토어 */
export function useShellWindowAuthStateKey(): string {
  const fromParent = useContext(ShellWindowAuthContext);
  const fromStore = useShellAuthStateKey();
  return fromParent ?? fromStore;
}
