#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const auth_1 = require("./commands/auth");
const projects_1 = require("./commands/projects");
const services_1 = require("./commands/services");
const deployments_1 = require("./commands/deployments");
const variables_1 = require("./commands/variables");
const domains_1 = require("./commands/domains");
const environments_1 = require("./commands/environments");
const program = new commander_1.Command();
program
    .name("rw")
    .description("Railway Account Manager — manage projects, services, deployments, variables, and domains via Railway GraphQL API")
    .version("1.0.0");
(0, auth_1.registerAuthCommands)(program);
(0, projects_1.registerProjectCommands)(program);
(0, services_1.registerServiceCommands)(program);
(0, deployments_1.registerDeploymentCommands)(program);
(0, variables_1.registerVariableCommands)(program);
(0, domains_1.registerDomainCommands)(program);
(0, environments_1.registerEnvironmentCommands)(program);
program.parse();
