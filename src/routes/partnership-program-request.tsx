import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Handshake, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/site";
import { SmartBack } from "@/components/smart-back";

export const Route = createFileRoute("/partnership-program-request")({
  head: () => pageHead({ title: "Partnership & Program Request | Edusanna", description: "Propose an organizational learning program with Edusanna.", path: "/partnership-program-request" }),
  component: PartnershipProgramRequestPage,
});

const initial = { partnerName: "", email: "", phone: "", organizationName: "", organizationType: "", website: "", programTitle: "", programDescription: "", audience: "", expectedReach: "", message: "" };

function PartnershipProgramRequestPage() {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof typeof initial) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("partnership_program_requests").insert({ partner_name: form.partnerName.trim(), email: form.email.trim(), phone: form.phone.trim() || null, organization_name: form.organizationName.trim(), organization_type: form.organizationType.trim(), website: form.website.trim() || null, program_title: form.programTitle.trim(), program_description: form.programDescription.trim(), audience: form.audience.trim(), expected_reach: form.expectedReach.trim() || null, message: form.message.trim() || null });
    setSubmitting(false);
    if (error) { toast.error("We could not submit your request. Please check your details and try again."); return; }
    setForm(initial);
    toast.success("Edusanna Team will respond to your submitted request via email within 7 days");
  };
  return <div className="min-h-screen"><SiteNavbar /><main className="pt-32 pb-20 px-4 sm:px-6"><div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-[0.8fr_1.2fr] items-start"><section className="pt-4"><SmartBack fallback="/" label="Back to Why Choose Edusanna" /><div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700"><Handshake className="w-4 h-4" aria-hidden="true" /> Partner with Edusanna</div><h1 className="mt-5 text-4xl md:text-5xl font-black text-blue-300 text-balance">Partnership &amp; Program Request</h1><p className="mt-4 text-blue-700 leading-relaxed">Bring a meaningful learning experience to your organization, community, or audience. Share your idea and our team will help shape the next step.</p><div className="mt-8 rounded-2xl border border-teal-200 bg-teal-50 p-5"><CheckCircle2 className="w-5 h-5 text-teal-700" aria-hidden="true" /><p className="mt-3 font-bold leading-relaxed text-teal-950">Interested Partners gain a worthy share of their proposed Organizational Program(s)</p></div><Link to="/courses" className="inline-block mt-6 text-sm font-semibold text-blue-700 hover:underline">Explore Edusanna courses first →</Link></section><form onSubmit={submit} className="glass-card-light p-5 sm:p-8 grid gap-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Partner name" id="partnerName" value={form.partnerName} onChange={set("partnerName")} required /><Field label="Email address" id="email" type="email" value={form.email} onChange={set("email")} required /><Field label="Phone number" id="phone" value={form.phone} onChange={set("phone")} /><Field label="Organization name" id="organizationName" value={form.organizationName} onChange={set("organizationName")} required /><Field label="Organization type" id="organizationType" placeholder="NGO, school, company, community..." value={form.organizationType} onChange={set("organizationType")} required /><Field label="Website (optional)" id="website" type="url" value={form.website} onChange={set("website")} /></div><Field label="Proposed program title" id="programTitle" value={form.programTitle} onChange={set("programTitle")} required /><TextField label="Program description" id="programDescription" value={form.programDescription} onChange={set("programDescription")} required placeholder="What would you like to build or deliver?" /><div className="grid gap-5 sm:grid-cols-2"><Field label="Intended audience" id="audience" value={form.audience} onChange={set("audience")} required /><Field label="Expected reach" id="expectedReach" placeholder="Estimated learners or participants" value={form.expectedReach} onChange={set("expectedReach")} /></div><TextField label="Additional message (optional)" id="message" value={form.message} onChange={set("message")} /><Button disabled={submitting} className="premium-button w-full sm:w-fit"><Send data-icon="inline-start" />{submitting ? "Submitting..." : "Submit request"}</Button></form></div></main><SiteFooter /></div>;
}
function Field({ label, id, ...props }: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><Input id={id} {...props} /></div>; }
function TextField({ label, id, ...props }: { label: string; id: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><Textarea id={id} rows={4} {...props} /></div>; }
