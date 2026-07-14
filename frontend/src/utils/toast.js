export function showToast(message, type = 'info') {
  const container = getOrCreateContainer();
  const toast = document.createElement('div');
  
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 mb-2 animate-slide-in`;
  toast.innerHTML = `
    <span class="text-lg font-bold">${icons[type]}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slide-out 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getOrCreateContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-50';
    document.body.appendChild(container);
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slide-in {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
      .animate-slide-in { animation: slide-in 0.3s ease-out; }
    `;
    document.head.appendChild(style);
  }
  return container;
}

export const toast = {
  success: (message) => showToast(message, 'success'),
  error: (message) => showToast(message, 'error'),
  info: (message) => showToast(message, 'info'),
  warning: (message) => showToast(message, 'warning')
};
