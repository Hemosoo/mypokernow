interface ChromeStorageChange {oldValue?: unknown; newValue?: unknown}
declare const chrome: {
  runtime: {id?: string; getURL(path: string): string; lastError?: {message?: string}; sendMessage(message: unknown): Promise<unknown>; onMessage: {addListener(callback: (message: unknown, sender: {id?: string; tab?: {id?: number}; url?: string}, sendResponse: (response: unknown) => void) => true | void): void; removeListener(callback: (message: unknown, sender: {id?: string; tab?: {id?: number}; url?: string}, sendResponse: (response: unknown) => void) => true | void): void}};
  action: {onClicked: {addListener(callback: () => void): void}};
  tabs: {create(options: {url: string}): Promise<unknown>; sendMessage(tabId: number, message:unknown): Promise<unknown>};
  storage: {
    session: {get(keys: string | string[] | null): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void>};
    local: {get(keys: string | string[] | null): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void>};
    onChanged: {addListener(callback: (changes: Record<string, ChromeStorageChange>, area: string) => void): void; removeListener(callback: (changes: Record<string, ChromeStorageChange>, area: string) => void): void};
  };
};
