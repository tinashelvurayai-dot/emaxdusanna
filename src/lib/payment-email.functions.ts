import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SETTING_KEY = "special_program_payment_email";

export const DEFAULT_PAYMENT_EMAIL = {
  en: {
    subject: "Your Edusanna Special Program certificate/diploma - payment details",
    body: `Dear {{name}},

Congratulations on successfully completing {{course}}!

We are delighted to recognize your commitment, dedication and successful completion of the program. To complete the certification process, please proceed with the {{amount}} program participation fee using one of the approved payment methods below.

OPTION 1: WESTERN UNION

Send the fee to the verified Edusanna-AHEP Special Programs Representative:

Full Legal Name: Tinashe Lee Vurayai
Country: Zimbabwe
City/Location: Harare
Purpose of Transfer: Program participation fee

After completing the transfer, send the MTCN, sender's full name, country sent from, amount sent, date of transfer, and recipient's full name via WhatsApp: +263 713 043 376 or email: tinashelvurayai@gmail.com.

Please keep your Western Union receipt until your payment has been confirmed.

OPTION 2: MUKURU

Full Name: Tinashe Lee Vurayai
Country: Zimbabwe
Phone: +263 71 304 3376
Payout: Cash Collection
City: Harare, Zimbabwe

After payment, send your Mukuru order/reference or voucher number, sender's full name, amount sent, date sent, and payment confirmation via WhatsApp: +263 713 043 376 or email: tinashelvurayai@gmail.com.

CERTIFICATE / DIPLOMA

Once your payment and certification requirements have been verified, your official digital certificate/diploma will be sent instantly by Edusanna via email. Physical copies will be presented at the Bruges Belgium Conference.

Your payment is officially received only after verification by the Special Program Representative. Please use only the verified contacts above.

With congratulations,

Edusanna
Elevate Your Mind
Special Programs`,
  },
  fr: {
    subject: "Votre certificat/diplôme Edusanna - détails du paiement",
    body: `Cher/Chère Participant(e),

Félicitations pour avoir terminé avec succès votre Programme Spécial !

Nous sommes heureux de reconnaître votre engagement et votre réussite. Afin de finaliser votre processus de certification, veuillez procéder au paiement des frais de participation au programme d'un montant de {{amount}}, en utilisant l'une des méthodes approuvées ci-dessous.

OPTION 1 : WESTERN UNION

Envoyez les frais au Représentant vérifié des Programmes Spéciaux Edusanna-AHEP :

Nom légal complet : Tinashe Lee Vurayai
Pays : Zimbabwe
Ville/Lieu : Harare
Motif du transfert : Frais de participation au programme

Après le transfert, envoyez le MTCN, le nom complet de l'expéditeur, le pays d'envoi, le montant envoyé, la date du transfert et le nom complet du bénéficiaire via WhatsApp : +263 713 043 376 ou email : tinashelvurayai@gmail.com.

Veuillez conserver votre reçu Western Union jusqu'à confirmation du paiement.

OPTION 2 : MUKURU

Nom complet : Tinashe Lee Vurayai
Pays : Zimbabwe
Téléphone : +263 71 304 3376
Mode de réception : Retrait en espèces
Ville : Harare, Zimbabwe

Après le paiement, envoyez le numéro de commande/référence Mukuru ou le numéro de bon, le nom complet de l'expéditeur, le montant envoyé, la date et la confirmation du paiement via WhatsApp : +263 713 043 376 ou email : tinashelvurayai@gmail.com.

CERTIFICAT / DIPLÔME

Une fois le paiement et les exigences de certification vérifiés, votre certificat/diplôme numérique officiel vous sera envoyé instantanément par Edusanna par email. Les exemplaires physiques seront remis lors de la Conférence de Bruges, en Belgique.

Votre paiement n'est officiellement reçu qu'après vérification par le Représentant des Programmes Spéciaux. Utilisez uniquement les coordonnées vérifiées ci-dessus.

Avec toutes nos félicitations,

Edusanna
Elevate Your Mind
Programmes Spéciaux`,
  },
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

/** Read the editable payment-details email frame. */
export const getPaymentEmailTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    const value = (data?.value ?? {}) as Partial<typeof DEFAULT_PAYMENT_EMAIL> & { subject?: string; body?: string };
    return {
      en: value.en ?? (value.subject || value.body ? { subject: value.subject ?? DEFAULT_PAYMENT_EMAIL.en.subject, body: value.body ?? DEFAULT_PAYMENT_EMAIL.en.body } : DEFAULT_PAYMENT_EMAIL.en),
      fr: value.fr ?? DEFAULT_PAYMENT_EMAIL.fr,
    };
  });

/** Save the editable payment-details email frame. */
export const savePaymentEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { en: { subject: string; body: string }; fr: { subject: string; body: string } }) => {
    const sanitize = (template: { subject: string; body: string }) => {
      const subject = (template.subject ?? "").trim().slice(0, 200);
      const body = (template.body ?? "").trim().slice(0, 12000);
      if (!subject || !body) throw new Error("Both language email templates require a subject and body");
      return { subject, body };
    };
    return { en: sanitize(input.en), fr: sanitize(input.fr) };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert(
      {
        key: SETTING_KEY,
        value: data,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? "");
}

const METHOD_LABELS: Record<string, string> = {
  ecocash: "Ecocash",
  mukuru: "Mukuru",
  western_union: "Western Union",
};

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

function rawEmail(to: string, subject: string, body: string) {
  const message = [
    `To: ${to}`,
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  return b64(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Send the payment-details email to one learner through the connected Gmail
 * account (no third-party email service involved).
 */
export const sendPaymentEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; subject?: string; body?: string }) => {
    if (!input.requestId) throw new Error("Missing request id");
    return {
      requestId: input.requestId,
      subject: input.subject?.trim() || undefined,
      body: input.body?.trim() || undefined,
    };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error } = await supabaseAdmin
      .from("alt_payment_requests")
      .select("id, student_name, email, course_name, level, amount, methods, country")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Request not found");
    if (!req.email) throw new Error("This learner has no email on file");

    const { data: setting } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    const saved = (setting?.value ?? {}) as Partial<typeof DEFAULT_PAYMENT_EMAIL> & { subject?: string; body?: string };
    const savedEn = saved.en ?? (saved.subject || saved.body ? { subject: saved.subject ?? DEFAULT_PAYMENT_EMAIL.en.subject, body: saved.body ?? DEFAULT_PAYMENT_EMAIL.en.body } : DEFAULT_PAYMENT_EMAIL.en);

    const vars = {
      name: req.student_name ?? "learner",
      course: req.course_name ?? "your programme",
      level: req.level === "diploma" ? "Diploma" : "Certificate",
      amount: `$${Number(req.amount ?? 0).toFixed(2)} USD`,
      country: req.country ?? "-",
      methods: (req.methods ?? []).map((m: string) => METHOD_LABELS[m] ?? m).join(", "),
    };

    const subject = fill(data.subject ?? savedEn.subject ?? DEFAULT_PAYMENT_EMAIL.en.subject, vars);
    const body = fill(data.body ?? savedEn.body ?? DEFAULT_PAYMENT_EMAIL.en.body, vars);

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
    if (!lovableKey || !gmailKey) {
      throw new Error(
        "Gmail is not connected yet. Connect the Gmail account in Lovable connectors to enable sending.",
      );
    }

    const res = await fetch(
      "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmailKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: rawEmail(req.email, subject, body) }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${text}`);
      throw new Error(`Gmail send failed [${res.status}]: ${text}`);
    }

    await supabaseAdmin
      .from("alt_payment_requests")
      .update({ status: "noted", notes: `Payment email sent ${new Date().toISOString()}` })
      .eq("id", req.id);

    return { ok: true, to: req.email };
  });
