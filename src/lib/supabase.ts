/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Uma pequena validação de segurança para garantir que as variáveis do .env foram lidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Atenção: Variáveis de ambiente do Supabase não encontradas no arquivo .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);