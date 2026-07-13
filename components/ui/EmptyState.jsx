export default function EmptyState({ icon: Icon, heading, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-background p-4 text-muted">
          <Icon size={24} />
        </div>
      )}
      <p className="text-lg font-medium">{heading}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
