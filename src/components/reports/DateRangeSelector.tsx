import { useState } from "react";
import { format, startOfDay, setHours, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TimeRangePreset = "7d" | "30d" | "90d" | "custom";

export interface DateRangeConfig {
  type: TimeRangePreset;
  // For custom ranges
  customDate?: Date;
  cutoffHour: number; // 0-23, default 8 (8 AM)
}

export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateRangeSelectorProps {
  value: DateRangeConfig;
  onChange: (config: DateRangeConfig) => void;
}

const CUTOFF_HOURS = [
  { value: 0, label: "12:00 AM (medianoche)" },
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 10, label: "10:00 AM" },
  { value: 12, label: "12:00 PM (mediodía)" },
];

export function calculateDateRange(config: DateRangeConfig): DateRangeResult {
  const now = new Date();
  const cutoffHour = config.cutoffHour;

  if (config.type === "custom" && config.customDate) {
    // For daily reports: from cutoffHour of previous day to cutoffHour of selected day
    const selectedDate = config.customDate;
    const endDate = setHours(startOfDay(selectedDate), cutoffHour);
    const startDate = setHours(startOfDay(subDays(selectedDate, 1)), cutoffHour);

    return {
      startDate,
      endDate,
      label: `Día ${format(selectedDate, "d MMM yyyy", { locale: es })} (corte ${cutoffHour}:00)`,
    };
  }

  // Preset ranges
  const days = config.type === "7d" ? 7 : config.type === "30d" ? 30 : 90;
  const endDate = now;
  const startDate = subDays(now, days);

  const labelMap: Record<string, string> = {
    "7d": "Últimos 7 días",
    "30d": "Últimos 30 días",
    "90d": "Últimos 90 días",
  };

  return {
    startDate,
    endDate,
    label: labelMap[config.type] || "Personalizado",
  };
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePresetChange = (preset: TimeRangePreset) => {
    if (preset === "custom") {
      onChange({
        ...value,
        type: "custom",
        customDate: value.customDate || new Date(),
      });
    } else {
      onChange({
        ...value,
        type: preset,
        customDate: undefined,
      });
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onChange({
        ...value,
        type: "custom",
        customDate: date,
      });
      setCalendarOpen(false);
    }
  };

  const handleCutoffChange = (hour: string) => {
    onChange({
      ...value,
      cutoffHour: parseInt(hour, 10),
    });
  };

  const rangeResult = calculateDateRange(value);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Tabs
        value={value.type}
        onValueChange={(v) => handlePresetChange(v as TimeRangePreset)}
        className="w-full sm:w-auto"
      >
        <TabsList className="grid w-full grid-cols-4 sm:w-auto">
          <TabsTrigger value="7d">7 días</TabsTrigger>
          <TabsTrigger value="30d">30 días</TabsTrigger>
          <TabsTrigger value="90d">90 días</TabsTrigger>
          <TabsTrigger value="custom">Día</TabsTrigger>
        </TabsList>
      </Tabs>

      {value.type === "custom" && (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !value.customDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value.customDate
                    ? format(value.customDate, "d MMM yyyy", { locale: es })
                    : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value.customDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hora corte</Label>
            <Select
              value={value.cutoffHour.toString()}
              onValueChange={handleCutoffChange}
            >
              <SelectTrigger className="w-[140px]">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUTOFF_HOURS.map((h) => (
                  <SelectItem key={h.value} value={h.value.toString()}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {value.type === "custom" && value.customDate && (
        <div className="text-xs text-muted-foreground sm:ml-2">
          {format(calculateDateRange(value).startDate, "d MMM HH:mm", { locale: es })}
          {" → "}
          {format(calculateDateRange(value).endDate, "d MMM HH:mm", { locale: es })}
        </div>
      )}
    </div>
  );
}
