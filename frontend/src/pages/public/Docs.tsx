import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

const SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "features", title: "Features" },
  { id: "citizens", title: "For citizens" },
  { id: "answers", title: "How answers are grounded" },
  { id: "forms", title: "Form assistance" },
  { id: "privacy", title: "Privacy and safety" },
  { id: "admins", title: "For administrators" },
  { id: "running", title: "Running it" },
  { id: "api", title: "API" },
  { id: "limits", title: "Limitations" },
];

/* Tracks which section heading is on screen so the table of contents can highlight it. */
function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return active;
}

export default function Docs() {
  const active = useActiveSection();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10 max-w-3xl">
        <div className="eyebrow flex items-center gap-1.5"><BookOpen size={14} /> Documentation</div>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Sahayak documentation</h1>
        <p className="mt-3 text-lg text-ink-600">
          What Sahayak does, how it decides what to say, and how to run and manage it. Looking for simple step-by-step help instead? Read the{" "}
          <Link to="/guide" className="link">user guide</Link>.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-24 lg:self-start" aria-label="On this page">
          <div className="eyebrow mb-2">On this page</div>
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:border-l lg:border-paper-300 lg:pb-0">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={`block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold lg:-ml-px lg:rounded-none lg:border-l-2 ${
                    active === s.id ? "bg-ink-800 text-white lg:border-saffron lg:bg-transparent lg:text-ink-900" : "text-ink-600 hover:text-ink-900 lg:border-transparent"
                  }`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="prose-doc card min-w-0 p-6 sm:p-10">
          <h2 id="overview">Overview</h2>
          <p>
            Sahayak is a multilingual AI assistant for public services. A citizen describes a life event, such as “heavy rain destroyed my crop”.
            Sahayak finds the government schemes linked to that event, explains who is eligible and which documents are needed, and shows the
            official evidence behind every claim. It then sits beside the citizen on the application form: it reads the screen, answers questions by
            voice or text, proposes answers, and keeps notes.
          </p>
          <p>
            <strong>This is a hackathon prototype.</strong> The seed “official” documents are plain-language summaries marked <em>DEMO</em>. The
            government form, the submission and the status updates are mocks. Nothing is sent to any government portal.
          </p>

          <h2 id="features">Features</h2>
          <ul>
            <li><strong>Three languages, voice or text</strong> — English, Hindi and Kannada, with speech input and read-aloud answers.</li>
            <li><strong>Life-event discovery</strong> — describe what happened; the assistant maps it to schemes.</li>
            <li><strong>Cited answers</strong> — every claim links to a document chunk or a knowledge-graph fact.</li>
            <li><strong>Screen-aware form help</strong> — field-by-field guidance, with values filled only after the citizen approves them.</li>
            <li><strong>Document wallet and notes</strong> — the assistant checks the wallet for missing papers and suggests notes the citizen can keep.</li>
            <li><strong>Application tracker</strong> — status timeline, evidence and conversation for each application.</li>
            <li><strong>Admin knowledge operations</strong> — upload documents, fetch official web pages, watch ingestion, manage schemes and users.</li>
            <li><strong>Telegram bot</strong> — the same answer pipeline over chat.</li>
          </ul>

          <h2 id="citizens">For citizens</h2>
          <p>
            The citizen app has five places: <strong>Home</strong> (shortcuts and pending actions), <strong>Assistant</strong> (ask by voice or
            text), <strong>Schemes</strong> (browse and apply), <strong>Applications</strong> (track progress) and, under More,{" "}
            <strong>Documents</strong>, <strong>Notes</strong> and <strong>Profile</strong>. On phones these sit in a tab bar at the bottom of the
            screen.
          </p>
          <p>
            The <Link to="/guide">user guide</Link> walks through the whole journey in plain words, in all three languages, with a read-aloud button on
            every step.
          </p>

          <h2 id="answers">How answers are grounded</h2>
          <p>
            Sahayak uses <strong>knowledge-augmented generation</strong> (KAG) rather than plain retrieval. Every question goes through the same steps:
          </p>
          <ol>
            <li><strong>Understand</strong> — detect the language, translate for retrieval, and detect the life event and intent (eligibility, documents, how to apply…).</li>
            <li><strong>Graph retrieval</strong> — fetch the schemes linked to that life event from the Neo4j graph, with their rules, documents, department and portal. Each fact gets a citable ID.</li>
            <li><strong>Document retrieval</strong> — vector search (pgvector) and full-text search over document chunks, merged with reciprocal-rank fusion.</li>
            <li><strong>Generate</strong> — the language model answers only from that evidence and must cite it inline.</li>
            <li><strong>Validate</strong> — the backend drops any citation it did not supply and resolves source details itself. An answer with no valid citation is flagged as unverified.</li>
          </ol>
          <p>
            When there is not enough evidence, the assistant says so rather than guessing. Tapping a citation number opens the exact chunk: publisher,
            document, section and link.
          </p>

          <h2 id="forms">Form assistance</h2>
          <p>
            On an application form, <strong>Help Me Fill This Form</strong> starts a guided session. The assistant reads a structured description of the
            screen — field labels, required markers, what is filled and what has focus. When a vision model is configured it can also read a screenshot;
            otherwise an OCR fallback reads shared tabs. Screenshots are processed in memory and never stored.
          </p>
          <ul>
            <li>Answers are checked by validators for dates, mobile numbers, Aadhaar, IFSC, survey numbers, land units and more.</li>
            <li>A parsed value is only <strong>proposed</strong>. It is written to the form after the citizen says yes or taps <em>Fill field</em>.</li>
            <li>“I don't know” marks a field for later and suggests a note.</li>
            <li>The declaration box is never ticked by the assistant.</li>
          </ul>

          <h2 id="privacy">Privacy and safety</h2>
          <ul>
            <li>Aadhaar and account numbers are masked to their last four digits before messages are stored.</li>
            <li>OTP, PIN, CVV and password values are redacted, and the form assistant refuses them as answers.</li>
            <li>Screen frames are sent only with questions and are never stored.</li>
            <li>Passwords are hashed with bcrypt; protected routes need a signed token; admin routes need the admin role.</li>
            <li>API keys are never returned by the API.</li>
          </ul>

          <h2 id="admins">For administrators</h2>
          <p>Admins sign in to the <strong>Admin console</strong>:</p>
          <table>
            <thead><tr><th>Page</th><th>What it is for</th></tr></thead>
            <tbody>
              <tr><td>Overview</td><td>Knowledge-base counts, AI provider health and the ingestion pipeline.</td></tr>
              <tr><td>Knowledge Base</td><td>Upload PDF, HTML, TXT, Markdown or DOCX and try questions in the retrieval playground.</td></tr>
              <tr><td>Documents</td><td>Inspect each document's chunks and provenance.</td></tr>
              <tr><td>Sources</td><td>Fetch and index an official web page by URL.</td></tr>
              <tr><td>Schemes</td><td>See each scheme's graph neighbourhood and add schemes.</td></tr>
              <tr><td>Users</td><td>Search users, change roles and disable accounts.</td></tr>
              <tr><td>Ingestion</td><td>Follow every job through Upload → Extract → Chunk → Embed → Index.</td></tr>
            </tbody>
          </table>
          <p>A newly uploaded document is used as evidence for citizens as soon as its ingestion completes — nothing is hard-coded.</p>

          <h2 id="running">Running it</h2>
          <p>With Docker:</p>
          <p><code>cp backend/.env.example backend/.env</code> then <code>docker compose up --build</code>.</p>
          <p>
            The app runs at <code>localhost:5173</code> and the API at <code>localhost:8000</code>. AI models come from Ollama by default; OpenAI and Kimi
            can be selected with <code>LLM_PROVIDER</code>. Until models are downloaded the app runs in a clearly labelled fallback mode.
          </p>
          <p>Demo accounts: citizen <code>ramesh@demo.in</code> / <code>Demo@123</code>, admin <code>admin@demo.gov.in</code> / <code>Admin@123</code>.</p>

          <h2 id="api">API</h2>
          <p>
            The backend is a FastAPI service. Interactive API documentation is served at <code>/docs</code> on the API host (for example{" "}
            <code>localhost:8000/docs</code>). The main groups are authentication, schemes, the assistant, screen assistance, applications, the document
            wallet, notes, admin operations and health checks.
          </p>

          <h2 id="limits">Limitations</h2>
          <ul>
            <li>Seed documents are summaries, not the official text. Always confirm rules on the official portal.</li>
            <li>Submission and status updates are simulated.</li>
            <li>Voice input depends on the browser's speech recognition (best in Chrome and Edge).</li>
            <li>Out of scope for the prototype: single sign-on, fine-grained roles, job queues and production monitoring.</li>
          </ul>
        </article>
      </div>
    </div>
  );
}
