"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTmpDir = withTmpDir;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Creates a temporary directory, executes a function with that directory, then removes it
 */
function withTmpDir(fn) {
    const dir = (0, fs_1.mkdtempSync)((0, path_1.join)(__dirname, '.tmptest'));
    try {
        return fn(dir);
    }
    finally {
        (0, fs_1.rmSync)(dir, { recursive: true, force: true });
    }
}
