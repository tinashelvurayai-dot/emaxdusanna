import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CountrySelectProps {
  value: string;
  onChange: (country: string) => void;
  id?: string;
  disabled?: boolean;
}

/** Scrollable, searchable picker containing every country in the world. */
export function CountrySelect({ value, onChange, id, disabled }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(needle));
  }, [q]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-white font-normal",
            value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {value || "Select your country"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search countries…"
            aria-label="Search countries"
            className="h-9 pl-8 text-foreground"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No country found.</li>
          )}
          {results.map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={value === c}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
              >
                <Check className={cn("h-4 w-4", value === c ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                {c}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
