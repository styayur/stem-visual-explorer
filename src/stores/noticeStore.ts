import { create } from "zustand";

export const useNoticeStore = create<{ error: string | null; clear: () => void }>((set) => ({
  error: null,
  clear: () => set({ error: null }),
}));

export function reportError(error: unknown): void {
  useNoticeStore.setState({ error: error instanceof Error ? error.message : String(error) });
}

export async function attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
  try { return await action(); } catch (error) { reportError(error); }
}
