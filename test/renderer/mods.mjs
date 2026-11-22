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
        {input: [["DA[1,2,3,4]+NF"], 0], success: true, expected: { required_mods: [{acronym: "DA", settings: {'circle_size': 1, 'drain_rate': 2, 'overall_difficulty': 3, 'approach_rate': 4}}, {acronym: "NF"}], allowed_mods: [] }, name: "DA works with other mods"},
        {input: [["HR+HD[1,2]"], 0], success: false, expected: { }, name: "fails on invalid settings"},
        {input: [["DA[1,2]+NF"], 3], success: true, expected: { required_mods: [{acronym: "DA", settings: {'drain_rate': 1, 'overall_difficulty':2, }}, {acronym: "NF"}], allowed_mods: [] }, name: "Mania DA works"},
        {input: [["DA[1,2,3]+NF"], 1], success: true, expected: { required_mods: [{acronym: "DA", settings: {'drain_rate': 1, 'overall_difficulty': 2, "scroll_speed": 3}}, {acronym: "NF"}], allowed_mods: [] }, name: "Taiko DA works"},
        {input: [["DA[1,2,3,4,1]+NF"], 2], success: true, expected: { required_mods: [{acronym: "DA", settings: {'circle_size':1, 'drain_rate': 2, 'overall_difficulty':3, 'approach_rate': 4, 'hard_rock_offsets': 1 }}, {acronym: "NF"}], allowed_mods: [] }, name: "CTB DA works"},

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
