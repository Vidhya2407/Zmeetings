import { useEffect, useState } from 'react';

type PersistApi = {
  hasHydrated?: () => boolean;
  onFinishHydration?: (callback: () => void) => () => void;
  rehydrate?: () => Promise<void> | void;
};

type StoreWithPersist = {
  persist?: PersistApi;
};

export function useHydrated(store?: StoreWithPersist): boolean {
  const [hydrated, setHydrated] = useState(() => {
    if (!store?.persist) {
      return false;
    }

    return store.persist.hasHydrated?.() ?? false;
  });

  useEffect(() => {
    if (!store?.persist) {
      setHydrated(true);
      return;
    }

    if (store.persist.hasHydrated?.()) {
      setHydrated(true);
      return;
    }

    const unsubscribe = store.persist.onFinishHydration?.(() => {
      setHydrated(true);
    });

    store.persist.rehydrate?.();

    return () => {
      unsubscribe?.();
    };
  }, [store]);

  return hydrated;
}


