-- ============================================================================
-- COMPLIANCE TRACKER APPLICATION - SUPABASE SCHEMA
-- ============================================================================
-- A task checklist application for managing compliance tasks by country/NACE
-- Data imported from compliance-rules repository

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. RULES & DEFINITIONS (imported from compliance-rules)
-- ============================================================================

-- Master rules table (one per country/NACE combination)
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country VARCHAR(2) NOT NULL,          -- ISO 3166-1 alpha-2 (IE, DE, etc.)
    nace VARCHAR(10) NOT NULL,            -- NN or NN.NN format
    version VARCHAR(50) NOT NULL,         -- Date or semver
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure unique country/nace combinations
    UNIQUE(country, nace)
);

-- Categories within a rule
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    category_id VARCHAR(100) NOT NULL,    -- From JSON (stable identifier)
    name VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 0,
    
    UNIQUE(rule_id, category_id)
);

-- Individual tasks within categories
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    
    -- Task identifiers (from JSON)
    task_id VARCHAR(100) NOT NULL,        -- Stable, kebab_or_snake
    title_key VARCHAR(255) NOT NULL,      -- i18n key (e.g., task.ie.vat.title)
    summary_key VARCHAR(255) NOT NULL,    -- i18n key for summary
    
    -- Task details
    law_ref TEXT,                         -- Optional legal citation
    regulator VARCHAR(255),               -- Regulatory body
    
    -- Frequency configuration
    frequency VARCHAR(50) NOT NULL,       -- one_time|weekly|monthly|quarterly|semiannual|annual|custom_rrule|continuous
    rrule TEXT,                           -- RFC 5545 RRULE if frequency=custom_rrule
    due_rule VARCHAR(255),                -- Rule for calculating due date (month=1,day=31, etc.)
    
    -- Due date handling
    weekend_policy VARCHAR(50),           -- none|previous_business_day|next_business_day|n/a
    
    -- Evidence
    evidence_required BOOLEAN DEFAULT FALSE,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(rule_id, task_id)
);

-- ============================================================================
-- 2. USER & ORGANIZATION
-- ============================================================================

-- Organizations/Tenants
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(2),                   -- Primary country
    nace VARCHAR(10),                     -- Business activity code
    billing_contact_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address TEXT,
    vat_number VARCHAR(100),
    purchase_order_ref VARCHAR(100),
    payment_method VARCHAR(50),           -- card|bank_transfer|invoice|other
    created_by UUID,                      -- Foreign key to users table (set after users table)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users (authenticated via Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY,                  -- Matches auth.users.id
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',    -- admin|manager|member
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key for organization.created_by
ALTER TABLE organizations ADD CONSTRAINT fk_org_creator
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. USER TASK INSTANCES & TRACKING
-- ============================================================================

-- User-specific task instances with calculated due dates
CREATE TABLE user_task_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Instance details
    instance_number INT DEFAULT 1,        -- For recurring tasks: 1st occurrence, 2nd, etc.
    cycle_id VARCHAR(50),                 -- Unique identifier for this cycle/occurrence
    
    -- Dates
    due_date DATE NOT NULL,               -- Calculated based on frequency + due_rule
    assigned_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- pending|completed|overdue|cancelled
    priority VARCHAR(50) DEFAULT 'normal',  -- low|normal|high|critical
    
    -- Tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one active instance per user per task (for one-time tasks)
    UNIQUE(user_id, task_id, cycle_id)
);

-- Task completions & evidence
CREATE TABLE task_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_task_instance_id UUID NOT NULL REFERENCES user_task_instances(id) ON DELETE CASCADE,
    
    -- Completion details
    completed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    completed_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    
    -- Evidence (if required)
    evidence_required BOOLEAN DEFAULT FALSE,
    evidence_submitted BOOLEAN DEFAULT FALSE,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Evidence attachments
CREATE TABLE evidence_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_completion_id UUID NOT NULL REFERENCES task_completions(id) ON DELETE CASCADE,
    
    -- File info
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,                         -- Size in bytes
    storage_path VARCHAR(255),             -- Path in Supabase Storage
    
    -- Metadata
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    
    -- Status
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP
);

-- ============================================================================
-- 4. ACTIVITY & AUDIT
-- ============================================================================

-- Activity log for audit trail
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    action VARCHAR(255) NOT NULL,         -- task_completed|task_assigned|evidence_uploaded, etc.
    entity_type VARCHAR(100),             -- task|user_task_instance|evidence_attachment
    entity_id UUID,
    
    details JSONB,                        -- Additional context
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Rules & definitions
CREATE INDEX idx_rules_country_nace ON rules(country, nace);
CREATE INDEX idx_categories_rule ON categories(rule_id);
CREATE INDEX idx_tasks_category ON tasks(category_id);
CREATE INDEX idx_tasks_rule ON tasks(rule_id);

-- Users & organizations
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- Task instances
CREATE INDEX idx_user_task_instances_user ON user_task_instances(user_id);
CREATE INDEX idx_user_task_instances_task ON user_task_instances(task_id);
CREATE INDEX idx_user_task_instances_org ON user_task_instances(organization_id);
CREATE INDEX idx_user_task_instances_due_date ON user_task_instances(due_date);
CREATE INDEX idx_user_task_instances_status ON user_task_instances(status);

-- Completions & evidence
CREATE INDEX idx_task_completions_instance ON task_completions(user_task_instance_id);
CREATE INDEX idx_evidence_attachments_completion ON evidence_attachments(task_completion_id);

-- Activity logs
CREATE INDEX idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own organization
CREATE POLICY "users_own_org" ON users
    FOR SELECT USING (
        auth.uid() = id OR 
        (SELECT organizations.id FROM organizations WHERE organizations.id = users.organization_id) IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

-- Users can see tasks for their organization
CREATE POLICY "tasks_visible_to_org_users" ON user_task_instances
    FOR SELECT USING (
        user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

-- Users can only complete their own tasks
CREATE POLICY "users_complete_own_tasks" ON task_completions
    FOR INSERT WITH CHECK (
        completed_by = auth.uid() AND
        user_task_instance_id IN (
            SELECT id FROM user_task_instances WHERE user_id = auth.uid()
        )
    );

-- Users can upload evidence for their tasks
CREATE POLICY "users_upload_own_evidence" ON evidence_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid() AND
        task_completion_id IN (
            SELECT tc.id FROM task_completions tc
            JOIN user_task_instances uti ON tc.user_task_instance_id = uti.id
            WHERE uti.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 7. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Dashboard: user's pending tasks
CREATE VIEW user_pending_tasks AS
SELECT
    uti.id,
    uti.user_id,
    uti.organization_id,
    t.task_id,
    t.title_key,
    t.summary_key,
    c.name as category_name,
    r.country,
    r.nace,
    uti.due_date,
    uti.status,
    uti.priority,
    t.evidence_required,
    CASE 
        WHEN uti.due_date < CURRENT_DATE AND uti.status = 'pending' THEN 'overdue'
        WHEN uti.due_date = CURRENT_DATE AND uti.status = 'pending' THEN 'due_today'
        WHEN uti.due_date > CURRENT_DATE AND uti.status = 'pending' THEN 'upcoming'
        ELSE uti.status
    END as display_status
FROM user_task_instances uti
JOIN tasks t ON uti.task_id = t.id
JOIN categories c ON t.category_id = c.id
JOIN rules r ON t.rule_id = r.id
WHERE uti.status IN ('pending', 'overdue');

-- Dashboard: organization compliance summary
CREATE VIEW org_compliance_summary AS
SELECT
    uti.organization_id,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN uti.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN uti.status = 'pending' AND uti.due_date >= CURRENT_DATE THEN 1 ELSE 0 END) as pending_tasks,
    SUM(CASE WHEN uti.status = 'pending' AND uti.due_date < CURRENT_DATE THEN 1 ELSE 0 END) as overdue_tasks,
    ROUND(100.0 * SUM(CASE WHEN uti.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as completion_percentage
FROM user_task_instances uti
GROUP BY uti.organization_id;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Import compliance-rules JSON files using import scripts
-- 2. Run Supabase migrations to apply this schema
-- 3. Configure Supabase Auth for user management
-- 4. Set up storage bucket for evidence attachments
-- 5. Implement due date calculation based on due_rule + frequency
