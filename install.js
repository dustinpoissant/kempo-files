import { join } from 'path';
import { mkdir, writeFile, stat } from 'fs/promises';

/*
  Creates the library root.

  `files/` is a sibling of `public/`, never inside it, and that placement is the whole security
  model: kempo-server's static scanner is rooted at `public/`, so nothing here can be served by
  accident. Every byte that reaches a browser goes through a route that checked a permission and
  fired the download hook first — which is also what makes gated downloads, per-file trust and the
  before_download veto possible at all.

  A README is dropped alongside it because an unexplained top-level directory full of other
  people's uploads is exactly the sort of thing someone later decides to "tidy up".
*/
const NOTE = `# files/

This directory is the kempo-files library. Uploads live here, in real folders with real filenames.

It is deliberately **outside public/** so kempo-server never serves anything in it directly —
downloads are handled by kempo-files' own routes, which check permissions first. Moving this
inside public/ would make every file in it world-readable regardless of its settings.

Do not rename or reorganise these folders by hand: the database records which folder each file
lives in, and renaming one here without renaming it there loses track of the files inside it.
`;

export default async () => {
  const root = join(process.cwd(), 'files');
  await mkdir(root, { recursive: true });

  const notePath = join(root, 'README.md');
  try {
    await stat(notePath);
  } catch {
    await writeFile(notePath, NOTE);
  }

  console.log('[kempo-files] Created files/ at the site root (a sibling of public/, not inside it).');
};
