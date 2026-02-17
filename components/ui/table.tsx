import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="[&_tr]:border-b [&_tr]:border-border" {...props} />;
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="[&_tr:last-child]:border-0" {...props} />;
}

export function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="border-b border-border hover:bg-muted/40" {...props} />;
}

export function TableHead(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className="h-11 px-4 text-left align-middle text-muted-foreground" {...props} />;
}

export function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className="p-4 align-middle" {...props} />;
}
