import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/support")({
  head: () => pageHead({
    title: "Support & Payment Disputes | Edusanna",
    description: "Contact Edusanna support about payment issues, disputes, credential payments, or account questions.",
    path: "/support",
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <SiteNavbar />
      <main className="px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-950">
            <ArrowLeft aria-hidden="true" /> Back to Edusanna
          </Link>
          <section className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 p-8 text-white shadow-xl sm:p-12">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-200">Edusanna Support</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">We&apos;re here to help resolve payment issues.</h1>
              <p className="mt-5 text-lg leading-8 text-blue-100">Contact our support team for payment disputes, credential-payment questions, account access issues, or help understanding your next step.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="mailto:edusannaonlinelearning@gmail.com?subject=Edusanna%20payment%20support" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-blue-950 hover:bg-sky-50"><Mail aria-hidden="true" /> Email payment support</a>
                <a href="mailto:edusannaonlinelearning@gmail.com?subject=Edusanna%20dispute" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 font-bold text-white hover:bg-white/10"><MessageCircle aria-hidden="true" /> Raise a dispute</a>
              </div>
            </div>
          </section>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              [ShieldAlert, "Payment disputes", "Include your full name, email, course, payment method, amount, date, and a clear description of the issue."],
              [MessageCircle, "Account support", "Tell us what you were trying to do and include your Edusanna account email so we can locate the right record."],
              [Mail, "Response channel", "Support is handled by email at edusannaonlinelearning@gmail.com. Please keep your payment reference available."],
            ].map(([Icon, title, description]) => {
              const SupportIcon = Icon as typeof ShieldAlert;
              return <article key={title as string} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><SupportIcon className="text-blue-600" aria-hidden="true" /><h2 className="mt-4 font-bold text-blue-950">{title as string}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description as string}</p></article>;
            })}
          </div>
          <p className="mt-8 text-sm leading-6 text-slate-600">For faster assistance, do not send passwords or full card details. Edusanna will never ask you to share a password or one-time security code.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
