import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Carrega variáveis de ambiente (.env.local tem prioridade sobre .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-sda-v8-key";
const DB_FILE = path.join(process.cwd(), "db.json");

// Configuração do Supabase (reaproveita as mesmas vars do cliente Vite)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Cookie seguro só em produção (HTTPS). Em dev (http://localhost) o navegador
// rejeitaria um cookie Secure/SameSite=None, quebrando a sessão.
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_OPTS = {
  httpOnly: true as const,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
};

// --- Mock Database Structure ---
type Database = {
  users: any[];
  categories: any[];
  taxes: any[];
  rules: any[];
  franchises: any[];
  interestRates: any[];
  thirdParties: any[];
  settings: any[];
  proposals: any[];
};

const defaultDb: Database = {
  users: [
    { id: 1, name: "Vendedor", username: "vendedor", password: "123", role: "VENDEDOR" },
    { id: 2, name: "Supervisor", username: "supervisor", password: "123", role: "SUPERVISOR" },
  ],
  categories: [
    { id: 1, sigla: "C", padrao: 100, piso: 80, active: true },
    { id: 2, sigla: "M", padrao: 120, piso: 90, active: true },
    { id: 3, sigla: "S", padrao: 150, piso: 110, active: true },
    { id: 4, sigla: "LX", padrao: 200, piso: 150, active: true },
    { id: 5, sigla: "D", padrao: 300, piso: 250, active: true },
  ],
  taxes: [
    { id: 1, nome: "Lavagem Padrão", valor: 38, tipo: "fixo", flex_mode: false, flex_value: 0, active: true },
    { id: 2, nome: "Retorno entre Lojas", valor: 90, tipo: "fixo", flex_mode: false, flex_value: 0, active: true },
    { id: 3, nome: "Taxa Balcão", valor: 0, tipo: "flex", flex_mode: true, flex_value: 0, active: true },
  ],
  rules: [
    { id: 1, campo: "dias", de: 16, ate: 999, cobrancaDias: 0, texto: "⚠️ CUIDADO COM ALUGUEL: Contratos longos requerem checagem de cadastro estrito." },
    { id: 2, campo: "horas", de: 0, ate: 3, cobrancaDias: 0, texto: "ℹ️ Tolerância comercial: Período curto de relógio. Não cobrar hora extra." },
    { id: 3, campo: "horas", de: 4, ate: 6, cobrancaDias: 0.5, texto: "🌓 Meia Diária Ativada: Rebarba de relógio gera acréscimo de 0.5 diária no contrato." },
    { id: 4, campo: "horas", de: 7, ate: 999, cobrancaDias: 1, texto: "🚨 Outra Diária Integrada: Limite de tolerância estourado. Cobrança de 1 diária extra." }
  ],
  franchises: [
    { id: 1, combo: "REDUZIDA", tipo: "padrao", valor: 50 },
    { id: 2, combo: "REDUZIDA", tipo: "alcada", valor: 40 },
    { id: 3, combo: "ZERO", tipo: "padrao", valor: 100 },
    { id: 4, combo: "ZERO", tipo: "alcada", valor: 80 },
  ],
  interestRates: [
    { id: 1, parcelas: 1, taxa: 0 },
    { id: 2, parcelas: 2, taxa: 3 },
    { id: 3, parcelas: 3, taxa: 5 },
    { id: 4, parcelas: 4, taxa: 6 },
    { id: 5, parcelas: 5, taxa: 8 },
    { id: 6, parcelas: 6, taxa: 10 },
  ],
  thirdParties: [
    { id: 1, de: 1, ate: 999, valor: 20 }
  ],
  settings: [
    { id: 1, key: 'minuta', template: 'FEITO POR {{FEITO_POR}} - COMPOSIÇÃO DO FECHAMENTO: [{{PAGTO_BREAKDOWN}}] - KM LIVRE COM COBERTURA PARA NATAL E LITORAL/RN COM PROTEÇÃO COM RAIO DE 200KM DE NATAL/RN. ATENÇÃO PRORROGAÇÃO DE CONTRATO SOMENTE EM LOJA PARA VERIFICARMOS. DEVOLUÇÃO MESMO LOCAL DA RETIRADA - OBS EXTRA: {{OBS_EXTRA}}', apeloComercial: '🚨 RISCO CIVIL PATRIMONIAL ATIVADO: Contrato sem amparo de frota! O locatário assume responsabilidade integral com o próprio patrimônio por danos causados a terceiros.' }
  ],
  proposals: [],
};

// Initialize DB file
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
}

function readDb(): Database {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    return defaultDb;
  }
}

function writeDb(data: Database) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Middleware to verify JWT
function authMiddleware(req: any, res: any, next: any) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Middleware to verify Supervisor role
function supervisorMiddleware(req: any, res: any, next: any) {
  if (req.user?.role !== "SUPERVISOR") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(cookieParser());

  // --- API Routes ---
  
  // Auth
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const db = readDb();
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
      res.cookie("token", token, COOKIE_OPTS);
      res.json({ user: { id: user.id, username: user.username, role: user.role, name: user.name } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Ponte de sessão: recebe o access_token do Supabase (login novo), valida-o
  // no Supabase e emite o cookie JWT legado para que a API de dados (que ainda
  // usa cookie) continue funcionando sem alterar as telas de tarifário.
  app.post("/api/auth/bridge", async (req, res) => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "Supabase não configurado no servidor (.env.local)" });
    }

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.body?.access_token;
    if (!accessToken) return res.status(401).json({ error: "Access token ausente" });

    // Client com o token do usuário: getUser valida o token e o RLS garante que
    // o usuário só consegue ler o próprio perfil (não confiamos no cliente).
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Token do Supabase inválido" });
    }
    const sUser = userData.user;

    // Papel real vindo do banco (tabela perfis), normalizado para o formato legado.
    const { data: perfil } = await sb.from("perfis").select("*").eq("id", sUser.id).single();
    const rawRole = String(perfil?.role ?? perfil?.papel ?? "VENDEDOR").toUpperCase();
    const role = rawRole.includes("SUPER") ? "SUPERVISOR" : "VENDEDOR";
    const name = perfil?.name ?? perfil?.nome ?? sUser.email ?? "Usuário";

    const appUser = { id: sUser.id, username: sUser.email, email: sUser.email, role, name };
    const token = jwt.sign(appUser, JWT_SECRET, { expiresIn: "1d" });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ user: appUser });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token", COOKIE_OPTS);
    res.json({ success: true });
  });

  app.get("/api/auth/me", authMiddleware, (req: any, res) => {
    res.json({ user: req.user });
  });

  // DB Endpoints (simplified CRUD)
  const createCrud = (path: string, collection: keyof Database, requireSupervisorWrite = false) => {
    app.get(`/api/${path}`, authMiddleware, (req, res) => {
      const db = readDb();
      res.json(db[collection]);
    });

    app.post(`/api/${path}`, authMiddleware, requireSupervisorWrite ? supervisorMiddleware : (req,res,next)=>next(), (req, res) => {
      const db = readDb();
      const newItem = { id: Date.now(), ...req.body };
      db[collection].push(newItem);
      writeDb(db);
      res.json(newItem);
    });

    app.put(`/api/${path}/:id`, authMiddleware, requireSupervisorWrite ? supervisorMiddleware : (req,res,next)=>next(), (req, res) => {
      const db = readDb();
      const id = parseInt(req.params.id);
      const index = db[collection].findIndex((i: any) => i.id === id);
      if (index > -1) {
        db[collection][index] = { ...db[collection][index], ...req.body, id };
        writeDb(db);
        res.json(db[collection][index]);
      } else {
        res.status(404).json({ error: "Not found" });
      }
    });

    app.delete(`/api/${path}/:id`, authMiddleware, requireSupervisorWrite ? supervisorMiddleware : (req,res,next)=>next(), (req, res) => {
      const db = readDb();
      const id = parseInt(req.params.id);
      db[collection] = db[collection].filter((i: any) => i.id !== id) as any;
      writeDb(db);
      res.json({ success: true });
    });
  };

  createCrud("categories", "categories", true);
  createCrud("taxes", "taxes", true);
  createCrud("rules", "rules", true);
  createCrud("franchises", "franchises", true);
  createCrud("interest-rates", "interestRates", true);
  createCrud("third-parties", "thirdParties", true);
  createCrud("users", "users", true);
  createCrud("settings", "settings", true);
  
  // Proposals
  app.get("/api/proposals", authMiddleware, (req: any, res) => {
    const db = readDb();
    if (req.user.role === "SUPERVISOR") {
      res.json(db.proposals);
    } else {
      res.json(db.proposals.filter(p => p.user_id === req.user.id));
    }
  });

  app.post("/api/proposals", authMiddleware, (req: any, res) => {
    const db = readDb();
    const newItem = { id: Date.now(), user_id: req.user.id, created_at: new Date().toISOString(), ...req.body };
    db.proposals.push(newItem);
    writeDb(db);
    res.json(newItem);
  });

  // System State API to get all parameters for quotation in one request
  app.get("/api/system-params", authMiddleware, (req, res) => {
    const db = readDb();
    res.json({
      categories: db.categories.filter(c => c.active !== false),
      taxes: db.taxes.filter(t => t.active !== false),
      franchises: db.franchises,
      interestRates: db.interestRates,
      thirdParties: db.thirdParties,
      rules: db.rules,
      settings: db.settings
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
