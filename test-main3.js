// Electron의 내장 모듈 시스템 탐색
console.log('=== Module System Debug ===');

// 1. process 객체에서 electron 관련 항목 확인
console.log('process.type:', process.type);
console.log('process.electronBinding:', typeof process.electronBinding);

// 2. Module 캐시 확인 (electron 관련)
const Module = require('module');
const electronKeys = Object.keys(require.cache).filter(k => k.includes('electron'));
console.log('Electron cache keys:', electronKeys.length);

// 3. NativeModule 확인
console.log('NativeModule:', typeof process.binding);

// 4. 전역 객체 확인
console.log('global.electron:', typeof global.electron);

// 5. require.resolve 결과
console.log('require.resolve("electron"):', require.resolve('electron'));

// 6. 직접 경로 없이 로드 시도
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
    if (request === 'electron') {
        console.log('Intercepted electron resolve, parent:', parent?.filename);
    }
    return originalResolve.call(this, request, parent, isMain, options);
};

try {
    const e = require('electron');
    console.log('Direct require result:', typeof e);
} catch (err) {
    console.log('Direct require error:', err.message);
}

process.exit(0);
