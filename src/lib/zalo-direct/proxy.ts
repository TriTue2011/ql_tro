/**
 * zalo-direct/proxy.ts
 * Quản lý proxy cho Zalo accounts.
 * Port từ bot server services/proxyService.js
 */

import fs from "fs";
import { getProxiesFilePath } from "./helpers";

const MAX_ACCOUNTS_PER_PROXY = 3;

export interface ProxyEntry {
  url: string;
  usedCount: number;
  accounts: any[];
}

class ProxyService {
  private RAW_PROXIES: string[] = [];
  private PROXIES: ProxyEntry[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const filePath = getProxiesFilePath();
      if (fs.existsSync(filePath)) {
        this.RAW_PROXIES = JSON.parse(fs.readFileSync(filePath, "utf8"));
      }
    } catch {
      this.RAW_PROXIES = [];
    }
    this.PROXIES = this.RAW_PROXIES.map((p) => ({ url: p, usedCount: 0, accounts: [] }));
  }

  getAvailableProxyIndex(): number {
    for (let i = 0; i < this.PROXIES.length; i++) {
      if (this.PROXIES[i].usedCount < MAX_ACCOUNTS_PER_PROXY) return i;
    }
    return -1;
  }

  getPROXIES(): ProxyEntry[] {
    return this.PROXIES;
  }

  addProxy(proxyUrl: string): ProxyEntry {
    const entry: ProxyEntry = { url: proxyUrl, usedCount: 0, accounts: [] };
    this.PROXIES.push(entry);
    this.RAW_PROXIES.push(proxyUrl);
    this.save();
    return entry;
  }

  removeProxy(proxyUrl: string): boolean {
    const idx = this.PROXIES.findIndex((p) => p.url === proxyUrl);
    if (idx === -1) return false;
    this.PROXIES.splice(idx, 1);
    const rawIdx = this.RAW_PROXIES.indexOf(proxyUrl);
    if (rawIdx !== -1) this.RAW_PROXIES.splice(rawIdx, 1);
    this.save();
    return true;
  }

  private save() {
    try {
      fs.writeFileSync(getProxiesFilePath(), JSON.stringify(this.RAW_PROXIES, null, 2));
    } catch (err: any) {
      console.error("[ZaloDirect] Lỗi lưu proxies:", err.message);
    }
  }
}

// Singleton
export const proxyService = new ProxyService();
