import { useRef, useState } from "react";
import { CheckCircle2, Printer, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { toast } from "sonner";

export type PaymentReceipt = {
  receiptNo: string;
  issuedAt: string;
  schoolName: string;
  className?: string | null;
  studentName: string;
  email?: string | null;
  courseName: string;
  level: "certificate" | "diploma";
  amount: number;
  certificateId: string;
  method?: string;
  verifiedBy?: string | null;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Printable / downloadable receipt sheet. Rendered inside the dialog and
 *  captured as-is for the PDF, so what the school admin sees is what prints. */
export function ReceiptSheet({ receipt, innerRef }: { receipt: PaymentReceipt; innerRef?: React.Ref<HTMLDivElement> }) {
  const label = receipt.level === "diploma" ? "Diploma" : "Certificate";
  return (
    <div
      ref={innerRef}
      id="receipt-print"
      className="bg-white text-blue-950 rounded-2xl overflow-hidden border border-blue-100 shadow-sm w-full max-w-[640px] mx-auto"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-purple-700 text-white px-6 py-5 flex items-center gap-4">
        <img src="/logo.webp" alt="Edusanna" width={44} height={44} className="w-11 h-11 rounded-lg bg-white/90 object-contain p-1" />
        <div className="min-w-0">
          <div className="text-lg font-black leading-tight">Edusanna</div>
          <div className="text-xs opacity-90">Official payment receipt</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[11px] uppercase tracking-wide opacity-80">Amount paid</div>
          <div className="text-2xl font-black">${receipt.amount.toFixed(2)}</div>
        </div>
      </div>

      {/* Meta */}
      <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-b border-dashed border-blue-200">
        <Field label="Receipt no." value={receipt.receiptNo} mono />
        <Field label="Date issued" value={fmtDate(receipt.issuedAt)} />
        <Field label="School" value={receipt.schoolName} />
        <Field label="Class" value={receipt.className || "-"} />
      </div>

      {/* Payer */}
      <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-b border-dashed border-blue-200">
        <Field label="Received from" value={receipt.studentName} />
        <Field label="Email" value={receipt.email || "-"} />
        <Field label="Payment method" value={receipt.method || "Cash (paid at school)"} />
        <Field label="Status" value="Confirmed" tone="green" />
      </div>

      {/* Line item */}
      <div className="px-6 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-blue-500">
              <th className="pb-2 font-semibold">Description</th>
              <th className="pb-2 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-blue-100">
              <td className="py-3 pr-3">
                <div className="font-semibold text-blue-900">{receipt.courseName}</div>
                <div className="text-xs text-blue-600">{label} credential fee</div>
              </td>
              <td className="py-3 text-right font-semibold text-blue-900">${receipt.amount.toFixed(2)}</td>
            </tr>
            <tr className="border-t border-blue-100">
              <td className="py-3 text-right font-bold text-blue-900">Total paid</td>
              <td className="py-3 text-right font-black text-blue-900">${receipt.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Credential */}
      <div className="mx-6 mb-5 rounded-xl bg-blue-50 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <div className="font-semibold text-blue-900">{label} credential ID</div>
          <div className="font-mono text-blue-800 break-all">{receipt.certificateId}</div>
          <div className="text-xs text-blue-600 mt-1">
            Verify this credential any time at edusanna.com/verify using the ID above.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 flex items-end justify-between gap-6">
        <div className="text-[11px] leading-relaxed text-blue-500 max-w-[60%]">
          Thank you for your payment. This receipt confirms the amount above was received on behalf of Edusanna
          by {receipt.schoolName}. Keep it for your records.
        </div>
        <div className="text-center">
          <div className="w-40 border-b border-blue-300 h-8" />
          <div className="text-[11px] text-blue-500 mt-1">Authorised signature</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: "green" }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-blue-500">{label}</div>
      <div
        className={`font-semibold break-words ${mono ? "font-mono text-[13px]" : ""} ${
          tone === "green" ? "text-green-700" : "text-blue-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function PaymentReceiptDialog({
  receipt,
  open,
  onOpenChange,
}: {
  receipt: PaymentReceipt | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!ref.current || !receipt) return;
    setBusy(true);
    try {
      await downloadReceiptPdf(ref.current, `Edusanna-receipt-${receipt.receiptNo}.pdf`);
    } catch {
      toast.error("Could not build the PDF. Try printing instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> Payment receipt
          </DialogTitle>
          <DialogDescription>
            Download or print this receipt and hand it to the person who paid.
          </DialogDescription>
        </DialogHeader>

        {receipt && <ReceiptSheet receipt={receipt} innerRef={ref} />}

        <DialogFooter className="gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} disabled={!receipt}>
            <Printer className="w-4 h-4 mr-1.5" /> Print
          </Button>
          <Button className="premium-button" onClick={download} disabled={!receipt || busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileDown className="w-4 h-4 mr-1.5" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
