import { useState, useRef, useCallback } from "react";
import {
  FileText, Upload, AlertTriangle, CheckCircle, HelpCircle, Shield,
  DollarSign, Calendar, ArrowRight, X, Loader2, Mail, Copy, Check,
  AlertCircle, Sparkles, ListChecks, Eye, RotateCcw, ChevronDown, Users
} from "lucide-react";

/* ─── PROMPTS ─── */
const SYSTEM_PROMPT = `You are an expert contract analyst specializing in commercial real estate leases for salon suite businesses. You have 20+ years of experience reviewing lease agreements specifically for beauty industry professionals.

Analyze the uploaded contract and return ONLY a raw JSON object (no markdown, no backticks, no preamble) with this exact structure:

{
  "summary": "One concise sentence summarizing the contract's quality for a salon suite owner.",
  "grade": "A single letter A through F",
  "green_flags": [
    { "title": "Short title", "detail": "One sentence max.", "section": "Section ref or null" }
  ],
  "red_flags": [
    { "title": "Short title", "severity": "high or medium", "detail": "One sentence max.", "fix": "One sentence negotiation tip.", "section": "Section ref or null" }
  ],
  "attention": [
    { "title": "Short title", "detail": "One sentence max.", "ask": "One question to ask the landlord.", "section": "Section ref or null" }
  ],
  "missing": [
    { "title": "Clause name", "detail": "One sentence why it matters." }
  ],
  "money": {
    "rent": "Monthly rent or 'Not found'",
    "deposit": "Deposit amount or 'Not found'",
    "escalation": "Brief escalation terms or 'Not found'",
    "fees": ["Short fee descriptions"]
  },
  "dates": {
    "term": "Lease length",
    "notice": "Notice period",
    "renewal": "Renewal terms"
  },
  "priorities": ["Top 3 things to negotiate, each under 10 words"]
}

CRITICAL AREAS FOR SALON SUITE OWNERS:
- Tenant improvement (TI) allowances & buildout
- Early termination clauses & penalties
- All fees: CAM, maintenance, marketing, association
- Exclusive use / non-compete clauses
- Subletting & booth rental permissions
- Personal guarantee requirements
- HVAC/plumbing/electrical repair responsibility
- Signage rights & operating hours
- Assignment clause (transferring if selling business)
- Who owns buildout improvements at lease end
- Force majeure / pandemic provisions
- Default and cure periods

Keep ALL descriptions to ONE sentence. Be direct and specific. No filler.`;

const EMAIL_PROMPT = `You are writing a professional but firm email from a prospective salon suite tenant to their landlord/property manager. The tenant has had their lease reviewed and wants to address specific concerns before signing.

Write a concise, professional email that:
- Opens with a polite greeting and states they've reviewed the lease
- Lists each concern as a clear, numbered point with what they'd like clarified or changed
- Maintains a collaborative tone (not adversarial) but is direct about what needs to change
- Closes by requesting a meeting or call to discuss
- Is under 300 words total
- Do NOT use brackets or placeholders — write it ready to send (use "Hi" as greeting)

Return ONLY the email text. No subject line, no markdown, no backticks.`;

/* ─── LOADING PHASES ─── */
const PHASES = [
  { text: "Reading contract", icon: Eye },
  { text: "Scanning lease terms", icon: FileText },
  { text: "Checking fees & penalties", icon: DollarSign },
  { text: "Reviewing protections", icon: Shield },
  { text: "Building report", icon: Sparkles },
];

/* ─── GRADE CONFIG ─── */
const GRADE_CONFIG = {
  A: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", label: "Strong" },
  B: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", label: "Good" },
  C: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", label: "Fair" },
  D: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", label: "Risky" },
  F: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", label: "Dangerous" },
};

/* ─── LOGO ─── */
function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="4" y="4" width="32" height="32" rx="3" fill="#9B1B1B" />
      <path d="M24 8L12 32H16L28 8H24Z" fill="white" opacity="0.95" />
    </svg>
  );
}

/* ─── COMPONENTS ─── */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, variant = "default" }) {
  const styles = {
    default: "bg-zinc-100 text-zinc-600",
    destructive: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    success: "bg-emerald-50 text-emerald-600",
    purple: "bg-violet-50 text-violet-600",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    green: "text-emerald-600 bg-emerald-50",
    purple: "text-violet-600 bg-violet-50",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorMap[color] || "bg-zinc-100 text-zinc-500"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-900 leading-none">{value}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function Accordion({ title, icon: Icon, count, color, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const colorMap = {
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    green: "text-emerald-600 bg-emerald-50",
    purple: "text-violet-600 bg-violet-50",
  };
  const dotMap = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-emerald-500", purple: "bg-violet-500" };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50"
      >
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${colorMap[color]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-medium text-zinc-800">{title}</span>
        {count > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${dotMap[color]}`} />
            {count}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-zinc-100 px-4 pb-4 pt-1">{children}</div>}
    </Card>
  );
}

function FlagItem({ item }) {
  return (
    <div className="py-3 first:pt-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-zinc-100">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-sm font-medium text-zinc-800">{item.title}</span>
        {item.severity && (
          <Badge variant={item.severity === "high" ? "destructive" : "warning"}>
            {item.severity}
          </Badge>
        )}
        {item.section && <span className="shrink-0 text-[10px] text-zinc-400 mt-0.5">§{item.section}</span>}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.detail}</p>
      {item.fix && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-emerald-600">
          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
          {item.fix}
        </p>
      )}
      {item.ask && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
          <HelpCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {item.ask}
        </p>
      )}
    </div>
  );
}

function LoadingState({ phase }) {
  const Icon = PHASES[phase]?.icon || Eye;
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="relative mb-8">
        <div className="h-16 w-16 rounded-2xl border border-zinc-200 bg-white shadow-sm flex items-center justify-center">
          <FileText className="h-7 w-7 text-zinc-300" />
        </div>
        <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-50 bg-white shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-amber-500 animate-pulse" />
        <span className="text-sm font-medium text-zinc-600">{PHASES[phase]?.text}...</span>
      </div>
      <div className="w-48 h-1 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000 ease-out"
          style={{ width: `${((phase + 1) / PHASES.length) * 100}%` }}
        />
      </div>
      <div className="flex gap-1.5 mt-5">
        {PHASES.map((_, i) => (
          <div key={i} className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${i <= phase ? "bg-amber-500" : "bg-zinc-200"}`} />
        ))}
      </div>
    </div>
  );
}

/* ─── TOGGLE CHIP ─── */
function ToggleChip({ label, checked, onChange, color = "zinc" }) {
  const colors = {
    red: checked ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-zinc-200 text-zinc-400",
    amber: checked ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-zinc-200 text-zinc-400",
    purple: checked ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-white border-zinc-200 text-zinc-400",
    zinc: checked ? "bg-zinc-100 border-zinc-300 text-zinc-700" : "bg-white border-zinc-200 text-zinc-400",
  };
  return (
    <button
      onClick={onChange}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${colors[color]}`}
    >
      <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors ${
        checked ? "bg-current border-current" : "border-zinc-300"
      }`}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      {label}
    </button>
  );
}

/* ─── EMAIL COMPOSER ─── */
function EmailComposer({ analysis }) {
  const [includeAttention, setIncludeAttention] = useState(false);
  const [includeMissing, setIncludeMissing] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const generateEmail = async () => {
    setGenerating(true);
    setEmailText("");

    const points = [];

    analysis.red_flags?.forEach((f) => {
      points.push(`RED FLAG: ${f.title} — ${f.detail}${f.fix ? ` Requested change: ${f.fix}` : ""}`);
    });

    if (includeAttention) {
      analysis.attention?.forEach((a) => {
        points.push(`NEEDS CLARIFICATION: ${a.title} — ${a.detail}${a.ask ? ` Question: ${a.ask}` : ""}`);
      });
    }

    if (includeMissing) {
      analysis.missing?.forEach((m) => {
        points.push(`MISSING CLAUSE: ${m.title} — ${m.detail}`);
      });
    }

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: EMAIL_PROMPT,
          messages: [{
            role: "user",
            content: `Write an email to the landlord addressing these ${points.length} concerns from my lease review:\n\n${points.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
          }],
        }),
      });

      const data = await res.json();
      const text = data.content?.map((b) => b.text || "").join("") || "";
      setEmailText(text.trim());
    } catch {
      setEmailText("Failed to generate email. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const redCount = analysis.red_flags?.length || 0;
  const attCount = analysis.attention?.length || 0;
  const missCount = analysis.missing?.length || 0;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <Mail className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-medium text-zinc-800">Draft Email to Landlord</span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
          <p className="text-xs text-zinc-400 mb-3">All red flags are included. Toggle additional items to include:</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <ToggleChip label={`Red Flags (${redCount})`} checked={true} onChange={() => {}} color="red" />
            {attCount > 0 && (
              <ToggleChip
                label={`Clarifications (${attCount})`}
                checked={includeAttention}
                onChange={() => setIncludeAttention(!includeAttention)}
                color="amber"
              />
            )}
            {missCount > 0 && (
              <ToggleChip
                label={`Missing Clauses (${missCount})`}
                checked={includeMissing}
                onChange={() => setIncludeMissing(!includeMissing)}
                color="purple"
              />
            )}
          </div>

          {!emailText && (
            <button
              onClick={generateEmail}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Drafting email...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Email
                </>
              )}
            </button>
          )}

          {emailText && (
            <div className="mt-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <pre className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed font-sans">
                  {emailText}
                </pre>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] shadow-sm"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy Email"}
                </button>
                <button
                  onClick={() => { setEmailText(""); }}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─── MAIN APP ─── */
export default function ContractRedline() {
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const phaseRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setFileContent(e.target.result.split(",")[1]);
    reader.readAsDataURL(f);
  }, []);

  const analyze = useCallback(async () => {
    if (!fileContent) return;
    setLoading(true);
    setPhase(0);
    setError(null);
    setAnalysis(null);

    phaseRef.current = setInterval(() => {
      setPhase((p) => Math.min(p + 1, PHASES.length - 1));
    }, 4000);

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: file.type || "application/pdf", data: fileContent } },
              { type: "text", text: "Analyze this salon suite lease. Return ONLY raw JSON. No markdown." },
            ],
          }],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const text = data.content?.map((b) => b.text || "").join("") || "";
      setAnalysis(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch (err) {
      setError(err.message || "Analysis failed");
    } finally {
      clearInterval(phaseRef.current);
      setLoading(false);
    }
  }, [fileContent, file]);

  const reset = () => {
    setFile(null);
    setFileContent(null);
    setAnalysis(null);
    setError(null);
    setLoading(false);
    setPhase(0);
  };

  const d = analysis;
  const gc = d ? (GRADE_CONFIG[d.grade?.[0]] || GRADE_CONFIG.C) : GRADE_CONFIG.C;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">


      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900">Red-Line</h1>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">by The Salon Suite Model</p>
            </div>
          </div>
          {(file || analysis) && (
            <button onClick={reset} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
              <RotateCcw className="h-3 w-3" />
              New
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">

        {/* ── UPLOAD ── */}
        {!file && !loading && !analysis && (
          <div className="anim-in flex flex-col items-center pt-16">
            <h2 className="mb-2 text-xl font-semibold tracking-tight text-zinc-900">Upload your lease</h2>
            <p className="mb-8 text-sm text-zinc-400">Get an instant red-line analysis before you sign.</p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex w-full max-w-md cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed p-14 transition-all duration-200 ${
                dragOver
                  ? "border-amber-400 bg-amber-50/50"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => handleFile(e.target.files[0])}
                className="hidden"
              />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
                <Upload className="h-5 w-5 text-zinc-400" />
              </div>
              <span className="text-sm font-medium text-zinc-600">Click or drop file</span>
              <span className="mt-1 text-xs text-zinc-400">PDF, DOC, DOCX, TXT</span>
            </div>

            {/* Trust Badge */}
            <div className="mt-8 flex items-center gap-2 text-zinc-400">
              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-50">
                <Shield className="h-3 w-3 text-emerald-500" />
              </div>
              <span className="text-xs font-medium">Trusted by over 100+ Salon Suite Owners</span>
            </div>
          </div>
        )}

        {/* ── FILE READY ── */}
        {file && !loading && !analysis && !error && (
          <div className="anim-in flex flex-col items-center pt-20">
            <Card className="mb-6 flex w-full max-w-md items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <FileText className="h-5 w-5 text-zinc-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-800">{file.name}</p>
                <p className="text-xs text-zinc-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={reset} className="rounded-md p-1.5 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Card>

            <button
              onClick={analyze}
              className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              Analyze Contract
            </button>

            <div className="mt-6 flex items-center gap-2 text-zinc-400">
              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-50">
                <Shield className="h-3 w-3 text-emerald-500" />
              </div>
              <span className="text-xs font-medium">Trusted by over 100+ Salon Suite Owners</span>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && <LoadingState phase={phase} />}

        {/* ── ERROR ── */}
        {error && (
          <div className="anim-in flex flex-col items-center pt-24">
            <Card className="flex max-w-sm flex-col items-center p-8 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
              <p className="mb-1 text-sm font-medium text-zinc-800">Something went wrong</p>
              <p className="mb-5 text-xs text-zinc-400 leading-relaxed">{error}</p>
              <button onClick={reset} className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 transition-colors">
                Try again
              </button>
            </Card>
          </div>
        )}

        {/* ── RESULTS ── */}
        {d && (
          <div className="space-y-3">

            {/* Grade + Summary */}
            <Card className="p-5 anim-in">
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${gc.border} ${gc.bg}`}>
                  <span className={`text-2xl font-bold ${gc.text}`}>{d.grade}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-zinc-900">Contract Grade</h2>
                    <Badge variant={d.grade <= "B" ? "success" : d.grade === "C" ? "warning" : "destructive"}>
                      {gc.label}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-500">{d.summary}</p>
                </div>
              </div>
            </Card>

            {/* Priorities */}
            {d.priorities?.length > 0 && (
              <Card className="p-4 anim-in anim-d1">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Negotiate First</span>
                </div>
                <div className="space-y-2">
                  {d.priorities.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[10px] font-bold text-amber-600">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-700">{p}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 anim-in anim-d2">
              <StatCard icon={AlertTriangle} label="Red Flags" value={d.red_flags?.length || 0} color="red" />
              <StatCard icon={HelpCircle} label="Clarify" value={d.attention?.length || 0} color="amber" />
              <StatCard icon={CheckCircle} label="Green Flags" value={d.green_flags?.length || 0} color="green" />
              <StatCard icon={Shield} label="Missing" value={d.missing?.length || 0} color="purple" />
            </div>

            {/* Red Flags */}
            {d.red_flags?.length > 0 && (
              <div className="anim-in anim-d3">
                <Accordion title="Red Flags" icon={AlertTriangle} count={d.red_flags.length} color="red" defaultOpen>
                  {d.red_flags.map((f, i) => <FlagItem key={i} item={f} />)}
                </Accordion>
              </div>
            )}

            {/* Attention */}
            {d.attention?.length > 0 && (
              <div className="anim-in anim-d4">
                <Accordion title="Needs Clarification" icon={HelpCircle} count={d.attention.length} color="amber" defaultOpen>
                  {d.attention.map((f, i) => <FlagItem key={i} item={f} />)}
                </Accordion>
              </div>
            )}

            {/* Green Flags */}
            {d.green_flags?.length > 0 && (
              <div className="anim-in anim-d5">
                <Accordion title="Green Flags" icon={CheckCircle} count={d.green_flags.length} color="green">
                  {d.green_flags.map((f, i) => <FlagItem key={i} item={f} />)}
                </Accordion>
              </div>
            )}

            {/* Missing */}
            {d.missing?.length > 0 && (
              <div className="anim-in anim-d6">
                <Accordion title="Missing Clauses" icon={Shield} count={d.missing.length} color="purple">
                  {d.missing.map((m, i) => (
                    <div key={i} className="py-2.5 first:pt-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-zinc-100">
                      <p className="text-sm font-medium text-zinc-800">{m.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{m.detail}</p>
                    </div>
                  ))}
                </Accordion>
              </div>
            )}

            {/* Money & Dates */}
            <div className="grid gap-3 sm:grid-cols-2 anim-in anim-d7">
              {d.money && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Financials</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["Rent", d.money.rent],
                      ["Deposit", d.money.deposit],
                      ["Escalation", d.money.escalation],
                    ]
                      .filter(([, v]) => v && v !== "Not found")
                      .map(([l, v], i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">{l}</span>
                          <span className="text-sm font-medium text-zinc-800">{v}</span>
                        </div>
                      ))}
                    {d.money.fees?.length > 0 && d.money.fees[0] !== "None" && (
                      <div className="border-t border-zinc-100 pt-2.5">
                        <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-300">Extra Fees</p>
                        {d.money.fees.map((f, i) => (
                          <p key={i} className="text-xs text-red-500 py-0.5">• {f}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {d.dates && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Key Terms</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      ["Term", d.dates.term],
                      ["Notice", d.dates.notice],
                      ["Renewal", d.dates.renewal],
                    ]
                      .filter(([, v]) => v && v !== "Not found")
                      .map(([l, v], i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">{l}</span>
                          <span className="text-sm font-medium text-zinc-800">{v}</span>
                        </div>
                      ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Email Composer */}
            <div className="anim-in anim-d8">
              <EmailComposer analysis={d} />
            </div>

            {/* Disclaimer */}
            <p className="anim-in anim-d9 pt-4 pb-8 text-center text-[11px] text-zinc-300">
              For informational purposes only — consult a qualified attorney before signing.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
