/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Uma pequena validação de segurança para garantir que as variáveis do .env foram lidas
if (!rawSupabaseUrl || !supabaseAnonKey) {
  throw new Error('Atenção: Variáveis de ambiente do Supabase não encontradas no arquivo .env.local');
}

// Normaliza a URL do projeto: em alguns ambientes (ex.: env da Vercel copiada do
// painel) o valor vem com o caminho "/rest/v1" ou barra final, o que faz o Supabase
// Auth falhar com "Invalid path specified in request URL". Mantemos só a origem.
const supabaseUrl = rawSupabaseUrl.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);