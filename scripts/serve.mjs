import { createApp } from './server.mjs';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const portArg = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portArg >= 0 ? process.argv[portArg + 1] : 3000));
createApp().listen(port, '127.0.0.1', () => console.log('MyRotine em http://localhost:' + port));
