"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withMockedConsole = void 0;
/**
 * A utility function to mock console.log and console.error and capture their output
 * @param callback The function to execute while console is mocked
 * @returns The captured console output (both log and error messages)
 */
const withMockedConsole = (callback) => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    let capturedOutput = [];
    console.log = (...args) => {
        capturedOutput.push(args.join(" "));
    };
    console.error = (...args) => {
        capturedOutput.push(args.join(" "));
    };
    try {
        callback();
    }
    finally {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    }
    return capturedOutput.join("\n");
};
exports.withMockedConsole = withMockedConsole;
