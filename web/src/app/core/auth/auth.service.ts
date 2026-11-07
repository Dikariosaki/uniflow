import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runtimeConfig } from '../config/runtime-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private clientPromise?: Promise<SupabaseClient | null>;

  private client() {
    this.clientPromise ??=
      runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey
        ? import('@supabase/supabase-js').then(({ createClient }) =>
            createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
              auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage,
              },
            }),
          )
        : Promise.resolve(null);
    return this.clientPromise;
  }

  async signIn(email: string, password: string) {
    const client = await this.client();
    if (!client) throw new Error('Configura Supabase Auth para iniciar sesión.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }

  async signOut() {
    await (await this.client())?.auth.signOut();
  }
  async updatePassword(password: string) {
    const client = await this.client();
    if (!client) throw new Error('Configura Supabase Auth para continuar.');
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
  }
  async sendPasswordReset(email: string) {
    const client = await this.client();
    if (!client) throw new Error('Configura Supabase Auth para recuperar la contraseña.');
    const redirectTo = `${window.location.origin}/personal/login`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }
  async accessToken() {
    if (!this.clientPromise) return null;
    return (
      (await this.clientPromise)?.auth
        .getSession()
        .then(({ data }) => data.session?.access_token ?? null) ?? null
    );
  }
  async session() {
    return (await this.client())?.auth.getSession().then(({ data }) => data.session) ?? null;
  }
}
