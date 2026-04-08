export {};

declare global {
  interface Window {
    desktop?: {
      isElectron: boolean;
      platform: string;
      ai?: {
        getConfig: () => Promise<{ hasKey: boolean }>;
        generateTodos: (params: { model: string; rawText: string }) => Promise<Array<{ content: string; dueDate?: string }>>;
      };
    };
  }
}
