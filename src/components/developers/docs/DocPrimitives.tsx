import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, AlertTriangle, Info, Lightbulb, ExternalLink } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/agency-api`;

export function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-3">
      <pre className="bg-muted rounded-md p-3 pr-10 text-[12px] leading-relaxed overflow-x-auto font-mono whitespace-pre">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2 right-2 p-1.5 rounded hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function CodeTabs({ curl, js, python }: { curl: string; js?: string; python?: string }) {
  return (
    <Tabs defaultValue="curl" className="my-3">
      <TabsList>
        <TabsTrigger value="curl">cURL</TabsTrigger>
        {js && <TabsTrigger value="js">JavaScript</TabsTrigger>}
        {python && <TabsTrigger value="python">Python</TabsTrigger>}
      </TabsList>
      <TabsContent value="curl"><CodeBlock code={curl} /></TabsContent>
      {js && <TabsContent value="js"><CodeBlock code={js} language="javascript" /></TabsContent>}
      {python && <TabsContent value="python"><CodeBlock code={python} language="python" /></TabsContent>}
    </Tabs>
  );
}

type CalloutKind = "info" | "warn" | "tip";
const KIND_CFG: Record<CalloutKind, { Icon: any; cls: string; label: string }> = {
  info: { Icon: Info, cls: "border-blue-300 bg-blue-50/50 text-blue-900", label: "Note" },
  warn: { Icon: AlertTriangle, cls: "border-amber-300 bg-amber-50/50 text-amber-900", label: "Common mistake" },
  tip: { Icon: Lightbulb, cls: "border-emerald-300 bg-emerald-50/50 text-emerald-900", label: "Tip" },
};

export function Callout({ kind = "info", title, children }: { kind?: CalloutKind; title?: string; children: ReactNode }) {
  const { Icon, cls, label } = KIND_CFG[kind];
  return (
    <div className={`border rounded-md p-3 my-4 text-sm ${cls}`}>
      <p className="font-semibold flex items-center gap-1.5 mb-1">
        <Icon className="h-4 w-4" />
        {title ?? label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function EndpointTable({ rows }: { rows: { field: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="my-4 border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2 font-semibold">Field</th>
            <th className="text-left p-2 font-semibold">Type</th>
            <th className="text-left p-2 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-t">
              <td className="p-2 font-mono text-xs">
                {r.field} {r.required && <span className="text-destructive">*</span>}
              </td>
              <td className="p-2 text-xs"><Badge variant="outline">{r.type}</Badge></td>
              <td className="p-2 text-xs text-muted-foreground">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OpenInSandbox({ endpoint, params }: { endpoint: string; params?: Record<string, any> }) {
  const qs = new URLSearchParams({
    endpoint,
    params: params ? JSON.stringify(params) : "{}",
  }).toString();
  return (
    <Button asChild variant="outline" size="sm" className="my-2">
      <Link to={`/developers/dashboard/sandbox?${qs}`}>
        Open in sandbox console <ExternalLink className="h-3 w-3 ml-1" />
      </Link>
    </Button>
  );
}

export function NextPrev({ prev, next }: { prev?: { to: string; label: string }; next?: { to: string; label: string } }) {
  return (
    <div className="flex items-center justify-between mt-10 pt-6 border-t gap-3 flex-wrap">
      {prev ? (
        <Button asChild variant="outline" size="sm">
          <Link to={prev.to}>← {prev.label}</Link>
        </Button>
      ) : <span />}
      {next ? (
        <Button asChild size="sm">
          <Link to={next.to}>{next.label} →</Link>
        </Button>
      ) : <span />}
    </div>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="text-xl font-semibold mt-8 mb-3 scroll-mt-20">{children}</h2>;
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return <h3 id={id} className="text-base font-semibold mt-6 mb-2 scroll-mt-20">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed my-3">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="text-sm leading-relaxed my-3 list-disc pl-5 space-y-1">{children}</ul>;
}
