import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function authedFetch(url: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function usePushNotifications(userId: string) {
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const register = async () => {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('[Push] Service worker registered');

        // Check existing subscription
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          // Get VAPID public key
          const { key } = await authedFetch('/api/push/vapid-public-key');
          const convertedKey = urlBase64ToUint8Array(key);

          // Request permission
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.log('[Push] Permission denied');
            return;
          }

          // Subscribe
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
          });
          console.log('[Push] Subscribed');
        }

        // Send subscription to backend
        await authedFetch('/api/push/subscribe', {
          method: 'POST',
          body: JSON.stringify({ subscription: sub }),
        });
        console.log('[Push] Subscription saved');
      } catch (err) {
        console.error('[Push] Registration failed:', err);
      }
    };

    register();
  }, [userId]);
}