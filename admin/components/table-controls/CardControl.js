import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';
import { CardControlMixin } from './CardControlMixin.js';

/*
  Base for kempo-files' single-action, file-only per-card icon buttons (toggle-public,
  toggle-trusted) — CardControlMixin's record resolution plus hiding on anything that isn't a file.
  Rename/Move/Delete (TcRenameEntry/TcMoveEntry/TcDeleteEntry) apply to a folder too, so those use
  CardRecordMixin directly instead — see that file for the split.
*/
export default class CardControl extends CardControlMixin(ButtonControl) {}
