const DB_NAME = "recall-vault";
const STORE_NAME = "keys";
const KEY_ID = "device-key";
const LEGACY_KEY = "recall.demo.v2";
const VAULT_KEY = "recall.demo.v3.enc";
let memoryKey: CryptoKey | null = null;
let writeChain: Promise<void> = Promise.resolve();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

async function getKey(): Promise<CryptoKey> {
  if (memoryKey) return memoryKey;
  const db = await openDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(KEY_ID);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error);
  });
  if (existing) {
    memoryKey = existing;
    return existing;
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  memoryKey = key;
  return key;
}

export function encryptionAvailable(): boolean {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle) && typeof indexedDB !== "undefined";
}

export async function encryptJson(value: unknown): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, plaintext);
  return JSON.stringify({ v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) });
}

export async function decryptJson<T>(encoded: string): Promise<T | null> {
  try {
    const parsed = JSON.parse(encoded) as { v: number; iv: string; data: string };
    if (parsed.v !== 1) return null;
    const key = await getKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(parsed.iv) as unknown as BufferSource },
      key,
      fromBase64(parsed.data) as unknown as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export async function loadVault<T>(): Promise<T | null> {
  if (!encryptionAvailable()) return null;
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  return decryptJson<T>(raw);
}

export async function saveVault(value: unknown): Promise<boolean> {
  if (!encryptionAvailable()) return false;
  writeChain = writeChain.then(async () => {
    try {
      const encoded = await encryptJson(value);
      localStorage.setItem(VAULT_KEY, encoded);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* keep the previous ciphertext rather than corrupting the store */
    }
  });
  await writeChain;
  return true;
}

export function clearVault(): void {
  try {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function legacyRaw(): string | null {
  try {
    return localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}
