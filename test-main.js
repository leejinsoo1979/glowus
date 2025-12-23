console.log('Testing in Electron 33...');
console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);

const { app } = require('electron');
console.log('app:', typeof app);

if (app) {
    app.whenReady().then(() => {
        console.log('App ready!');
        app.quit();
    });
} else {
    console.log('app is undefined!');
    process.exit(1);
}
