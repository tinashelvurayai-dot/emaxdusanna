import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/support")({
  head: () => pageHead({ title: "Support & Payment Issues | Edusanna", description: "Contact Edusanna support about payment issues, disputes, account access, or credential assistance.", path: "/support" }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="min-h-screen bg-blue-50/30">
      <SiteNavbar />
      <main className="px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-black hover:text-blue-700">
            <ArrowLeft aria-hidden="true" /> Back to Edusanna
          </Link>
          <section className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl sm:p-12">
            <div className="mb-8 flex size-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <ShieldAlert aria-hidden="true" />
            </div>
            <h1 className="text-4xl font-black text-blue-950">Payment &amp; learner support</h1>
            <p className="mt-4 text-lg leading-relaxed text-blue-800">We are here to help with payment disputes, duplicate charges, account access, credential submissions, and other learner concerns.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <a href="mailto:edusannaonlinelearning@gmail.com?subject=Payment%20support" className="block">
                <Button className="w-full bg-blue-700 text-white hover:bg-blue-800"><Mail data-icon="inline-start" /> Email payment support</Button>
              </a>
              <a href="mailto:edusannaonlinelearning@gmail.com?subject=Learner%20support" className="block">
                <Button variant="outline" className="w-full"><MessageCircle data-icon="inline-start" /> Contact learner support</Button>
              </a>
            </div>
            <p className="mt-8 text-sm leading-relaxed text-blue-700">When contacting us, include the account email, payment reference, course or credential name, transaction date, and a concise description of the issue. Do not send passwords or full card details.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
