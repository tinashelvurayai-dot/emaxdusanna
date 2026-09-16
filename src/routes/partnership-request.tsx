import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPartnershipProgramRequest } from "@/lib/admin.functions";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/partnership-request")({
  head: () => pageHead({ title: "Partnership & Program Request | Edusanna", description: "Propose an organizational programme with Edusanna.", path: "/partnership-request" }),
  component: PartnershipRequestPage,
});

const fields = [
  ["partnerName", "Your name", "text"], ["email", "Email address", "email"], ["phone", "Phone number", "tel"],
  ["organizationName", "Organization name", "text"], ["organizationType", "Organization type", "text"], ["website", "Website (optional)", "url"],
  ["programTitle", "Proposed programme title", "text"], ["audience", "Who will it serve?", "text"], ["expectedReach", "Expected reach (optional)", "text"],
] as const;

function PartnershipRequestPage() {
  const submit = useServerFn(submitPartnershipProgramRequest);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true);
    try {
      await submit({ data: form });
      toast.success("Edusanna Team will respond to your submitted request via email within 7 days");
      setForm({});
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to submit request"); }
    finally { setSubmitting(false); }
  };
  return <div className="min-h-screen"><SiteNavbar /><main className="pt-32 pb-20 px-4"><div className="max-w-5xl mx-auto"><Link to="/" hash="partnership-request" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><span aria-hidden="true">←</span> Back to Partnership &amp; Program Request</Link><div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
    <section><p className="text-sm font-bold uppercase tracking-[0.2em] text-purple-600">Work with Edusanna</p><h1 className="mt-3 text-4xl md:text-5xl font-black text-white text-balance">Partnership &amp; Program Request</h1><p className="mt-5 text-lg leading-relaxed text-blue-700">Bring a meaningful learning experience to your community with Edusanna.</p><div className="mt-8 rounded-2xl border border-purple-200 bg-purple-50 p-6"><p className="font-bold text-purple-950">Interested Partners gain a worthy share of their proposed Organizational Program(s)</p></div></section>
    <form onSubmit={handleSubmit} className="glass-card-light p-6 md:p-8 grid sm:grid-cols-2 gap-5">{fields.map(([key, label, type]) => <div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} type={type} value={form[key] ?? ""} onChange={(e) => update(key, e.target.value)} required={!label.includes("optional")} /></div>)}<div className="sm:col-span-2"><Label htmlFor="programDescription">Programme description</Label><Textarea id="programDescription" value={form.programDescription ?? ""} onChange={(e) => update("programDescription", e.target.value)} required rows={5} /></div><div className="sm:col-span-2"><Label htmlFor="message">Additional message (optional)</Label><Textarea id="message" value={form.message ?? ""} onChange={(e) => update("message", e.target.value)} rows={4} /></div><Button className="premium-button sm:col-span-2" disabled={submitting}>{submitting ? "Submitting..." : "Submit request"}</Button></form>
  </div></div></main><SiteFooter /></div>;
}
