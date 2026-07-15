import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Carrega variáveis de ambiente (.env.local tem prioridade sobre .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-sda-v8-key";

// Configuração do Supabase (reaproveita as mesmas vars do cliente Vite).
// Normaliza a URL (mesmo motivo do client): remove barra final e um "/rest/v1"
// acidental, que quebrariam o getUser da ponte com "Invalid path specified...".
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
  ?.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client de backend com a service_role key: ignora o RLS do Supabase. É seguro
// porque as rotas Express já autenticam (cookie JWT) e autorizam (supervisorMiddleware)
// antes de tocar no banco — o servidor é a camada confiável. Fica null se a chave
// não estiver no .env.local, e as rotas de vantagens respondem 500 explicando.
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const SUPABASE_MISSING_MSG =
  "Supabase service role não configurado no servidor (defina SUPABASE_SERVICE_ROLE_KEY no .env.local)";

// Cookie seguro só em produção (HTTPS). Em dev (http://localhost) o navegador
// rejeitaria um cookie Secure/SameSite=None, quebrando a sessão.
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_OPTS = {
  httpOnly: true as const,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
};

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

// App no nível do módulo: na Vercel ele é importado e usado como handler da
// Serverless Function (export default no fim do arquivo). As rotas abaixo são
// registradas de forma síncrona no import, sem depender de startServer().
const app = express();
app.use(express.json());
app.use(cookieParser());

  // --- API Routes ---
  
  // Auth
  // NOTA: a antiga rota POST /api/auth/login (validava senha em texto puro no
  // db.json) foi REMOVIDA — era um bypass do Supabase Auth com credenciais padrão.
  // O login real é 100% Supabase (Login.tsx → signInWithPassword) + a ponte abaixo.

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

  // CRUD genérico sobre o Supabase. ID gerado pela coluna identity; escrita só SUPERVISOR.
  const createSupabaseCrud = (path: string, table: string) => {
    app.get(`/api/${path}`, authMiddleware, async (req, res) => {
      if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
      const { data, error } = await supabaseAdmin.from(table).select("*").order("id", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    });

    app.post(`/api/${path}`, authMiddleware, supervisorMiddleware, async (req, res) => {
      if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
      // Descarta id/created_at do corpo — o banco os gera.
      const payload = { ...(req.body ?? {}) };
      delete payload.id;
      delete payload.created_at;
      const { data, error } = await supabaseAdmin.from(table).insert(payload).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    });

    app.put(`/api/${path}/:id`, authMiddleware, supervisorMiddleware, async (req, res) => {
      if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
      const id = parseInt(req.params.id);
      const payload = { ...(req.body ?? {}) };
      delete payload.id;
      delete payload.created_at;
      const { data, error } = await supabaseAdmin.from(table).update(payload).eq("id", id).select().maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Not found" });
      res.json(data);
    });

    app.delete(`/api/${path}/:id`, authMiddleware, supervisorMiddleware, async (req, res) => {
      if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
      const id = parseInt(req.params.id);
      const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    });
  };

  createSupabaseCrud("categories", "categories");
  createSupabaseCrud("taxes", "taxes");
  createSupabaseCrud("rules", "rules");
  createSupabaseCrud("franchises", "franchises");
  createSupabaseCrud("interest-rates", "interest_rates");
  createSupabaseCrud("third-parties", "third_parties");
  createSupabaseCrud("settings", "settings");

  // --- Vantagens Locadora — persistidas no Supabase (tabela public.vantagens),
  // não mais no db.json. O ID é gerado pelo banco (coluna identity).
  app.get("/api/vantagens", authMiddleware, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const { data, error } = await supabaseAdmin
      .from("vantagens")
      .select("*")
      .order("id", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  });

  app.post("/api/vantagens", authMiddleware, supervisorMiddleware, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    // Só a descrição é enviada; o ID é gerado automaticamente pelo banco.
    const { data, error } = await supabaseAdmin
      .from("vantagens")
      .insert({ descricao: req.body?.descricao })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/vantagens/:id", authMiddleware, supervisorMiddleware, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const id = parseInt(req.params.id);
    const { data, error } = await supabaseAdmin
      .from("vantagens")
      .update({ descricao: req.body?.descricao })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  });

  app.delete("/api/vantagens/:id", authMiddleware, supervisorMiddleware, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const id = parseInt(req.params.id);
    const { error } = await supabaseAdmin
      .from("vantagens")
      .delete()
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Proposals — persistidas no Supabase (tabela public.proposals), não mais no
  // db.json. NÃO usa createSupabaseCrud porque o POST precisa ser liberado para o
  // VENDEDOR (a fábrica exige supervisorMiddleware na escrita).
  app.get("/api/proposals", authMiddleware, async (req: any, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    let query = supabaseAdmin.from("proposals").select("*").order("id", { ascending: false });
    // Supervisor vê todas; vendedor vê só as suas.
    if (req.user.role !== "SUPERVISOR") {
      query = query.eq("user_id", String(req.user.id));
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  });

  app.post("/api/proposals", authMiddleware, async (req: any, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    // Monta payload só com colunas conhecidas — ignora id/createdAt/campos extras do
    // corpo (o banco gera id e created_at).
    const body = req.body ?? {};
    const payload = {
      clientName: body.clientName ?? "",
      clientPhone: body.clientPhone ?? "",
      createdBy: body.createdBy ?? "",
      user_id: String(req.user.id),
    };
    const { data, error } = await supabaseAdmin.from("proposals").insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/proposals/:id", authMiddleware, supervisorMiddleware, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const id = parseInt(req.params.id);
    const { error } = await supabaseAdmin.from("proposals").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // --- Gerenciamento de usuários REAIS (Supabase Auth + tabela perfis: id uuid,
  // nome, role). Substitui o antigo createCrud("users") do db.json. Só SUPERVISOR.
  // Senhas nunca são lidas de volta (o Auth guarda com hash): o campo senha é só de
  // escrita — definido na criação ou redefinido na edição (em branco = mantém).
  const normalizeRole = (r: any) =>
    String(r ?? "VENDEDOR").toUpperCase().includes("SUPER") ? "SUPERVISOR" : "VENDEDOR";
  // A tabela perfis tem um CHECK que exige role minúsculo ('vendedor'/'supervisor').
  // Guardamos minúsculo no banco, mas expomos MAIÚSCULO na API (o que o front usa).
  const roleToDb = (r: any) => (normalizeRole(r) === "SUPERVISOR" ? "supervisor" : "vendedor");

  app.get("/api/users", authMiddleware, supervisorMiddleware, async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) return res.status(500).json({ error: listErr.message });
    const { data: perfis } = await supabaseAdmin.from("perfis").select("*");
    const byId: Record<string, any> = {};
    (perfis ?? []).forEach((p: any) => { byId[p.id] = p; });
    const users = (list?.users ?? []).map((u: any) => {
      const p = byId[u.id] ?? {};
      return { id: u.id, login: u.email ?? "", name: p.nome ?? "", role: normalizeRole(p.role) };
    });
    res.json(users);
  });

  app.post("/api/users", authMiddleware, supervisorMiddleware, async (req: any, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const { login, password, name } = req.body ?? {};
    const role = normalizeRole(req.body?.role);
    if (!login || !String(login).includes("@")) return res.status(400).json({ error: "Login (e-mail) inválido." });
    if (!password || String(password).length < 6) return res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres." });
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Nome é obrigatório." });
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: String(login).trim(), password: String(password), email_confirm: true,
    });
    if (error) return res.status(400).json({ error: error.message });
    // upsert em perfis (id = id do Auth); upsert evita conflito com trigger que já crie a linha.
    const { error: perr } = await supabaseAdmin.from("perfis").upsert(
      { id: created.user.id, nome: String(name).trim(), role: roleToDb(role), updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (perr) {
      // Rollback: desfaz o usuário do Auth para não deixar órfão (Auth sem perfil).
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return res.status(500).json({ error: perr.message });
    }
    res.json({ id: created.user.id, login, name, role });
  });

  app.put("/api/users/:id", authMiddleware, supervisorMiddleware, async (req: any, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const id = req.params.id;
    const { name, login, password } = req.body ?? {};
    const role = normalizeRole(req.body?.role);
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Nome é obrigatório." });
    const { error: perr } = await supabaseAdmin.from("perfis").upsert(
      { id, nome: String(name).trim(), role: roleToDb(role), updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (perr) return res.status(500).json({ error: perr.message });
    // Atualiza o Auth (e-mail e/ou senha) apenas quando informados.
    const authPatch: any = {};
    if (login) authPatch.email = String(login).trim();
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres." });
      authPatch.password = String(password);
    }
    if (Object.keys(authPatch).length) {
      const { error: aerr } = await supabaseAdmin.auth.admin.updateUserById(id, authPatch);
      if (aerr) return res.status(400).json({ error: aerr.message });
    }
    res.json({ id, login, name, role });
  });

  app.delete("/api/users/:id", authMiddleware, supervisorMiddleware, async (req: any, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: SUPABASE_MISSING_MSG });
    const id = req.params.id;
    if (id === String(req.user.id)) return res.status(400).json({ error: "Você não pode excluir o próprio usuário." });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return res.status(400).json({ error: error.message });
    await supabaseAdmin.from("perfis").delete().eq("id", id); // caso não haja ON DELETE CASCADE
    res.json({ success: true });
  });

  // System State API to get all parameters for quotation in one request
  app.get("/api/system-params", authMiddleware, async (req, res) => {
    // categories, taxes, rules, franchises, interestRates, thirdParties, settings e
    // vantagens vêm do Supabase (não mais do db.json). Se o client não estiver
    // configurado, degradamos para listas vazias para não quebrar a tela de cotação.
    let categories: any[] = [], taxes: any[] = [], rules: any[] = [], vantagens: any[] = [];
    let franchises: any[] = [], interestRates: any[] = [], thirdParties: any[] = [], settings: any[] = [];
    if (supabaseAdmin) {
      const [cat, tax, rul, van, fra, ir, tp, set] = await Promise.all([
        supabaseAdmin.from("categories").select("*").order("id", { ascending: true }),
        supabaseAdmin.from("taxes").select("*").order("id", { ascending: true }),
        supabaseAdmin.from("rules").select("*").order("id", { ascending: true }),
        supabaseAdmin.from("vantagens").select("*").order("id", { ascending: true }),
        supabaseAdmin.from("franchises").select("*").order("id", { ascending: true }),
        supabaseAdmin.from("interest_rates").select("*").order("id", { ascending: true }),
        supabaseAdmin.from("third_parties").select("*").order("id", { ascending: true }),
        supabaseAdmin.from("settings").select("*").order("id", { ascending: true }),
      ]);
      categories = (cat.data ?? []).filter((c: any) => c.active !== false);
      taxes = (tax.data ?? []).filter((t: any) => t.active !== false);
      rules = rul.data ?? [];
      vantagens = van.data ?? [];
      franchises = fra.data ?? [];
      interestRates = ir.data ?? [];
      thirdParties = tp.data ?? [];
      settings = set.data ?? [];
    }

    res.json({
      categories,
      taxes,
      franchises,
      interestRates,
      thirdParties,
      rules,
      settings,
      vantagens
    });
  });

// Em dev sobe o Vite em middleware; em produção "node" (npm start) serve o dist.
// Na Vercel (serverless) nada disso roda — o app é exportado como Serverless Function.
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import dinâmico via variável para o bundler da Vercel não empacotar o Vite
    // na function — este ramo só é avaliado em desenvolvimento local.
    const vitePkg = "vite";
    const { createServer: createViteServer } = await import(vitePkg);
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

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Fora da Vercel, sobe um servidor HTTP normal (dev local ou `npm start`).
if (!process.env.VERCEL) {
  startServer();
}

// Handler da Serverless Function na Vercel (@vercel/node usa o export default).
export default app;
