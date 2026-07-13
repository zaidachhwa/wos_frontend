// RHF-friendly field wrappers. React 19 passes ref via props, so
// {...register("name")} spreads cleanly onto the native elements.

const inputClasses =
  "mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary disabled:opacity-50";

export function Input({ label, error, ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={props.id || props.name} className="text-sm font-medium">
          {label}
        </label>
      )}
      <input id={props.id || props.name} className={inputClasses} {...props} />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, rows = 3, ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={props.id || props.name} className="text-sm font-medium">
          {label}
        </label>
      )}
      <textarea id={props.id || props.name} rows={rows} className={inputClasses} {...props} />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={props.id || props.name} className="text-sm font-medium">
          {label}
        </label>
      )}
      <select id={props.id || props.name} className={inputClasses} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-surface text-primary hover:bg-background",
    ghost: "text-muted hover:bg-background hover:text-primary",
    danger: "bg-danger text-primary-foreground hover:opacity-90",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
