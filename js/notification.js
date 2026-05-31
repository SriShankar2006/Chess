const toastRoot = document.createElement('div');
toastRoot.id = 'toastRoot';
toastRoot.className = 'toast-container';
Object.assign(toastRoot.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: '22px',
    pointerEvents: 'none',
    zIndex: 120
});
document.body.appendChild(toastRoot);

export function showToast(message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.pointerEvents = 'auto';
    toastRoot.appendChild(toast);
    window.requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });
    const timeout = setTimeout(() => {
        toast.classList.add('toast-leave');
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(18px)';
        setTimeout(() => toast.remove(), 280);
    }, 3000);
    toast.addEventListener('click', () => {
        clearTimeout(timeout);
        toast.remove();
    });
}
