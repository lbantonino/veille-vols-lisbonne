import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { voyage } from '../../src/config.ts';

const SITE = fileURLToPath(new URL('../../site/', import.meta.url));

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

// site/ est servi à tout le monde, sans code : rien de personnel ne doit s'y trouver.
test('la page publique ne contient aucune donnée personnelle', () => {
  const interdits = [voyage.aller, voyage.retour, voyage.aller.slice(0, 7), 'anniversaire', 'semi-marathon', 'Antonino', 'lbantonino'];
  for (const fichier of fichiers(SITE)) {
    const contenu = readFileSync(fichier, 'utf8');
    for (const mot of interdits) {
      assert.equal(contenu.includes(mot), false, `« ${mot} » trouvé dans ${fichier.replace(SITE, 'site/')}`);
    }
  }
});
