import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function WidgetCard({ title, href, children, className = "" }) {
  return (
    <section className={`rounded-card border border-border bg-surface p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {href && (
          <Link
            href={href}
            aria-label={`Open ${title}`}
            className="rounded-btn p-1 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
          >
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
