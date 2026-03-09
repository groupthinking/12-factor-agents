"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cli = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const Diff = __importStar(require("diff"));
const child_process_1 = require("child_process");
function getSectionBaseName(section) {
    return section.name || section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
function copySourceFiles(srcFile, projectRoot, sectionDir) {
    const srcAbsPath = path.resolve(projectRoot, srcFile);
    const relPath = path.relative(projectRoot, srcAbsPath);
    const destPath = path.join(sectionDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcAbsPath, destPath);
}
function copyWorkingFile(srcFile, destFile, sectionDir) {
    const srcPath = path.join(sectionDir, srcFile);
    const destPath = path.join(sectionDir, destFile);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
}
function copyDirectory(src, dest) {
    if (!fs.existsSync(src))
        return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
function applyStepsToWorkingDir(steps, projectRoot, workingDir, sectionPath = null // If provided, also copy source files to section's walkthrough/
) {
    var _a, _b;
    if (!steps)
        return;
    for (const step of steps) {
        // Handle dir creation
        if ((_a = step.dir) === null || _a === void 0 ? void 0 : _a.create) {
            const dirToCreate = path.join(workingDir, step.dir.path);
            fs.mkdirSync(dirToCreate, { recursive: true });
        }
        // Handle file copy
        if ((_b = step.file) === null || _b === void 0 ? void 0 : _b.src) {
            // Copy to working directory
            const srcAbsPath = path.resolve(projectRoot, step.file.src);
            const destPath = path.join(workingDir, step.file.dest);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcAbsPath, destPath);
            // If a section path is provided, also copy source file to section's walkthrough/
            if (sectionPath) {
                copySourceFiles(step.file.src, projectRoot, sectionPath);
            }
        }
        // Handle command execution - only run if incremental is explicitly true
        if (step.command && step.incremental === true) {
            try {
                (0, child_process_1.execSync)(step.command, { cwd: workingDir, stdio: 'inherit' });
            }
            catch (error) {
                console.error(`Error executing incremental command "${step.command}" in ${workingDir}:`, error);
                // Log error but continue, matching behavior of file copy errors
            }
        }
    }
}
function generateSectionMarkdown(section) {
    var _a;
    let markdown = `# ${section.title}\n\n`;
    if (section.text) {
        markdown += `${section.text}\n\n`;
    }
    if (section.steps) {
        for (const step of section.steps) {
            if (step.text) {
                markdown += `${step.text}\n\n`;
            }
            if ((_a = step.dir) === null || _a === void 0 ? void 0 : _a.create) {
                markdown += `    mkdir -p ${step.dir.path}\n\n`;
            }
            if (step.file) {
                markdown += `    cp ${step.file.src} ${step.file.dest}\n\n`;
            }
            if (step.command) {
                markdown += `    ${step.command.trim()}\n\n`;
            }
            if (step.results) {
                for (const result of step.results) {
                    markdown += `${result.text}\n\n`;
                    if (result.code) {
                        markdown += `    ${result.code.trim()}\n\n`;
                    }
                }
            }
        }
    }
    return markdown;
}
function formatMinimalDiff(filePath, oldContent, newContent) {
    // Normalize line endings in both inputs
    const normalize = (str) => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const normalizedOld = normalize(oldContent);
    const normalizedNew = normalize(newContent);
    if (normalizedOld === normalizedNew) {
        return null;
    }
    // Using context: 2 to show some surrounding lines
    const patch = Diff.createPatch(filePath, normalizedOld, normalizedNew, '', '', { context: 2 });
    const patchLines = patch.split('\n');
    const effectiveChangeLines = [];
    let i = 0;
    while (i < patchLines.length) {
        const line = patchLines[i];
        // Skip standard patch headers and hunk metadata
        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
            i++;
            continue;
        }
        // Check for identical remove/add pairs (which means no effective change for these two lines)
        if (line.startsWith('-')) {
            let nextDiffLineIndex = i + 1;
            // Skip empty lines AND "No newline" markers AND context lines to find the next actual diff line
            while (nextDiffLineIndex < patchLines.length &&
                (patchLines[nextDiffLineIndex].trim() === '' ||
                    patchLines[nextDiffLineIndex].startsWith('\\') ||
                    patchLines[nextDiffLineIndex].startsWith(' '))) {
                nextDiffLineIndex++;
            }
            if (nextDiffLineIndex < patchLines.length && patchLines[nextDiffLineIndex].startsWith('+')) {
                const removedText = line.substring(1).trim();
                const addedText = patchLines[nextDiffLineIndex].substring(1).trim();
                if (removedText === addedText) {
                    // Advance i past the current line, any skipped empty lines, and the matched added line
                    i = nextDiffLineIndex + 1;
                    continue;
                }
            }
        }
        // If the line starts with +, -, or space (context), it's a line to be included
        if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
            effectiveChangeLines.push(line);
        }
        i++;
    }
    if (effectiveChangeLines.length > 0) {
        return `\`\`\`diff\n${filePath}\n${effectiveChangeLines.join('\n')}\n\`\`\`\n\n`;
    }
    return null;
}
function generateRichSectionMarkdown(section, projectRoot, sectionWorkingDir, walkthroughTargets) {
    var _a, _b, _c, _d, _e, _f, _g;
    let markdown = `# ${section.title}\n\n`;
    if (section.text) {
        markdown += `${section.text}\n\n`;
    }
    // Initialize section's virtual file state from the actual files in sectionWorkingDir
    const sectionVirtualFileState = new Map();
    if (fs.existsSync(sectionWorkingDir)) {
        const readFilesRecursively = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(sectionWorkingDir, fullPath);
                if (entry.isDirectory()) {
                    readFilesRecursively(fullPath);
                }
                else {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        sectionVirtualFileState.set(relativePath, content);
                    }
                    catch (error) {
                        console.warn(`Warning: Could not read file ${fullPath} for section README state`);
                    }
                }
            }
        };
        readFilesRecursively(sectionWorkingDir);
    }
    if (section.steps) {
        for (const step of section.steps) {
            if (step.text) {
                markdown += `${step.text}\n\n`;
            }
            if ((_a = step.dir) === null || _a === void 0 ? void 0 : _a.create) {
                markdown += `    mkdir -p ${step.dir.path}\n\n`;
            }
            if (step.file) {
                const srcAbsolutePath = path.resolve(projectRoot, step.file.src);
                const destRelativePath = path.normalize(step.file.dest);
                let newContent;
                try {
                    newContent = fs.readFileSync(srcAbsolutePath, 'utf8');
                }
                catch (error) {
                    console.warn(`Warning: Could not read source file ${srcAbsolutePath} for step: ${step.text || 'Unnamed step'}`);
                    continue;
                }
                const isExistingVirtualFile = sectionVirtualFileState.has(destRelativePath);
                const oldContent = isExistingVirtualFile ? sectionVirtualFileState.get(destRelativePath) : '';
                if (isExistingVirtualFile) {
                    // File is being changed/overwritten
                    const shouldDiff = ((_c = (_b = walkthroughTargets === null || walkthroughTargets === void 0 ? void 0 : walkthroughTargets[0]) === null || _b === void 0 ? void 0 : _b.onChange) === null || _c === void 0 ? void 0 : _c.diff) === true;
                    let diffPrintedThisStep = false;
                    if (shouldDiff && oldContent !== newContent) {
                        const diffOutput = formatMinimalDiff(destRelativePath, oldContent, newContent);
                        if (diffOutput) {
                            markdown += diffOutput;
                            diffPrintedThisStep = true;
                        }
                    }
                    const showCp = ((_e = (_d = walkthroughTargets === null || walkthroughTargets === void 0 ? void 0 : walkthroughTargets[0]) === null || _d === void 0 ? void 0 : _d.onChange) === null || _e === void 0 ? void 0 : _e.cp) !== false;
                    if (showCp) {
                        const cpCommand = `cp ${step.file.src} ${step.file.dest}`;
                        if (diffPrintedThisStep) {
                            markdown += `<details>\n<summary>skip this step</summary>\n\n`;
                            markdown += `    ${cpCommand}\n\n`;
                            markdown += `</details>\n\n`;
                        }
                        else {
                            markdown += `    ${cpCommand}\n\n`;
                            // Add "show file" details block
                            let lang = path.extname(step.file.src).substring(1);
                            if (lang === 'baml') {
                                lang = 'rust';
                            }
                            markdown += `<details>\n<summary>show file</summary>\n\n`;
                            markdown += `\`\`\`${lang}\n`;
                            markdown += `// ${step.file.src}\n`;
                            markdown += `${newContent.trim()}\n`;
                            markdown += `\`\`\`\n\n`;
                            markdown += `</details>\n\n`;
                        }
                    }
                }
                else {
                    // New file
                    const showCpForNew = ((_g = (_f = walkthroughTargets === null || walkthroughTargets === void 0 ? void 0 : walkthroughTargets[0]) === null || _f === void 0 ? void 0 : _f.newFiles) === null || _g === void 0 ? void 0 : _g.cp) !== false;
                    if (showCpForNew) {
                        const cpCommand = `cp ${step.file.src} ${step.file.dest}`;
                        markdown += `    ${cpCommand}\n\n`;
                        // Add "show file" details block
                        let lang = path.extname(step.file.src).substring(1);
                        if (lang === 'baml') {
                            lang = 'rust';
                        }
                        markdown += `<details>\n<summary>show file</summary>\n\n`;
                        markdown += `\`\`\`${lang}\n`;
                        markdown += `// ${step.file.src}\n`;
                        markdown += `${newContent.trim()}\n`;
                        markdown += `\`\`\`\n\n`;
                        markdown += `</details>\n\n`;
                    }
                }
                sectionVirtualFileState.set(destRelativePath, newContent);
            }
            if (step.command) {
                markdown += `    ${step.command.trim()}\n\n`;
            }
            if (step.results) {
                for (const result of step.results) {
                    markdown += `${result.text}\n\n`;
                    if (result.code) {
                        markdown += `    ${result.code.trim()}\n\n`;
                    }
                }
            }
        }
    }
    return markdown;
}
const cli = (argv) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(`
USAGE:
    walkthroughgen generate <yaml-file> [options]

OPTIONS:
    --help, -h    Show help
    generate <yaml-file>    Generate markdown from YAML file
        `);
        return;
    }
    if (argv[0] === "generate") {
        if (!argv[1]) {
            console.error("Error: YAML file path is required for 'generate' command.");
            console.log("Usage: walkthroughgen generate <yaml-file>");
            return;
        }
        const yamlPath = argv[1];
        let yamlContent;
        try {
            yamlContent = fs.readFileSync(yamlPath, 'utf8');
        }
        catch (error) {
            console.error(`Error: Could not read YAML file at '${yamlPath}'.`);
            console.error(error.message);
            return;
        }
        let data;
        try {
            data = yaml.load(yamlContent);
        }
        catch (error) {
            console.error(`Error: Could not parse YAML content from '${yamlPath}'.`);
            console.error(error.message);
            return;
        }
        if (!data || typeof data.title !== 'string' || typeof data.text !== 'string') {
            console.error(`Error: Invalid YAML structure in '${yamlPath}'. Missing required 'title' or 'text' fields.`);
            return;
        }
        // Track virtual file state for diff generation
        const projectRoot = path.dirname(yamlPath);
        const virtualFileState = new Map();
        // Process folders target first
        if (data.targets) {
            for (const target of data.targets) {
                // Ensure target.folders is an object with a path property
                if (target.folders && typeof target.folders === 'object' && target.folders.path) {
                    const currentFoldersTarget = target.folders; // Assign to a new const for type narrowing
                    const foldersBasePath = path.join(path.dirname(yamlPath), currentFoldersTarget.path);
                    console.log('Creating folders base path:', foldersBasePath);
                    fs.mkdirSync(foldersBasePath, { recursive: true });
                    // Create a temporary working directory to build up state
                    const workingDirName = `.tmp-working-${Date.now()}`;
                    const workingDir = path.join(foldersBasePath, workingDirName);
                    console.log('Creating working directory:', workingDir);
                    fs.mkdirSync(workingDir, { recursive: true });
                    try {
                        // Create section folders and build up working state
                        if (data.sections) {
                            let visibleSectionIndex = 0; // Counter for non-skipped sections
                            data.sections.forEach((section, originalIndex) => {
                                var _a;
                                const baseName = getSectionBaseName(section);
                                // For logging, use original index to be clear about which section from YAML it is
                                const logSectionIdentifier = `${String(originalIndex).padStart(2, '0')}-${baseName}`;
                                console.log('Processing section:', logSectionIdentifier, 'with name:', section.name);
                                const shouldSkip = (_a = currentFoldersTarget.skip) === null || _a === void 0 ? void 0 : _a.includes(section.name || '');
                                let sectionPathForApplySteps = null;
                                if (!shouldSkip) {
                                    // Use visibleSectionIndex for the actual folder name
                                    const sectionFolderName = `${String(visibleSectionIndex).padStart(2, '0')}-${baseName}`;
                                    const sectionPath = path.join(foldersBasePath, sectionFolderName);
                                    console.log('Creating section folder:', sectionPath);
                                    fs.mkdirSync(sectionPath, { recursive: true });
                                    // Copy current working state to section folder
                                    if (fs.existsSync(workingDir) && fs.readdirSync(workingDir).length > 0) {
                                        copyDirectory(workingDir, sectionPath);
                                    }
                                    // Generate and write section README
                                    const sectionMarkdown = generateRichSectionMarkdown(section, projectRoot, sectionPath, data.targets);
                                    fs.writeFileSync(path.join(sectionPath, 'README.md'), sectionMarkdown);
                                    sectionPathForApplySteps = sectionPath;
                                    visibleSectionIndex++; // Increment only for sections that get a folder
                                }
                                // Apply steps to working directory
                                applyStepsToWorkingDir(section.steps, projectRoot, workingDir, sectionPathForApplySteps);
                            });
                            // Create final directory if specified
                            if ((_a = currentFoldersTarget.final) === null || _a === void 0 ? void 0 : _a.dirName) {
                                const finalDirPath = path.join(foldersBasePath, currentFoldersTarget.final.dirName);
                                fs.mkdirSync(finalDirPath, { recursive: true });
                                copyDirectory(workingDir, finalDirPath);
                                // Optional: Generate cumulative README for final directory
                                const finalReadme = data.sections
                                    .filter(s => { var _a; return !((_a = currentFoldersTarget.skip) === null || _a === void 0 ? void 0 : _a.includes(s.name || '')); })
                                    .map(s => generateSectionMarkdown(s))
                                    .join('\n');
                                fs.writeFileSync(path.join(finalDirPath, 'README.md'), finalReadme);
                            }
                        }
                    }
                    finally {
                        // Clean up working directory
                        if (fs.existsSync(workingDir)) {
                            fs.rmSync(workingDir, { recursive: true, force: true });
                        }
                    }
                }
            }
        }
        let markdown = `# ${data.title}\n\n${data.text}\n\n`;
        if (data.sections) {
            for (const section of data.sections) {
                markdown += `## ${section.title}\n\n`;
                if (section.text) {
                    markdown += `${section.text}\n\n`;
                }
                if (section.steps) {
                    for (const step of section.steps) {
                        if (step.text) { // Only add step.text if it exists
                            markdown += `${step.text}\n\n`;
                        }
                        if (step.file) {
                            const srcAbsolutePath = path.resolve(projectRoot, step.file.src);
                            const destRelativePath = path.normalize(step.file.dest);
                            let newContent;
                            try {
                                newContent = fs.readFileSync(srcAbsolutePath, 'utf8');
                            }
                            catch (error) {
                                console.warn(`Warning: Could not read source file ${srcAbsolutePath} for step: ${step.text || 'Unnamed step'}`);
                                continue;
                            }
                            const isExistingVirtualFile = virtualFileState.has(destRelativePath);
                            const oldContent = isExistingVirtualFile ? virtualFileState.get(destRelativePath) : '';
                            if (isExistingVirtualFile) {
                                // File is being changed/overwritten
                                const shouldDiff = ((_d = (_c = (_b = data.targets) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.onChange) === null || _d === void 0 ? void 0 : _d.diff) === true;
                                let diffPrintedThisStep = false;
                                if (shouldDiff && oldContent !== newContent) {
                                    const diffOutput = formatMinimalDiff(destRelativePath, oldContent, newContent);
                                    if (diffOutput) {
                                        markdown += diffOutput;
                                        diffPrintedThisStep = true;
                                    }
                                }
                                const showCp = ((_g = (_f = (_e = data.targets) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.onChange) === null || _g === void 0 ? void 0 : _g.cp) !== false;
                                if (showCp) {
                                    const cpCommand = `cp ${step.file.src} ${step.file.dest}`;
                                    if (diffPrintedThisStep) {
                                        markdown += `<details>\n<summary>skip this step</summary>\n\n`;
                                        markdown += `    ${cpCommand}\n\n`;
                                        markdown += `</details>\n\n`;
                                    }
                                    else {
                                        markdown += `    ${cpCommand}\n\n`;
                                        // Add "show file" details block
                                        let lang = path.extname(step.file.src).substring(1);
                                        if (lang === 'baml') {
                                            lang = 'rust';
                                        }
                                        markdown += `<details>\n<summary>show file</summary>\n\n`;
                                        markdown += `\`\`\`${lang}\n`;
                                        markdown += `// ${step.file.src}\n`;
                                        markdown += `${newContent.trim()}\n`;
                                        markdown += `\`\`\`\n\n`;
                                        markdown += `</details>\n\n`;
                                    }
                                }
                            }
                            else {
                                // New file
                                const showCpForNew = ((_k = (_j = (_h = data.targets) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.newFiles) === null || _k === void 0 ? void 0 : _k.cp) !== false;
                                if (showCpForNew) {
                                    const cpCommand = `cp ${step.file.src} ${step.file.dest}`;
                                    markdown += `    ${cpCommand}\n\n`;
                                    // Add "show file" details block
                                    let lang = path.extname(step.file.src).substring(1);
                                    if (lang === 'baml') {
                                        lang = 'rust';
                                    }
                                    markdown += `<details>\n<summary>show file</summary>\n\n`;
                                    markdown += `\`\`\`${lang}\n`;
                                    markdown += `// ${step.file.src}\n`;
                                    markdown += `${newContent.trim()}\n`;
                                    markdown += `\`\`\`\n\n`;
                                    markdown += `</details>\n\n`;
                                }
                            }
                            virtualFileState.set(destRelativePath, newContent);
                        }
                        if (step.command) { // Always show commands in markdown
                            let commandLine = `    ${step.command.trim()}`;
                            markdown += commandLine;
                            markdown += "\n\n";
                        }
                        if (step.results) {
                            for (const result of step.results) {
                                markdown += `${result.text}\n\n`;
                                if (result.code) {
                                    let codeLine = `    ${result.code.trim()}`;
                                    markdown += codeLine;
                                    markdown += "\n\n";
                                }
                            }
                        }
                    }
                }
            }
        }
        const outputPath = ((_m = (_l = data.targets) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.markdown)
            ? path.join(path.dirname(yamlPath), data.targets[0].markdown)
            : path.join(path.dirname(yamlPath), 'walkthrough.md');
        try {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            fs.writeFileSync(outputPath, markdown);
            console.log(`Successfully generated walkthrough to ${outputPath}`);
        }
        catch (error) {
            console.error(`Error: Could not write markdown file to '${outputPath}'.`);
            console.error(error.message);
            return;
        }
        return;
    }
    console.log("Unknown command. Available commands: generate. Use --help for more info.");
};
exports.cli = cli;
