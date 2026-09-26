export type Lang = "en" | "hi" | "kn";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "USER" | "ADMIN";
  is_active: boolean;
  preferred_language: Lang;
  profile: Record<string, any>;
  created_at: string;
  last_login_at?: string | null;
  applications?: number;
}

export interface Evidence {
  id: string;
  type: "chunk" | "graph_fact";
  text: string;
  score?: number;
  retrieval?: string[];
  vector_similarity?: number | null;
  source_title?: string;
  publisher?: string;
  source_name?: string | null;
  url?: string | null;
  section?: string | null;
  page?: number | null;
  language?: string;
  published_date?: string | null;
  retrieved_at?: string | null;
  content_hash?: string;
  is_demo?: boolean;
  document_id?: string;
  chunk_id?: string;
  scheme_code?: string;
  scheme_name?: string;
  relation?: string;
  supporting_document?: string | null;
  supporting_document_id?: string | null;
  is_official_source?: boolean;
}

export interface SchemeCard {
  code: string;
  name: string;
  display_name: string;
  short_name?: string;
  summary?: string;
  benefit?: string;
  form_id?: string | null;
  department?: string;
  portal?: { code: string; name: string; url?: string | null } | null;
  rules: { code: string; text: string; supported_by?: string }[];
  documents: { code: string; name: string; display_name: string; wallet_types: string[] }[];
  fact_id: string;
  sources?: { id: string; title: string; publisher: string; url?: string | null; is_demo: boolean }[];
  graph?: GraphView;
}

export interface GraphView {
  nodes: { id: string; label: string; name: string }[];
  edges: { from: string; to: string; type: string }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  evidence: Evidence[];
  meta?: Record<string, any>;
  created_at?: string;
  pending?: boolean;
}

export interface Application {
  id: string;
  scheme_code: string;
  scheme_name: string;
  form_id?: string | null;
  status: string;
  progress: number;
  reference_number?: string | null;
  last_completed_section?: string | null;
  next_section?: string | null;
  timeline: { status: string; at: string; note?: string }[];
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  demo?: boolean;
  existing?: boolean;
}

export interface FormField {
  id: string;
  label: string;
  labels?: Partial<Record<Lang, string>>;
  type: string;
  required?: boolean;
  options?: string[];
  option_labels?: Partial<Record<Lang, string[]>>;
  depends_on?: string;
  variants?: Record<string, { label: string; labels?: Partial<Record<Lang, string>> }>;
  help_query?: string;
}

export interface FormSection {
  id: string;
  title: string;
  titles?: Partial<Record<Lang, string>>;
  fields: FormField[];
}

export interface FormDef {
  id: string;
  title: string;
  titles?: Partial<Record<Lang, string>>;
  authority: string;
  demo: boolean;
  sections: FormSection[];
}

export interface Note {
  id: string;
  application_id?: string | null;
  kind: "USER" | "AI";
  item_type: "todo" | "question" | "text" | "summary";
  content: string;
  data: Record<string, any>;
  done: boolean;
  origin: string;
  created_at: string;
  updated_at: string;
}

export interface AINotes {
  application: string;
  status: string;
  progress: number;
  completed: string[];
  pending: string[];
  skipped: string[];
  documents: { code: string; name: string; available: boolean }[];
  questions: string[];
  last_completed?: string | null;
  next?: string | null;
  updated_at?: string;
}

export interface ApplicationDetail extends Application {
  form_data: Record<string, any>;
  field_status: Record<string, string>;
  form: FormDef | null;
  sections: { id: string; title: string; titles?: Record<string, string>; done: number; total: number; complete: boolean }[];
  scheme: SchemeCard | null;
  documents: { id: string; requirement_code?: string; user_document: { id: string; title: string; doc_type: string } }[];
  wallet: { id: string; title: string; doc_type: string }[];
  ai_notes: Note | null;
  user_notes: Note[];
  evidence: Evidence[];
  conversation: (ChatMessage & { session: string })[];
  active_session_id?: string | null;
}

export interface WalletDoc {
  id: string;
  doc_type: string;
  title: string;
  filename?: string | null;
  mime_type?: string | null;
  size: number;
  has_file: boolean;
  is_sample: boolean;
  extracted_text?: string;
  created_at: string;
}

export interface AssistResponse {
  session_id: string;
  reply: string;
  language: Lang;
  current_field: { id: string; label: string; section: string } | null;
  field_updates: Record<string, any>;
  form_data: Record<string, any>;
  field_status: Record<string, string>;
  progress: number;
  ai_notes: AINotes;
  suggested_notes: { content: string; item_type: "todo" | "question" }[];
  evidence: Evidence[];
  screen_understanding: Record<string, any>;
  action?: string | null;
  mode: string;
  pending_fill?: { field_id: string; label: string; display: string } | null;
}

export interface AIHealth {
  llm_provider: string;
  llm_model: string;
  llm_status: string;
  vision_model?: string | null;
  vision_status: string;
  embedding_provider: string;
  embedding_model: string;
  embedding_dim: number;
  embedding_status: string;
  fallback_enabled: boolean;
  fallback_active: { llm: boolean; embeddings: boolean };
  status: string;
}

export interface IngestionJob {
  id: string;
  document_id?: string | null;
  kind: string;
  title: string;
  status: string;
  stages: { stage: string; at: string; detail?: string }[];
  detail: Record<string, any>;
  error?: string | null;
  created_at: string;
  finished_at?: string | null;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  publisher: string;
  source_url?: string | null;
  filename?: string | null;
  kind: string;
  language: string;
  published_date?: string | null;
  is_demo: boolean;
  scheme_codes: string[];
  status: string;
  chunk_count: number;
  content_hash?: string | null;
  mime_type?: string | null;
  source?: { id: string; name: string; is_official: boolean } | null;
  retrieved_at?: string | null;
  created_at: string;
}

/* ---------- AI Form Assistant ---------- */
export type FormFieldType =
  | "text" | "name" | "multiline" | "date" | "phone" | "email" | "identity_number" | "bank_account" | "ifsc"
  | "pincode" | "amount" | "number" | "choice" | "checkbox" | "signature";
export type FieldStatus = "filled" | "missing" | "skipped" | "blank" | "manual";
export type FormStatus = "UPLOADED" | "ANALYZING" | "READY" | "FAILED" | "COMPLETED";
export type FormValueT = string | boolean | string[];

export interface UserForm {
  id: string;
  original_filename: string;
  mime_type: string;
  kind: "pdf" | "image";
  file_size: number;
  page_count: number;
  status: FormStatus;
  error: string | null;
  analysis: { fillable?: boolean; ocr_pages?: number[]; unreadable_pages?: number[]; field_count?: number; warnings?: string[] };
  output_ready: boolean;
  output_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormFieldDef {
  field_id: string;
  label: string;
  description: string;
  type: FormFieldType;
  page: number;
  bbox: [number, number, number, number];
  options: string[];
  required: boolean;
  confidence: number;
  source: string;
  manual: boolean;
  meta: { option_boxes?: number[][]; multiple?: boolean; table?: boolean; layout_guess?: boolean };
}

export interface FormSummary {
  detected: number;
  fillable: number;
  completed: number;
  pending: number;
  required_missing: number;
  clarification_needed: number;
  status: Record<string, FieldStatus>;
}

export interface FormAINotes { form: string; detected: number; completed: number; pending: number; clarification_needed: number; notes: string[] }

export interface FormSchema {
  form: UserForm;
  pages: { page: number; width: number; height: number; text_source: string; ocr_confidence: number | null; warnings: string[] }[];
  fields: FormFieldDef[];
  values: Record<string, FormValueT>;
  sources: Record<string, string>;
  summary: FormSummary;
  ai_notes: FormAINotes;
  profile_suggestions: Record<string, string>;
}

export interface FormAssistSection { kind: "form_observation" | "knowledge" | "assistant"; text: string; evidence?: Evidence[] }
export interface FormAssistResponse {
  reply: string;
  sections: FormAssistSection[];
  ask: { field_id: string; label: string; type: FormFieldType; options: string[] } | null;
  choices: string[] | null;
  clarification: boolean;
  field_updates: Record<string, FormValueT | null>;
  summary: FormSummary;
  evidence: Evidence[];
}

export interface FormReviewItem { field_id: string; label: string; page: number; type: FormFieldType; required: boolean; status: FieldStatus; display: string; options: string[] }
export interface FormUserNote { id: string; content: string; done: boolean; created_at: string; updated_at: string }
