import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { gql, getToken } from "./railway";

export function useRailway(key: string[], query: string, variables: Record<string, any> = {}, enabled = true) {
  const [token, setToken] = useState("");
  useEffect(() => { setToken(getToken() || ""); }, []);
  return useQuery({
    queryKey: key,
    queryFn: () => gql(token, query, variables),
    enabled: enabled && !!token,
  });
}

export function useWorkspaces() {
  return useRailway(["workspaces"], `query { me { workspaces { id name } } }`);
}

export function useProjects() {
  const { data: wsData } = useWorkspaces();
  const wsId = wsData?.me?.workspaces?.[0]?.id;
  return useRailway(
    ["projects", wsId || ""],
    `query($id: String!) { workspace(workspaceId: $id) { projects { edges { node { id name createdAt services { edges { node { id name } } } environments { edges { node { id name } } } } } } } }`,
    { id: wsId },
    !!wsId
  );
}

export function useProject(id: string) {
  return useRailway(
    ["project", id],
    `query($id: String!) { project(id: $id) { id name createdAt services { edges { node { id name } } } environments { edges { node { id name } } } } }`,
    { id },
    !!id
  );
}

export function useServiceInstance(serviceId: string, envId: string) {
  return useRailway(
    ["serviceInstance", serviceId, envId],
    `query($sid: String!, $eid: String!) { serviceInstance(serviceId: $sid, environmentId: $eid) { serviceName startCommand buildCommand rootDirectory healthcheckPath region numReplicas restartPolicyType restartPolicyMaxRetries cronSchedule dockerfilePath sleepApplication activeDeployments { id status createdAt } latestDeployment { id status createdAt } } }`,
    { sid: serviceId, eid: envId },
    !!serviceId && !!envId
  );
}

export function useDeployments(projectId: string, serviceId: string, envId: string) {
  return useRailway(
    ["deployments", serviceId, envId],
    `query($input: DeploymentListInput!, $first: Int) { deployments(input: $input, first: $first) { edges { node { id status createdAt url } } } }`,
    { input: { projectId, serviceId, environmentId: envId }, first: 20 },
    !!projectId && !!serviceId && !!envId
  );
}

export function useVariables(projectId: string, serviceId: string, envId: string) {
  return useRailway(
    ["variables", serviceId, envId],
    `query($p: String!, $s: String!, $e: String!) { variables(projectId: $p, serviceId: $s, environmentId: $e) }`,
    { p: projectId, s: serviceId, e: envId },
    !!projectId && !!serviceId && !!envId
  );
}

export function useDomains(projectId: string, serviceId: string, envId: string) {
  return useRailway(
    ["domains", serviceId, envId],
    `query($p: String!, $s: String!, $e: String!) { domains(projectId: $p, serviceId: $s, environmentId: $e) { serviceDomains { id domain } customDomains { id domain } } }`,
    { p: projectId, s: serviceId, e: envId },
    !!projectId && !!serviceId && !!envId
  );
}

export function useServiceLimits(serviceId: string, envId: string) {
  return useRailway(
    ["limits", serviceId, envId],
    `query($sid: String!, $eid: String!) { serviceInstanceLimits(serviceId: $sid, environmentId: $eid) }`,
    { sid: serviceId, eid: envId },
    !!serviceId && !!envId
  );
}

export function useProjectUsage(wsId: string, projectId: string) {
  return useRailway(
    ["usage", projectId],
    `query($id: String!, $pid: String!) { usage(workspaceId: $id, projectId: $pid, measurements: [CPU_USAGE, MEMORY_USAGE_GB, DISK_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB], groupBy: [SERVICE_ID]) { measurement tags { serviceId } value } }`,
    { id: wsId, pid: projectId },
    !!wsId && !!projectId
  );
}

export function useBilling(wsId: string) {
  return useRailway(
    ["billing", wsId],
    `query($id: String!) { workspace(workspaceId: $id) { plan subscriptionPlanLimit customer { currentUsage billingPeriod { start end } usageLimit { hardLimit softLimit } creditBalance } } }`,
    { id: wsId },
    !!wsId
  );
}
