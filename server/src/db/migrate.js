// CLI entry: `npm run migrate`
import { migrate } from './index.js';

const result = migrate();
console.log(`Migrations: applied ${result.applied} of ${result.total}.`);
