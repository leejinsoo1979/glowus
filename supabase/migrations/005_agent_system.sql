-- Agent System Tables
-- Multi-agent collaboration system for AI team members

-- Agent Status Enum
CREATE TYPE agent_status AS ENUM ('ACTIVE', 'INACTIVE', 'BUSY', 'ERROR');

-- Agent Message Type Enum
CREATE TYPE agent_message_type AS ENUM ('USER_TO_AGENT', 'AGENT_TO_USER', 'AGENT_TO_AGENT', 'SYSTEM');

-- Agent Task Status Enum
CREATE TYPE agent_task_status AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- Deployed Agents Table
CREATE TABLE IF NOT EXISTS deployed_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,

    -- Owner
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,

    -- Workflow definition (ReactFlow JSON)
    workflow_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    workflow_edges JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Agent capabilities
    capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Status
    status agent_status DEFAULT 'ACTIVE',
    last_active_at TIMESTAMPTZ,

    -- Avatar for chat
    avatar_url TEXT,

    -- Execution context
    system_prompt TEXT,
    model TEXT DEFAULT 'gpt-4',
    temperature DECIMAL DEFAULT 0.7,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Teams Table
CREATE TABLE IF NOT EXISTS agent_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,

    -- Owner
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Team Members Table
CREATE TABLE IF NOT EXISTS agent_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,

    -- Role in team
    role TEXT NOT NULL DEFAULT 'member',

    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(team_id, agent_id)
);

-- Agent Conversations Table
CREATE TABLE IF NOT EXISTS agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Participants
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

    -- Context
    title TEXT,
    startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Messages Table
CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Conversation tracking
    conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,

    -- Sender (either user or agent)
    sender_type TEXT NOT NULL CHECK (sender_type IN ('USER', 'AGENT')),
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,

    -- Receiver (either user or agent)
    receiver_type TEXT NOT NULL CHECK (receiver_type IN ('USER', 'AGENT')),
    receiver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    receiver_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,

    -- Message content
    message_type agent_message_type NOT NULL,
    content TEXT NOT NULL,

    -- Optional metadata (tool calls, function results, etc.)
    metadata JSONB,

    -- Optional task reference
    task_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints to ensure valid sender/receiver
    CONSTRAINT valid_sender CHECK (
        (sender_type = 'USER' AND sender_user_id IS NOT NULL) OR
        (sender_type = 'AGENT' AND sender_agent_id IS NOT NULL)
    ),
    CONSTRAINT valid_receiver CHECK (
        (receiver_type = 'USER' AND receiver_user_id IS NOT NULL) OR
        (receiver_type = 'AGENT' AND receiver_agent_id IS NOT NULL)
    )
);

-- Agent Tasks Table
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Task info
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,

    -- Assignment
    assigner_type TEXT NOT NULL CHECK (assigner_type IN ('USER', 'AGENT')),
    assigner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigner_agent_id UUID REFERENCES deployed_agents(id) ON DELETE SET NULL,
    assignee_agent_id UUID NOT NULL REFERENCES deployed_agents(id) ON DELETE CASCADE,

    -- Status
    status agent_task_status DEFAULT 'PENDING',

    -- Results
    result TEXT,
    error TEXT,

    -- Context
    conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
    startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,

    -- Time tracking
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint to ensure valid assigner
    CONSTRAINT valid_assigner CHECK (
        (assigner_type = 'USER' AND assigner_user_id IS NOT NULL) OR
        (assigner_type = 'AGENT' AND assigner_agent_id IS NOT NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_deployed_agents_owner ON deployed_agents(owner_id);
CREATE INDEX idx_deployed_agents_startup ON deployed_agents(startup_id);
CREATE INDEX idx_deployed_agents_status ON deployed_agents(status);

CREATE INDEX idx_agent_teams_owner ON agent_teams(owner_id);
CREATE INDEX idx_agent_team_members_team ON agent_team_members(team_id);
CREATE INDEX idx_agent_team_members_agent ON agent_team_members(agent_id);

CREATE INDEX idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_updated ON agent_conversations(updated_at DESC);

CREATE INDEX idx_agent_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX idx_agent_messages_created ON agent_messages(created_at);

CREATE INDEX idx_agent_tasks_assignee ON agent_tasks(assignee_agent_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_conversation ON agent_tasks(conversation_id);

-- RLS Policies
ALTER TABLE deployed_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

-- Deployed Agents Policies
CREATE POLICY "Users can view their own agents"
    ON deployed_agents FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create agents"
    ON deployed_agents FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own agents"
    ON deployed_agents FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own agents"
    ON deployed_agents FOR DELETE
    USING (auth.uid() = owner_id);

-- Agent Teams Policies
CREATE POLICY "Users can view their own teams"
    ON agent_teams FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create teams"
    ON agent_teams FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own teams"
    ON agent_teams FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own teams"
    ON agent_teams FOR DELETE
    USING (auth.uid() = owner_id);

-- Agent Team Members Policies
CREATE POLICY "Users can view team members of their teams"
    ON agent_team_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agent_teams
            WHERE agent_teams.id = team_id
            AND agent_teams.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage team members of their teams"
    ON agent_team_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agent_teams
            WHERE agent_teams.id = team_id
            AND agent_teams.owner_id = auth.uid()
        )
    );

-- Agent Conversations Policies
CREATE POLICY "Users can view their own conversations"
    ON agent_conversations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations"
    ON agent_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
    ON agent_conversations FOR UPDATE
    USING (auth.uid() = user_id);

-- Agent Messages Policies
CREATE POLICY "Users can view messages in their conversations"
    ON agent_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agent_conversations
            WHERE agent_conversations.id = conversation_id
            AND agent_conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages in their conversations"
    ON agent_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agent_conversations
            WHERE agent_conversations.id = conversation_id
            AND agent_conversations.user_id = auth.uid()
        )
    );

-- Agent Tasks Policies
CREATE POLICY "Users can view tasks assigned to their agents"
    ON agent_tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM deployed_agents
            WHERE deployed_agents.id = assignee_agent_id
            AND deployed_agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create tasks for their agents"
    ON agent_tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM deployed_agents
            WHERE deployed_agents.id = assignee_agent_id
            AND deployed_agents.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tasks for their agents"
    ON agent_tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM deployed_agents
            WHERE deployed_agents.id = assignee_agent_id
            AND deployed_agents.owner_id = auth.uid()
        )
    );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deployed_agents_updated_at
    BEFORE UPDATE ON deployed_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_teams_updated_at
    BEFORE UPDATE ON agent_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_conversations_updated_at
    BEFORE UPDATE ON agent_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_tasks_updated_at
    BEFORE UPDATE ON agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
