export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-6xl mb-4">{icon || '📋'}</div>
      <h3 className="text-xl font-semibold text-glass-primary mb-2">{title}</h3>
      <p className="text-glass-secondary text-center mb-6 max-w-sm">{description}</p>
      {action && <button onClick={action.onClick} className="glass-btn px-4 py-2">{action.label}</button>}
    </div>
  );
}
