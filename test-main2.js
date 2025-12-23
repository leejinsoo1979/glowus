// 모듈 캐시 조작 - electron 패키지를 우회
const Module = require('module');
const path = require('path');

// electron 패키지 경로
const electronPkgPath = path.join(__dirname, 'node_modules/electron/index.js');

// 원래 _load 저장
const originalLoad = Module._load;

// 패치된 _load
Module._load = function(request, parent, isMain) {
    if (request === 'electron') {
        // electron이 이미 문자열로 캐시되어 있으면 삭제
        if (require.cache[electronPkgPath]) {
            delete require.cache[electronPkgPath];
        }
        
        // 내장 모듈 로드 시도 (빈 parent로)
        try {
            const result = originalLoad.call(this, request, null, false);
            if (typeof result === 'object' && result.app) {
                console.log('Got real electron module!');
                return result;
            }
        } catch (e) {
            // 무시
        }
    }
    return originalLoad.call(this, request, parent, isMain);
};

// 이제 require
const electron = require('electron');
console.log('electron type:', typeof electron);
console.log('electron.app:', typeof electron.app);

if (electron.app) {
    electron.app.whenReady().then(() => {
        console.log('Ready!');
        electron.app.quit();
    });
} else {
    process.exit(1);
}
