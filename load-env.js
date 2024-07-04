require('dotenv').config();
const { execSync } = require('child_process');

execSync('electron-builder --publish=always', { stdio: 'inherit' });
