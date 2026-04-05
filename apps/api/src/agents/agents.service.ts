import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Agent, AgentVersion } from '@prisma/client';
import type { CreateAgentInput, UpdateAgentInput } from '@agentforge/shared';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    workspaceId: string,
    take = 25,
    cursor?: string,
  ): Promise<{ items: Agent[]; nextCursor: string | null }> {
    const items = await this.prisma.agent.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    let nextCursor: string | null = null;
    if (items.length > take) {
      nextCursor = items[take]!.id;
      items.pop();
    }
    return { items, nextCursor };
  }

  async findOne(id: string, workspaceId: string): Promise<Agent & { versions: AgentVersion[] }> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async create(workspaceId: string, data: CreateAgentInput, userId: string): Promise<Agent> {
    return this.prisma.agent.create({
      data: {
        workspaceId,
        name: data.name,
        status: 'draft',
        createdBy: userId,
        ...(data.description !== undefined && { description: data.description }),
      },
    });
  }

  async update(
    id: string,
    workspaceId: string,
    data: UpdateAgentInput,
    _userId: string,
  ): Promise<Agent> {
    const agent = await this.prisma.agent.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!agent) throw new NotFoundException('Agent not found');
    return this.prisma.agent.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    const agent = await this.prisma.agent.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!agent) throw new NotFoundException('Agent not found');
    await this.prisma.agent.delete({ where: { id } });
  }

  async getVersions(id: string, workspaceId: string): Promise<AgentVersion[]> {
    const agent = await this.prisma.agent.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!agent) throw new NotFoundException('Agent not found');
    return this.prisma.agentVersion.findMany({
      where: { agentId: id },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async saveWorkflow(
    id: string,
    workspaceId: string,
    workflow: Record<string, unknown>,
    userId: string,
  ): Promise<AgentVersion> {
    const agent = await this.prisma.agent.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!agent) throw new NotFoundException('Agent not found');

    const last = await this.prisma.agentVersion.findFirst({
      where: { agentId: id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersion = (last?.versionNumber ?? 0) + 1;
    const versionLabel = `v${nextVersion}.0.0`;

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.agentVersion.create({
        data: {
          agentId: id,
          versionNumber: nextVersion,
          workflowDefinition: workflow as Parameters<
            typeof tx.agentVersion.create
          >[0]['data']['workflowDefinition'],
          createdBy: userId,
        },
      });
      await tx.agent.update({
        where: { id },
        data: { currentVersion: versionLabel },
      });
      return version;
    });
  }

  async testRun(
    id: string,
    workspaceId: string,
    inputs: Record<string, unknown>,
  ): Promise<{ trace: unknown[]; output: unknown }> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    if (!agent.versions.length) {
      return { trace: [], output: null };
    }

    const workflow = agent.versions[0]!.workflowDefinition as {
      nodes: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
      edges: Array<{ source: string; target: string }>;
    };

    const trace: unknown[] = [];
    const nodeOutputs: Record<string, unknown> = { ...inputs };

    // Walk nodes in topological order (simple linear pass for now)
    const visited = new Set<string>();
    const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));
    const edgeMap = new Map<string, string[]>();
    for (const edge of workflow.edges) {
      if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
      edgeMap.get(edge.source)!.push(edge.target);
    }

    // Find start node
    const incomingEdges = new Set(workflow.edges.map((e) => e.target));
    const startNodes = workflow.nodes.filter((n) => !incomingEdges.has(n.id));

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = nodeMap.get(nodeId);
      if (!node) return;

      const step: Record<string, unknown> = { nodeId, type: node.type, status: 'executed' };

      if (node.type === 'output') {
        const key = (node.data?.outputKey as string) ?? 'output';
        step['output'] = nodeOutputs[key] ?? null;
      } else if (node.type === 'condition') {
        step['result'] = 'condition evaluation skipped in test-run';
      } else {
        step['result'] = nodeOutputs;
      }

      trace.push(step);
      for (const next of edgeMap.get(nodeId) ?? []) {
        visit(next);
      }
    };

    for (const start of startNodes) {
      visit(start.id);
    }

    const outputNode = workflow.nodes.find((n) => n.type === 'output');
    const finalOutput = outputNode
      ? (nodeOutputs[(outputNode.data?.outputKey as string) ?? 'output'] ?? null)
      : nodeOutputs;

    return { trace, output: finalOutput };
  }
}
