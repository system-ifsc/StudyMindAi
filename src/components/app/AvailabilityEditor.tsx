import { WEEKDAYS_SHORT, WEEKDAYS } from "@/lib/core/dates";
import { Input } from "@/components/ui/input";

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <fieldset className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      <legend className="mb-2 text-sm font-medium">Minutos disponíveis por dia</legend>
      {WEEKDAYS_SHORT.map((d, i) => (
        <label key={d} className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{d}</span>
          <Input
            type="number"
            min={0}
            max={960}
            step={15}
            value={value[i] ?? 0}
            aria-label={`Minutos disponíveis na ${WEEKDAYS[i]}`}
            onChange={(e) => {
              const n = [...value];
              n[i] = Math.max(0, Math.min(960, Number(e.target.value) || 0));
              onChange(n);
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}
