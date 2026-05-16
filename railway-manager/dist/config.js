"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToken = getToken;
exports.setToken = setToken;
exports.clearToken = clearToken;
exports.getConfig = getConfig;
const conf_1 = __importDefault(require("conf"));
const config = new conf_1.default({ projectName: "railway-manager" });
function getToken() {
    return config.get("token") || null;
}
function setToken(token) {
    config.set("token", token);
}
function clearToken() {
    config.delete("token");
}
function getConfig() {
    return config;
}
