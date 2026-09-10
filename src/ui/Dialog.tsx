import { X } from "lucide-react";
import type { ReactNode, Ref } from "react";

export function Dialog({ id, title, children, dialogRef, onClose }: { id: string; title: string; children: ReactNode; dialogRef?: Ref<HTMLDialogElement>; onClose?: () => void }) {
  return <dialog id={id} ref={dialogRef} className="dialog" aria-labelledby={`${id}-title`} onClose={onClose}>
    <div className="dialog-heading"><h2 id={`${id}-title`}>{title}</h2><button className="icon-button" type="button" commandfor={id} command="close" aria-label="閉じる"><X size={18} /></button></div>
    {children}
  </dialog>;
}
