import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Dropdown.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

/*
  One menu per entry instead of a row of icon buttons. A dropdown labels every action in words, fits
  any number of them, and does not need to be hidden until hover to avoid crowding the row.

  List view only now — grid tiles get their rename/move/delete from real per-card controls
  (k-files-tc-rename-entry/move-entry/delete-entry) slotted into a genuine kc-menu instead, since
  those apply to a file or a folder identically and can be reused as-is. This still exists because
  list view's file row needs more than those three (details, open in new tab, public/trust toggles,
  alias) and isn't built from real controls the same way — a bigger rework than what's being asked
  for here.

  Dispatches `action` ({ detail: { action, kind, entry } }) rather than calling anything directly —
  the library owns what each action actually does (an API call, a confirm dialog); this only knows
  which button was clicked.
*/
export default class EntryMenu extends ShadowComponent {
  static properties = {
    kind: { type: String }, // 'file' | 'directory'
    entry: { type: Object },
    canTrust: { type: Boolean, attribute: 'can-trust' },
  };

  constructor(){
    super();
    this.kind = 'file';
    this.entry = null;
    this.canTrust = false;
  }

  select = e => {
    this.dispatchEvent(new CustomEvent('action', {
      detail: { action: e.detail.value, kind: this.kind, entry: this.entry },
      bubbles: true,
      composed: true,
    }));
  };

  render(){
    const entry = this.entry;
    if(!entry) return html``;

    return html`
      <k-dropdown open-direction="left" @select=${this.select}>
        <button slot="trigger" class="no-btn menu-trigger" title="Actions"><k-icon name="more_vert"></k-icon></button>
        ${this.kind === 'directory' ? html`
          <button data-value="rename"><k-icon name="edit"></k-icon> Rename…</button>
          <button data-value="move"><k-icon name="drive_file_move"></k-icon> Move to…</button>
          <button data-value="delete" class="tc-danger"><k-icon name="delete"></k-icon> Delete…</button>
        ` : html`
          <button data-value="details">Details…</button>
          <button data-value="open">Open in new tab</button>
          <button data-value="rename">Rename…</button>
          <button data-value="move">Move to…</button>
          <button data-value="public">${entry.public ? 'Make private' : 'Make public'}</button>
          ${entry.public ? html`<button data-value="alias">${entry.alias ? 'Edit alias…' : 'Set alias…'}</button>` : ''}
          ${this.canTrust && entry.reviewable !== false ? html`<button data-value="trust">${entry.trusted ? 'Withdraw approval' : 'Approve to run'}</button>` : ''}
          <button data-value="delete" class="tc-danger">Delete…</button>
        `}
      </k-dropdown>
    `;
  }

  /*
    Matches ButtonControl's own :host styling (border/padding/margin/size/hover/focus) — reads as the
    same kind of control as every other icon button here, list rows included.
  */
  static styles = css`
    :host { display: contents; }
    .menu-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2rem;
      min-height: 2rem;
      background: transparent;
      border: 1px solid var(--c_border);
      border-radius: var(--radius);
      margin: var(--spacer_q);
      padding: var(--spacer_h);
      color: inherit;
      cursor: pointer;
      outline: none;
      font-size: inherit;
      user-select: none;
      transition: background-color var(--animation_ms), box-shadow var(--animation_ms);
    }
    .menu-trigger:hover {
      background: oklch(from var(--c_bg__inv) l c h / 0.15);
    }
    .menu-trigger:focus,
    .menu-trigger:focus-visible {
      box-shadow: var(--focus_shadow);
      z-index: 1;
    }
  `;
}

customElements.define('k-files-entry-menu', EntryMenu);
