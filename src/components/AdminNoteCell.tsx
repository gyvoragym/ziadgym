import { useState } from 'react';
import { StickyNote } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

/** Notes cell: icon only when a note exists; clicking the cell opens an editor for the separate admin note. */
export function AdminNoteCell({ gymName, note, onSave, title = 'Admin note', description = 'Private admin note. Separate from freeze, rejection and deletion reasons.', emptyText, saveLabel = 'Save note' }: { gymName: string; note: string; onSave: (note: string) => Promise<void> | void; title?: string; description?: string; emptyText?: string; saveLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const hasNote = !!note.trim();
  return (
    <>
      <button
        type="button"
        aria-label={hasNote ? `View or edit ${title.toLowerCase()} for ${gymName}` : `Add ${title.toLowerCase()} for ${gymName}`}
        title={hasNote ? note : undefined}
        className="flex h-9 w-full min-w-[3rem] items-center rounded-md text-primary hover:bg-muted/50"
        onClick={() => { setDraft(note); setOpen(true); }}
      >
        {hasNote ? <StickyNote className="mx-2 h-4 w-4" /> : emptyText ? <span className="mx-2 text-muted-foreground">{emptyText}</span> : null}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title} — {gymName}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Textarea rows={5} maxLength={2000} aria-label={title} value={draft} onChange={e => setDraft(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={async () => {
              setBusy(true);
              try { await onSave(draft.trim()); setOpen(false); toast.success(`${title} saved.`); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save note.'); }
              finally { setBusy(false); }
            }}>{saveLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
