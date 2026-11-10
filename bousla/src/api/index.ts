import type { Api } from './types';
import { createSupabaseApi } from './supabaseApi';
import { createDeviceApi } from './deviceApi';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cloud when Supabase is configured at build time; otherwise device-only mode. */
export const cloudConfigured = !!(url && key && url.startsWith('https://'));

export const api: Api = cloudConfigured ? createSupabaseApi(url!, key!) : createDeviceApi();

if (!cloudConfigured && typeof window !== 'undefined') {
  // Device-mode admin helper, for previews only: __bousla.promoteToTeacher('email')
  (window as unknown as { __bousla: unknown }).__bousla = api;
}
