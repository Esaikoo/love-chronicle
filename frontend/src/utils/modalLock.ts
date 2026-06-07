export function lockPageForModal() {
  const body = document.body;
  const count = Number(body.dataset.modalLocks ?? "0") + 1;
  body.dataset.modalLocks = String(count);
  body.classList.add("modal-open");
}

export function unlockPageForModal() {
  const body = document.body;
  const count = Math.max(0, Number(body.dataset.modalLocks ?? "1") - 1);
  if (count === 0) {
    delete body.dataset.modalLocks;
    body.classList.remove("modal-open");
    return;
  }
  body.dataset.modalLocks = String(count);
}
