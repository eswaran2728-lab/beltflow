/**
 * Restarts the BeltFlow server against the SAME embedded PostgreSQL data
 * directory used by start_e2e_server.js, without wiping it — used to prove
 * data survives a full server/DB restart (persistence verification).
 */
const path = require('path');

process.env.PG_DATA_DIR = path.join(__dirname, '.test_beltflow_e2e_ui_pgdata');
process.env.JWT_SECRET = 'beltflow_e2e_ui_secret_2026';
process.env.PORT = '4500';

require('../server/dist/index.js');
