import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

export default class Breadcrumb extends ShadowComponent {
  static properties = {
    trail: { type: Array },
  };

  constructor(){
    super();
    this.trail = [];
  }

  navigate = id => () => {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { id }, bubbles: true, composed: true }));
  };

  render(){
    return html`
      <nav class="d-f mb">
        <button class="no-btn link" @click=${this.navigate('')}>Library</button>
        ${this.trail.map(directory => html`
          <span class="tc-muted">/</span>
          <button class="no-btn link" @click=${this.navigate(directory.id)}>${directory.name}</button>
        `)}
      </nav>
    `;
  }

  static styles = css`
    :host { display: block; }
    nav { align-items: center; gap: var(--spacer_q); flex-wrap: wrap; }
  `;
}

customElements.define('k-files-breadcrumb', Breadcrumb);
