export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizes[size]} border-4 rounded-full animate-spin`} style={{ borderColor: '#d2d2d7', borderTopColor: '#6366f1' }}></div>
      {text && <p className="text-glass-secondary text-sm">{text}</p>}
    </div>
  );
}
