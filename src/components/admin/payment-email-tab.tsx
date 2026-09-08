import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Save, Send, Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getPaymentEmailTemplate,
  savePaymentEmailTemplate,
  DEFAULT_PAYMENT_EMAIL,
} from "@/lib/payment-email.functions";
import { listAltPaymentRequests } from "@/lib/alt-payment.functions";
import { isSpecialCourse } from "@/lib/special-courses";

type Req = {
  id: string;
  student_name: string | null;
  email: string | null;
  course_id: string;
  course_name: string;
  level: string;
  country?: string | null;
  status: string;
  amount?: number | null;
  methods?: string[] | null;
  created_at: string;
};

/** Editable payment-detail email frame + one-click Gmail send for finishers. */
export function PaymentEmailTab() {
  const fetchTemplate = useServerFn(getPaymentEmailTemplate);
  const saveTemplate = useServerFn(savePaymentEmailTemplate);
  const fetchRequests = useServerFn(listAltPaymentRequests);

  const [language, setLanguage] = useState<"en" | "fr">("en");
  const [templates, setTemplates] = useState(DEFAULT_PAYMENT_EMAIL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<Req[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchTemplate({}), fetchRequests({})])
      .then(([t, r]) => {
        if (!active) return;
        setTemplates(t);
        setRequests((r.requests ?? []) as Req[]);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load template"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fetchTemplate, fetchRequests]);

  const finishers = useMemo(
    () => requests.filter((r) => isSpecialCourse(r.course_id)),
    [requests],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTemplate({ data: templates });
      toast.success("Email frame saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = (request: Req) => {
    if (!request.email) return;
    setSendingId(request.id);
    const vars: Record<string, string> = {
      name: request.student_name ?? "learner",
      course: request.course_name,
      level: request.level === "diploma" ? "Diploma" : "Certificate",
      amount: `$${Number(request.amount ?? 0).toFixed(2)} USD`,
      country: request.country ?? "-",
      methods: (request.methods ?? []).join(", "),
    };
    const fill = (value: string) => value.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
    const template = templates[language];
    const subject = fill(template.subject);
    const body = fill(template.body);
    const mailtoUrl = `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    toast.success(`Opening your email app for ${request.email}`);
    setSendingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-blue-700">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading email frame…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card-light rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-700" />
          <h3 className="text-lg font-bold text-blue-900">Payment detail email frame</h3>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Languages className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span className="text-sm font-semibold text-blue-900">Template language</span>
          <Button type="button" variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>English</Button>
          <Button type="button" variant={language === "fr" ? "default" : "outline"} size="sm" onClick={() => setLanguage("fr")}>Français</Button>
        </div>
        <p className="mb-4 text-sm text-blue-700">
          Gmail will open with the recipient, subject, and payment email pre-filled. Placeholders you can use:{" "}
          <code className="rounded bg-blue-50 px-1">{"{{name}}"}</code>{" "}
          <code className="rounded bg-blue-50 px-1">{"{{course}}"}</code>{" "}
          <code className="rounded bg-blue-50 px-1">{"{{level}}"}</code>{" "}
          <code className="rounded bg-blue-50 px-1">{"{{amount}}"}</code>{" "}
          <code className="rounded bg-blue-50 px-1">{"{{country}}"}</code>{" "}
          <code className="rounded bg-blue-50 px-1">{"{{methods}}"}</code>
        </p>
        <Label htmlFor="pe-subject" className="text-xs text-blue-900">Subject</Label>
        <Input
          id="pe-subject"
          value={templates[language].subject}
          onChange={(e) => setTemplates((current) => ({ ...current, [language]: { ...current[language], subject: e.target.value } }))}
          className="mb-4 mt-1 bg-white"
        />
        <Label htmlFor="pe-body" className="text-xs text-blue-900">Email body</Label>
        <Textarea
          id="pe-body"
          value={templates[language].body}
          onChange={(e) => setTemplates((current) => ({ ...current, [language]: { ...current[language], body: e.target.value } }))}
          rows={16}
          className="mt-1 bg-white font-mono text-sm"
        />
        <Button onClick={handleSave} disabled={saving} className="premium-button mt-4">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save frame
        </Button>
      </div>

      <div className="glass-card-light rounded-2xl p-6">
        <h3 className="mb-1 text-lg font-bold text-blue-900">Special programme finishers</h3>
        <p className="mb-4 text-sm text-blue-700">
          {finishers.length} learner(s) submitted details for the AHEP programme.
        </p>
        {finishers.length === 0 && (
          <p className="py-6 text-center text-sm text-blue-500">No submissions yet.</p>
        )}
        <ul className="space-y-2">
          {finishers.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-blue-900">
                  {r.student_name ?? "Learner"}{" "}
                  <span className="font-normal text-blue-500">{r.email ?? "no email"}</span>
                </p>
                <p className="truncate text-xs text-blue-600">
                  {r.course_name} · {r.level} {r.country ? `· ${r.country}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{r.status}</Badge>
                <Button
                  size="sm"
                  onClick={() => handleSend(r)}
                  disabled={sendingId === r.id || !r.email}
                >
                  {sendingId === r.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send payment details
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
