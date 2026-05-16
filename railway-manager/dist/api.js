"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gql = gql;
const node_fetch_1 = __importDefault(require("node-fetch"));
const config_1 = require("./config");
const RAILWAY_API = "https://backboard.railway.app/graphql/v2";
async function gql(query, variables = {}) {
    const token = (0, config_1.getToken)();
    if (!token) {
        throw new Error("No Railway API token configured. Run: rw auth login");
    }
    const res = await (0, node_fetch_1.default)(RAILWAY_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json());
    if (json.errors) {
        throw new Error(json.errors.map((e) => e.message).join("\n"));
    }
    return json.data;
}
