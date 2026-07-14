export interface User {
  id: number;
  username: string;
  name: string;
  role: "VENDEDOR" | "SUPERVISOR";
}

export interface Category {
  id: number;
  sigla: string;
  padrao: number;
  piso: number;
  active: boolean;
}

export interface Tax {
  id: number;
  nome: string;
  valor: number;
  tipo: "fixo" | "diario" | "flex";
  flex_mode: boolean;
  flex_value: number;
  active: boolean;
}

export interface Rule {
  id: number;
  tipo: "dias" | "horas";
  de: number;
  ate: number;
  texto: string;
}

export interface Franchise {
  id: number;
  combo: "REDUZIDA" | "ZERO";
  tipo: "padrao" | "alcada";
  valor: number;
}

export interface InterestRate {
  id: number;
  parcelas: number;
  taxa: number;
}

export interface ThirdParty {
  id: number;
  de: number;
  ate: number;
  valor: number;
}
