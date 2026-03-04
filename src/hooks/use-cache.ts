import { useState, useCallback } from 'react';

interface CacheConfig {
  key: string;
  duration?: number; // milliseconds, mặc định 5 phút
}

interface CachedData<T> {
  timestamp: number;
  data: T;
}

export function useCache<T>(config: CacheConfig) {
  const { key, duration = 300000 } = config; // 5 phút mặc định
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get cached data
  const getCache = useCallback((): T | null => {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;

      const parsed: CachedData<T> = JSON.parse(cached);
      const now = Date.now();

      // Kiểm tra cache còn hiệu lực không
      if (now - parsed.timestamp < duration) {
        return parsed.data;
      }

      // Cache hết hạn, xóa luôn
      sessionStorage.removeItem(key);
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }, [key, duration]);

  // Set cached data
  const setCache = useCallback((data: T) => {
    try {
      const cacheData: CachedData<T> = {
        timestamp: Date.now(),
        data,
      };
      sessionStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }, [key]);

  // Clear cache
  const clearCache = useCallback(() => {
    sessionStorage.removeItem(key);
  }, [key]);

  // Clear all dashboard caches
  const clearAllCaches = useCallback(() => {
    const keys = [
      'hop-dong-data',
      'hoa-don-data',
      'phong-data',
      'khach-thue-data',
      'toa-nha-data',
      'thanh-toan-data',
      'su-co-data',
      'tai-khoan-data',
    ];
    keys.forEach(k => sessionStorage.removeItem(k));
  }, []);

  return {
    getCache,
    setCache,
    clearCache,
    clearAllCaches,
    isRefreshing,
    setIsRefreshing,
  };
}

