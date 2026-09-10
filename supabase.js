import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Coloque sua URL e Key do Supabase aqui
const supabaseUrl = 'https://rshqzbrxjykqdgjgdyky.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaHF6YnJ4anlrcWRnamdkeWt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODUyNjE0OCwiZXhwIjoyMTA0MTAyMTQ4fQ.zJnRH2rSpzPe1wpKof9xKie6gH_8z9AJHCB4lROyUkY';

/**
 * Cliente exclusivo para autenticação e controle de sessão do usuário.
 * Mantém tokens persistidos com AsyncStorage e gerencia refresh automático.
 */
export const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Cliente de banco de dados do Radar.
 * Configurado com auth desativado para utilizar estritamente a chave service_role.
 * Isso garante que operações de migração de aparelhos, criação e leitura de monitores
 * nunca sejam bloqueadas ou rejeitadas por políticas de Row Level Security (RLS).
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});