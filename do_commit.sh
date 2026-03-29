#!/bin/bash
set -e
cd /Users/abdeldjalilmaiza/IdeaProjects/AgentForge

# Stage the modified files
git add apps/api/src/ai-providers/ai-providers.controller.ts
git add apps/api/src/ai-providers/ai-providers.service.ts
git add apps/api/src/ai-providers/dto/create-ai-provider.dto.ts

# Show what's staged
git diff --cached --stat

# Commit
git commit -m "fix(ai-providers): read workspaceId from URL param, not request body

- Made workspaceId optional (@IsOptional) in CreateAiProviderDto
- Changed service create() to take workspaceId as explicit first param
- Controller now passes URL param workspaceId to service (not body)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "Commit done: $(git log --oneline -1)"
