/*
 * UI-preview mock of the backend. Used ONLY by vite.config.mock.ts (npm script: dev:mock).
 * Nothing in src/ imports this, and the real vite.config.ts / backend are untouched.
 * Any password is accepted. Use ramesh@demo.in (citizen) or admin@demo.gov.in (admin).
 */
import type { Plugin } from "vite";

const now = new Date().toISOString();
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const citizen = { id: "u1", email: "ramesh@demo.in", full_name: "Ramesh Kumar", role: "USER", is_active: true, preferred_language: "en", profile: { village: "Hosahalli", district: "Mysuru" }, created_at: ago(60), last_login_at: now, applications: 3 };
const admin = { id: "u2", email: "admin@demo.gov.in", full_name: "Admin Officer", role: "ADMIN", is_active: true, preferred_language: "en", profile: {}, created_at: ago(90), last_login_at: now, applications: 0 };
const userFor = (auth?: string) => (auth?.includes("mock-admin") ? admin : citizen);

const rules = [
  { code: "R1", text: "Farmer holding cultivable land in the state", supported_by: "d1" },
  { code: "R2", text: "Crop loss of 33% or more certified by field survey", supported_by: "d1" },
];
const docsReq = [
  { code: "LAND", name: "Land record (RTC)", display_name: "Land record (RTC)", wallet_types: ["land_record"] },
  { code: "BANK", name: "Bank passbook", display_name: "Bank passbook", wallet_types: ["bank"] },
];
const mkScheme = (code: string, name: string, summary: string, benefit: string, form: boolean, dept: string) => ({
  code, name, display_name: name, short_name: name, summary, benefit, form_id: form ? "form-" + code : null, department: dept,
  portal: { code: "P1", name: dept + " portal", url: "https://example.gov.in" }, rules, documents: docsReq, fact_id: "f-" + code,
  sources: [{ id: "d1", title: "Scheme guidelines summary", publisher: dept, url: "https://example.gov.in/guidelines", is_demo: true }],
  graph: { nodes: [{ id: code, label: "Scheme", name }, { id: "e1", label: "LifeEvent", name: "Crop damage" }], edges: [{ from: "e1", to: code, type: "ELIGIBLE_FOR" }] },
});
const schemes = [
  mkScheme("CROP", "Crop Loss Input Subsidy", "Money per hectare of damaged crop after heavy rain, flood or drought.", "Up to ₹8,500 per hectare", true, "Agriculture Department"),
  mkScheme("PMKISAN", "Farmer Income Support", "Yearly income support paid directly to farmer families.", "₹6,000 per year in three instalments", true, "Agriculture Department"),
  mkScheme("HOUSING", "Rural Housing Assistance", "Financial help to build a permanent house for families without one.", "₹1.2 lakh assistance", false, "Rural Development"),
  mkScheme("PENSION", "Old Age Pension", "Monthly pension for citizens above 60 years with low income.", "₹1,200 per month", true, "Social Welfare"),
];

const formDef = {
  id: "form-CROP", title: "Crop Loss Relief Application", titles: { hi: "फसल नुकसान राहत आवेदन", kn: "ಬೆಳೆ ನಷ್ಟ ಪರಿಹಾರ ಅರ್ಜಿ" }, authority: "Department of Agriculture", demo: true,
  sections: [
    { id: "s1", title: "Applicant details", fields: [
      { id: "name", label: "Full name", type: "text", required: true },
      { id: "phone", label: "Mobile number", type: "phone", required: true },
      { id: "village", label: "Village", type: "text", required: true },
    ] },
    { id: "s2", title: "Land and crop", fields: [
      { id: "survey", label: "Survey number", type: "text", required: true },
      { id: "crop", label: "Crop affected", type: "select", options: ["Paddy", "Ragi", "Maize", "Sugarcane"], required: true },
      { id: "area", label: "Area damaged (hectares)", type: "number", required: true },
      { id: "desc", label: "Describe the damage", type: "textarea" },
    ] },
    { id: "s3", title: "Bank details", fields: [
      { id: "acct", label: "Bank account number", type: "text", required: true },
      { id: "ifsc", label: "IFSC code", type: "text", required: true },
    ] },
  ],
};
const fieldStatus = { name: "COMPLETE", phone: "COMPLETE", village: "COMPLETE", survey: "COMPLETE", crop: "PENDING", area: "PENDING", desc: "PENDING", acct: "SKIPPED", ifsc: "PENDING" };
const formData = { name: "Ramesh Kumar", phone: "9876543210", village: "Hosahalli", survey: "42/3" };

const apps: any[] = [
  { id: "a1", scheme_code: "CROP", scheme_name: "Crop Loss Input Subsidy", form_id: "form-CROP", status: "IN_PROGRESS", progress: 44, reference_number: null, last_completed_section: "Applicant details", next_section: "Land and crop", timeline: [{ status: "DRAFT", at: ago(3), note: "Application started" }, { status: "IN_PROGRESS", at: ago(2), note: "Applicant details completed" }], submitted_at: null, created_at: ago(3), updated_at: ago(1), demo: true },
  { id: "a2", scheme_code: "PENSION", scheme_name: "Old Age Pension", form_id: "form-PENSION", status: "DOCUMENTS_REQUIRED", progress: 70, reference_number: null, last_completed_section: "Personal", next_section: "Documents", timeline: [{ status: "DRAFT", at: ago(8) }], submitted_at: null, created_at: ago(8), updated_at: ago(5), demo: true },
  { id: "a3", scheme_code: "PMKISAN", scheme_name: "Farmer Income Support", form_id: "form-PMKISAN", status: "SUBMITTED", progress: 100, reference_number: "SHK-2026-004512", last_completed_section: null, next_section: null, timeline: [{ status: "DRAFT", at: ago(20) }, { status: "SUBMITTED", at: ago(18), note: "Submitted (demo)" }], submitted_at: ago(18), created_at: ago(20), updated_at: ago(18), demo: true },
];
const walletDocs = [
  { id: "w1", doc_type: "aadhaar", title: "Aadhaar card", filename: "aadhaar.pdf", mime_type: "application/pdf", size: 220000, has_file: true, is_sample: true, created_at: ago(30) },
  { id: "w2", doc_type: "land_record", title: "Land record (RTC)", filename: "rtc.pdf", mime_type: "application/pdf", size: 410000, has_file: true, is_sample: false, created_at: ago(12) },
  { id: "w3", doc_type: "bank", title: "Bank passbook", filename: "passbook.jpg", mime_type: "image/jpeg", size: 380000, has_file: true, is_sample: true, created_at: ago(9) },
];
const notes: any[] = [
  { id: "n1", application_id: null, kind: "USER", item_type: "todo", content: "Collect land record from Taluk office", data: {}, done: false, origin: "user", created_at: ago(2), updated_at: ago(2) },
  { id: "n2", application_id: null, kind: "USER", item_type: "todo", content: "Photocopy bank passbook", data: {}, done: true, origin: "user", created_at: ago(4), updated_at: ago(3) },
  { id: "n3", application_id: "a1", kind: "USER", item_type: "question", content: "Is a field survey needed for crop loss?", data: {}, done: false, origin: "ai_suggested", created_at: ago(1), updated_at: ago(1) },
];
const evidence = [
  { id: "e1", type: "chunk", text: "Farmers who have lost 33% or more of their crop due to natural calamity are eligible for input subsidy.", score: 0.91, retrieval: ["vector", "graph"], source_title: "Crop Loss Subsidy Guidelines (summary)", publisher: "Agriculture Department", url: "https://example.gov.in/guidelines", section: "Eligibility", page: 2, is_demo: true, document_id: "d1", chunk_id: "c-12" },
];
const aiNotes = { application: "Crop Loss Input Subsidy", status: "IN_PROGRESS", progress: 44, completed: ["Applicant details"], pending: ["Land and crop", "Bank details"], skipped: ["Bank account number"], documents: [{ code: "LAND", name: "Land record (RTC)", available: true }, { code: "BANK", name: "Bank passbook", available: true }], questions: [], last_completed: "Applicant details", next: "Land and crop" };

const kdocs = [
  { id: "d1", title: "Crop Loss Subsidy Guidelines (summary)", publisher: "Agriculture Department", source_url: "https://example.gov.in/guidelines", filename: "crop.pdf", kind: "pdf", language: "en", published_date: "2025-06-01", is_demo: true, scheme_codes: ["CROP"], status: "COMPLETE", chunk_count: 24, content_hash: "ab12", mime_type: "application/pdf", source: { id: "s1", name: "Agriculture Portal", is_official: true }, retrieved_at: ago(10), created_at: ago(10) },
  { id: "d2", title: "Old Age Pension Rules", publisher: "Social Welfare", source_url: null, filename: "pension.pdf", kind: "pdf", language: "en", published_date: "2024-11-15", is_demo: false, scheme_codes: ["PENSION"], status: "INDEXING", chunk_count: 12, content_hash: "cd34", mime_type: "application/pdf", source: null, retrieved_at: ago(4), created_at: ago(4) },
];
const job = { id: "j1", document_id: "d1", kind: "upload", title: "Crop Loss Subsidy Guidelines", status: "COMPLETE", stages: [{ stage: "UPLOADED", at: ago(10) }, { stage: "EXTRACTING", at: ago(10) }, { stage: "CHUNKING", at: ago(10) }, { stage: "EMBEDDING", at: ago(10) }, { stage: "INDEXING", at: ago(10) }, { stage: "COMPLETE", at: ago(10) }], detail: {}, error: null, created_at: ago(10), finished_at: ago(10) };

function route(method: string, path: string, query: URLSearchParams, body: any, auth?: string): any {
  const p = path.replace(/^\/api/, "");
  // auth
  if (p === "/auth/signin") { const isAdmin = /admin/i.test(body?.email || ""); return { access_token: isAdmin ? "mock-admin" : "mock-citizen", user: isAdmin ? admin : citizen }; }
  if (p === "/auth/signup") return { access_token: "mock-citizen", user: { ...citizen, email: body?.email, full_name: body?.full_name } };
  if (p === "/auth/me") return userFor(auth);
  if (p === "/auth/logout") return { ok: true };
  if (p === "/auth/forgot-password") return { message: "If the account exists, a reset link was sent.", demo_reset_token: "mock-token" };
  if (p === "/users/me") return { ...userFor(auth), ...body };
  // schemes
  if (p === "/schemes") return schemes;
  let m = p.match(/^\/schemes\/(.+)$/);
  if (m) return schemes.find((s) => s.code === m![1]) ?? schemes[0];
  // applications
  if (p === "/applications") return method === "POST" ? { ...apps[0], id: "a-new", existing: false } : apps;
  m = p.match(/^\/applications\/([^/]+)$/);
  if (m) {
    const a = apps.find((x) => x.id === m![1]) ?? apps[0];
    return { ...a, form_data: formData, field_status: fieldStatus, form: formDef, scheme: schemes[0], evidence,
      sections: formDef.sections.map((s, i) => ({ id: s.id, title: s.title, done: i === 0 ? 3 : i === 1 ? 1 : 0, total: s.fields.length, complete: i === 0 })),
      documents: [{ id: "ad1", requirement_code: "LAND", user_document: { id: "w2", title: "Land record (RTC)", doc_type: "land_record" } }],
      wallet: walletDocs.map(({ id, title, doc_type }) => ({ id, title, doc_type })), ai_notes: { id: "an1", application_id: a.id, kind: "AI", item_type: "summary", content: "", data: aiNotes, done: false, origin: "ai", created_at: now, updated_at: now },
      user_notes: notes.filter((n) => n.application_id === a.id), conversation: [
        { id: "m1", session: "s1", role: "user", content: "I lost my paddy crop in the heavy rain.", evidence: [] },
        { id: "m2", session: "s1", role: "assistant", content: "I'm sorry to hear that. You may be eligible for the **Crop Loss Input Subsidy** [1].", evidence },
      ], active_session_id: null };
  }
  if (/^\/applications\/[^/]+\/form$/.test(p)) return { form_data: formData, field_status: fieldStatus, progress: 44 };
  if (/^\/applications\/[^/]+\/submit$/.test(p)) return { ...apps[0], status: "SUBMITTED", progress: 100, reference_number: "SHK-2026-009001" };
  if (/^\/applications\/[^/]+\/(documents|simulate-status)$/.test(p)) return { ok: true };
  // documents & notes
  if (p === "/documents") return walletDocs;
  if (p === "/notes") return method === "POST" ? { ...notes[0], id: "n-" + Date.now(), content: body?.content ?? "" } : notes;
  if (p.startsWith("/notes/")) return notes[0];
  // assistant
  if (p === "/assistant/chat") return { conversation_id: "c1", message: { id: "m-" + Date.now(), role: "assistant", content: "Based on what you told me, you may be eligible for the **Crop Loss Input Subsidy**. It pays money per hectare of damaged crop [1]. You will need your land record and bank passbook.", evidence, meta: { schemes: [schemes[0]], kag: null } } };
  if (p === "/kag/query") return { answer: "Mock answer", evidence, trace: [] };
  // user forms (AI form assistant)
  if (p === "/forms") return [];
  // ---- admin
  if (p === "/admin/overview") return { documents: 24, sources: 6, chunks: 812, users: 128, applications: 341, graph: { backend: "Neo4j", schemes: 4, rules: 9, documents: 8 }, last_indexed: ago(1), recent_ingestion: [job], ai: { llm_provider: "ollama", llm_model: "llama3", llm_status: "connected", vision_model: "llava", vision_status: "connected", embedding_provider: "local", embedding_model: "bge-small", embedding_dim: 384, embedding_status: "connected", fallback_enabled: true, fallback_active: { llm: false, embeddings: false }, status: "ok" }, embeddings_by_model: [{ model: "bge-small", chunks: 812 }], vector_backend: "pgvector" };
  if (p === "/admin/documents") return kdocs;
  m = p.match(/^\/admin\/documents\/([^/]+)$/);
  if (m) return { ...kdocs[0], chunks: [{ chunk_id: "c-1", section: "Eligibility", page: 1, text: "Farmers who have lost 33% or more of their crop ..." }, { chunk_id: "c-2", section: "Benefit", page: 2, text: "Input subsidy is paid per hectare ..." }], jobs: [job] };
  if (p === "/admin/sources") return [{ id: "s1", name: "Agriculture Portal", publisher: "Agriculture Department", base_url: "https://example.gov.in", category: "scheme", is_official: true, is_demo: true, documents: 8, created_at: ago(30) }, { id: "s2", name: "Community blog", publisher: "Unknown", base_url: null, category: "news", is_official: false, is_demo: false, documents: 1, created_at: ago(12) }];
  if (p === "/admin/users") return [citizen, admin, { ...citizen, id: "u3", email: "lakshmi@demo.in", full_name: "Lakshmi Devi", applications: 1 }];
  if (p === "/admin/schemes") return { schemes: schemes.map((s) => ({ ...s, rules: rules.length, documents: docsReq.length })), stats: { schemes: 4, rules: 9, documents: 8, life_events: 5 } };
  if (p === "/admin/graph") return schemes[0].graph;
  if (p === "/admin/ingestion") return [job, { ...job, id: "j2", title: "Old Age Pension Rules", status: "INDEXING" }];
  if (p.startsWith("/admin/ingestion/")) return job;
  return method === "GET" ? [] : { ok: true };
}

export default function mockApi(): Plugin {
  return {
    name: "sahayak-mock-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();
        const url = new URL(req.url, "http://localhost");
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          let body: any = {};
          try { body = raw ? JSON.parse(raw) : {}; } catch { /* multipart etc. */ }
          const out = route(req.method || "GET", url.pathname, url.searchParams, body, req.headers.authorization);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(out));
        });
      });
    },
  };
}
