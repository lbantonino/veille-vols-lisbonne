// Un passage d'Escale. GitHub le lance toutes les heures (voir .github/workflows/veille.yml).
// Selon la date, c'est la mission Lisbonne (LisbonIA) ou la mission Palerme (PalermoIA) qui travaille.
import { missionActive } from './missions.ts';
import { passageLisbonne } from './missions/lisbonne.ts';
import { passagePalerme } from './palerme/passage.ts';

const maintenant = new Date();
const mission = missionActive(maintenant);
console.log(`Mission active : ${mission.robot}.`);
if (mission.id === 'lisbonne') await passageLisbonne(maintenant);
else await passagePalerme(maintenant);
