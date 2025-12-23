console.log('=== Running as Electron Main Process ===');
console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);

const { app, BrowserWindow } = require('electron');
console.log('app:', typeof app);
console.log('BrowserWindow:', typeof BrowserWindow);

if (app && app.whenReady) {
    app.whenReady().then(() => {
        console.log('App is ready!');
        app.quit();
    });
} else {
    console.log('FAILED: app is not available');
    process.exit(1);
}
