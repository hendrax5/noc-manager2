#!/usr/bin/env node
/**
 * Validate CHANGELOG.md against the project's Keep a Changelog + SemVer rules.
 * Run with: npm run changelog:check
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const changelogPath = process.env.CHANGELOG_FILE ? path.resolve(process.env.CHANGELOG_FILE) : path.join(root, 'CHANGELOG.md');
const packagePath = path.join(root, 'package.json');
const allowedSections = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const errors = [];
const today = new Date();

function fail(line, message) {
  errors.push(line ? `line ${line}: ${message}` : message);
}

if (!fs.existsSync(changelogPath)) {
  console.error('FAIL: CHANGELOG.md is missing.');
  process.exit(1);
}

const lines = fs.readFileSync(changelogPath, 'utf8').split(/\r?\n/);
const packageVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;

if (lines[0]?.trim() !== '# Changelog') fail(1, 'file must start with "# Changelog".');

const intro = lines.slice(0, 12).join('\n');
if (!/keepachangelog\.com/i.test(intro)) fail(0, 'intro must link to Keep a Changelog.');
if (!/semver\.org/i.test(intro)) fail(0, 'intro must link to Semantic Versioning.');

const releaseHeading = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})(?: \[YANKED\])?$/;
const sectionHeading = /^### (.+)$/;
const releases = [];
let current = null;
let currentSection = null;
let unreleasedSeen = false;

lines.forEach((line, index) => {
  const lineNumber = index + 1;

  if (/^## \[Unreleased\]$/.test(line)) {
    if (unreleasedSeen) fail(lineNumber, 'duplicate "## [Unreleased]".');
    unreleasedSeen = true;
    current = { version: 'Unreleased', line: lineNumber, sections: new Map(), items: 0 };
    releases.push(current);
    currentSection = null;
    return;
  }

  const release = line.match(releaseHeading);
  if (release) {
    const [, version, date] = release;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      fail(lineNumber, `invalid ISO date "${date}".`);
    } else if (parsed.getTime() > today.getTime() + 24 * 60 * 60 * 1000) {
      fail(lineNumber, `release date "${date}" is in the future.`);
    }
    current = { version, date, line: lineNumber, sections: new Map(), items: 0 };
    releases.push(current);
    currentSection = null;
    return;
  }

  if (/^## \[/.test(line)) {
    fail(lineNumber, 'release heading must look like "## [X.Y.Z] - YYYY-MM-DD".');
    current = null;
    currentSection = null;
    return;
  }

  const section = line.match(sectionHeading);
  if (section) {
    if (!current) fail(lineNumber, `section "### ${section[1]}" is outside a release.`);
    if (!allowedSections.includes(section[1])) {
      fail(lineNumber, `unknown section "${section[1]}"; use ${allowedSections.join(', ')}.`);
    }
    current?.sections.set(section[1], (current.sections.get(section[1]) || 0));
    currentSection = section[1];
    return;
  }

  if (/^- /.test(line)) {
    if (!current) fail(lineNumber, 'change item is outside a release.');
    else if (!currentSection) fail(lineNumber, 'change item is outside a category section.');
    else if (!line.slice(2).trim()) fail(lineNumber, 'change item is empty.');
    else {
      current.sections.set(currentSection, (current.sections.get(currentSection) || 0) + 1);
      current.items += 1;
    }
  }
});

if (!unreleasedSeen) fail(0, 'missing "## [Unreleased]" section.');

const released = releases.filter(release => release.version !== 'Unreleased');
if (!released.length) fail(0, 'no released versions found.');

for (const release of released) {
  if (!release.items) fail(release.line, `version ${release.version} has no change items.`);
  if (!release.sections.size) fail(release.line, `version ${release.version} has no category section.`);
}

const seen = new Set();
let previous = null;
for (const release of released) {
  if (seen.has(release.version)) fail(release.line, `duplicate version ${release.version}.`);
  seen.add(release.version);
  if (previous) {
    const currentParts = release.version.split('.').map(Number);
    const previousParts = previous.version.split('.').map(Number);
    const descending = previousParts[0] - currentParts[0] || previousParts[1] - currentParts[1] || previousParts[2] - currentParts[2];
    if (descending < 0) fail(release.line, `version ${release.version} must not be newer than ${previous.version} above it.`);
  }
  previous = release;
}

const newest = released[0];
if (newest && newest.version !== packageVersion) {
  fail(newest.line, `newest changelog version ${newest.version} does not match package.json ${packageVersion}.`);
}

const linkLines = lines.filter(line => /^\[[^\]]+\]:\s+\S+/.test(line));
const linked = new Set(linkLines.map(line => line.slice(1, line.indexOf(']'))));
for (const version of ['Unreleased', newest?.version].filter(Boolean)) {
  if (!linked.has(version)) fail(0, `missing link definition for [${version}].`);
}

if (errors.length) {
  console.error(`FAIL: CHANGELOG.md has ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`PASS: CHANGELOG.md is valid (${released.length} released versions, newest ${newest.version}, ${linked.size} links).`);
