import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {describe, it } from "node:test";

// utils.js loads mods.json at import time, so provide it from disk in Node.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, ...rest) => {
    const contents = await readFile(`src/renderer/${input}`, "utf8");
    return { json: async () => JSON.parse(contents) };
};

let handleModChange;
try {
    ({ handleModChange } = await import("../../src/renderer/modHandler.js"));
} finally {
    globalThis.fetch = originalFetch;
}

describe("handleModChange", () => {
    const testCases = [
        {input: [["NM"], 0], success: true, expected: { required_mods: [], allowed_mods: [] }, name: "returns empty for NM"},
        {input: [["DT[1.1]"], 0], success: true, expected: { required_mods: [{acronym: "DT", settings: {speed_change: 1.1}}], allowed_mods: [] }, name: "returns DT with rate change setting"},
        {input: [["ZZ"], 0], success: false, expected: { }, name: "fails on invalid mod"},
        {input: [["EZ"], 0], success: true, expected: { required_mods: [{acronym: "EZ"}], allowed_mods: [] }, name: "returns EZ with no settings"},
        {input: [["EZ", "DT"], 0], success: true, expected: { required_mods: [{acronym: "EZ"}, {acronym: "DT"}], allowed_mods: [] }, name: "returns EZDT with spaces"},
        {input: [["EZ+DT"], 0], success: true, expected: { required_mods: [{acronym: "EZ"}, {acronym: "DT"}], allowed_mods: [] }, name: "returns EZDT with \"+\" input"},


    ]
    for (const {input, expected, success, name } of testCases) {
        it(`${name}`, () => {
            let res = handleModChange(...input);
            assert.strictEqual(res.success, success);
            if (success) { // if we expect a return value too
                assert.deepStrictEqual(res.data, expected);
            }
        })
    }
});
