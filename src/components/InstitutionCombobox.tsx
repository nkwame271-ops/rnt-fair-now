import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { GHANA_INSTITUTIONS, normalizeInstitutionName } from "@/data/ghanaInstitutions";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Searchable combobox for selecting a Ghanaian tertiary institution.
 * If a student can't find their school in the list, they can type the
 * name and the value will be normalized so duplicates collapse.
 */
const InstitutionCombobox = ({ value, onChange, placeholder = "Select your school..." }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    if (!trimmedQuery) return GHANA_INSTITUTIONS;
    const q = trimmedQuery.toLowerCase();
    return GHANA_INSTITUTIONS.filter((s) => s.toLowerCase().includes(q));
  }, [trimmedQuery]);

  // Allow custom entry when the typed value isn't an exact (case-insensitive) match
  const showCustomOption =
    trimmedQuery.length > 1 &&
    !GHANA_INSTITUTIONS.some((s) => s.toLowerCase() === trimmedQuery.toLowerCase());

  const handleSelect = (raw: string) => {
    onChange(normalizeInstitutionName(raw));
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search universities, colleges..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtered.length === 0 && !showCustomOption && (
              <CommandEmpty>No matching school.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Institutions">
                {filtered.slice(0, 30).map((school) => (
                  <CommandItem
                    key={school}
                    value={school}
                    onSelect={() => handleSelect(school)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === school ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{school}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCustomOption && (
              <CommandGroup heading="Can't find your school?">
                <CommandItem value={`__custom__${trimmedQuery}`} onSelect={() => handleSelect(trimmedQuery)}>
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  Use "{normalizeInstitutionName(trimmedQuery)}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default InstitutionCombobox;
