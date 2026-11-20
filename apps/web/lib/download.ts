export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = "none";
  // Some browsers (older Firefox) only honor click() on attached elements.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking right away can cancel the download in some browsers; give the
  // browser time to start reading the blob first.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
