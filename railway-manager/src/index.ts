#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth";
import { registerProjectCommands } from "./commands/projects";
import { registerServiceCommands } from "./commands/services";
import { registerDeploymentCommands } from "./commands/deployments";
import { registerVariableCommands } from "./commands/variables";
import { registerDomainCommands } from "./commands/domains";
import { registerEnvironmentCommands } from "./commands/environments";

const program = new Command();

program
  .name("rw")
  .description("Railway Account Manager — manage projects, services, deployments, variables, and domains via Railway GraphQL API")
  .version("1.0.0");

registerAuthCommands(program);
registerProjectCommands(program);
registerServiceCommands(program);
registerDeploymentCommands(program);
registerVariableCommands(program);
registerDomainCommands(program);
registerEnvironmentCommands(program);

program.parse();
