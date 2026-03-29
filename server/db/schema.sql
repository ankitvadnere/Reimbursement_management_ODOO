-- =============================================================
--  Reimbursement App — PostgreSQL Schema
--  Approval engine lives entirely in the database trigger.
-- =============================================================

-- ----------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()


-- ----------------------------------------------------------------
-- ENUM types
-- ----------------------------------------------------------------
CREATE TYPE user_role   AS ENUM ('employee', 'manager', 'finance', 'admin');
CREATE TYPE expense_status AS ENUM (
  'draft',
  'waiting_approval',
  'approved',
  'rejected'
);
CREATE TYPE approval_result AS ENUM ('approved', 'rejected');


-- ----------------------------------------------------------------
-- 1. COUNTRIES  (seeded from countries.json)
-- ----------------------------------------------------------------
CREATE TABLE countries (
  code        CHAR(2)      PRIMARY KEY,          -- ISO 3166-1 alpha-2
  name        VARCHAR(100) NOT NULL,
  currency    CHAR(3)      NOT NULL               -- ISO 4217
);


-- ----------------------------------------------------------------
-- 2. EXCHANGE RATES  (seeded from exchange_rates.json)
--    All rates are × → INR  (e.g. USD = 83.5)
-- ----------------------------------------------------------------
CREATE TABLE exchange_rates (
  currency    CHAR(3)        PRIMARY KEY,
  rate_to_inr NUMERIC(12, 4) NOT NULL,
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);


-- ----------------------------------------------------------------
-- 3. USERS
-- ----------------------------------------------------------------
CREATE TABLE users (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    TEXT         NOT NULL,              -- bcrypt hash
  role        user_role    NOT NULL DEFAULT 'employee',
  country     CHAR(2)      REFERENCES countries(code),
  manager_id  UUID         REFERENCES users(id),  -- NULL for top-level
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_email   ON users(email);


-- ----------------------------------------------------------------
-- 4. APPROVAL RULES
--    Defines who must approve based on amount threshold.
--    Rules are evaluated in order; first match wins.
-- ----------------------------------------------------------------
CREATE TABLE approval_rules (
  id              SERIAL       PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  min_amount_inr  NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_amount_inr  NUMERIC(14,2),                  -- NULL = no upper limit
  required_roles  user_role[]  NOT NULL,          -- e.g. {manager, finance}
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Default rules (inserted below in seed section)
-- Rule 1: 0–9999 → [manager]
-- Rule 2: 10000+ → [manager, finance]


-- ----------------------------------------------------------------
-- 5. EXPENSES
-- ----------------------------------------------------------------
CREATE TABLE expenses (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID            NOT NULL REFERENCES users(id),
  description         VARCHAR(255)    NOT NULL,
  category            VARCHAR(100)    NOT NULL,
  expense_date        DATE            NOT NULL,
  paid_by             VARCHAR(100)    NOT NULL,
  amount_original     NUMERIC(14, 2)  NOT NULL,
  currency            CHAR(3)         NOT NULL REFERENCES exchange_rates(currency),
  amount_inr          NUMERIC(14, 2)  NOT NULL,   -- converted at submit time
  remarks             TEXT,
  receipt_url         TEXT,                        -- path served by Flask
  receipt_is_pdf      BOOLEAN         NOT NULL DEFAULT FALSE,
  status              expense_status  NOT NULL DEFAULT 'draft',
  current_approver_id UUID            REFERENCES users(id),
  rule_id             INT             REFERENCES approval_rules(id),
  approval_step       INT             NOT NULL DEFAULT 0,  -- which step we're on
  submitted_at        TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_employee ON expenses(employee_id);
CREATE INDEX idx_expenses_approver ON expenses(current_approver_id);
CREATE INDEX idx_expenses_status   ON expenses(status);


-- ----------------------------------------------------------------
-- 6. APPROVAL ACTIONS  (audit log — every approve/reject recorded)
-- ----------------------------------------------------------------
CREATE TABLE approval_actions (
  id          SERIAL          PRIMARY KEY,
  expense_id  UUID            NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  approver_id UUID            NOT NULL REFERENCES users(id),
  action      approval_result NOT NULL,
  comment     TEXT,
  step        INT             NOT NULL,            -- which rule step this covers
  acted_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_actions_expense ON approval_actions(expense_id);


-- ================================================================
--  TRIGGER: process_approval
--
--  Fires AFTER INSERT on approval_actions.
--  Reads the rule attached to the expense, works out what
--  must happen next, and updates expenses accordingly.
--
--  Logic:
--    REJECT → status = 'rejected', current_approver_id = NULL,
--              approval_step reset, expense unlocked for edit
--    APPROVE at last step → status = 'approved', resolved_at = now()
--    APPROVE at non-last step → advance approval_step,
--              set current_approver_id to next role's holder
-- ================================================================
CREATE OR REPLACE FUNCTION fn_process_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense       expenses%ROWTYPE;
  v_rule          approval_rules%ROWTYPE;
  v_required_roles user_role[];
  v_next_role     user_role;
  v_next_approver UUID;
  v_total_steps   INT;
BEGIN
  -- Load the expense
  SELECT * INTO v_expense
  FROM expenses
  WHERE id = NEW.expense_id;

  -- If no rule attached (draft/manual), do nothing
  IF v_expense.rule_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Load the matching rule
  SELECT * INTO v_rule
  FROM approval_rules
  WHERE id = v_expense.rule_id;

  v_required_roles := v_rule.required_roles;
  v_total_steps    := array_length(v_required_roles, 1);

  -- ── REJECTION ────────────────────────────────────────────────
  IF NEW.action = 'rejected' THEN
    UPDATE expenses SET
      status              = 'rejected',
      current_approver_id = NULL,
      approval_step       = 0,
      updated_at          = now()
    WHERE id = NEW.expense_id;

    RETURN NEW;
  END IF;

  -- ── APPROVAL ─────────────────────────────────────────────────
  IF NEW.action = 'approved' THEN

    -- Was this the final required step?
    IF v_expense.approval_step >= v_total_steps THEN
      -- All steps done → fully approved
      UPDATE expenses SET
        status              = 'approved',
        current_approver_id = NULL,
        resolved_at         = now(),
        updated_at          = now()
      WHERE id = NEW.expense_id;

    ELSE
      -- Advance to next step
      v_next_role := v_required_roles[v_expense.approval_step + 1];

      -- Find a user with the next required role.
      -- For 'manager' role: use the employee's manager.
      -- For 'finance' / 'admin': pick any active user with that role.
      IF v_next_role = 'manager' THEN
        SELECT manager_id INTO v_next_approver
        FROM users
        WHERE id = v_expense.employee_id;
      ELSE
        SELECT id INTO v_next_approver
        FROM users
        WHERE role = v_next_role
        ORDER BY created_at   -- deterministic pick (first created)
        LIMIT 1;
      END IF;

      UPDATE expenses SET
        approval_step       = v_expense.approval_step + 1,
        current_approver_id = v_next_approver,
        updated_at          = now()
      WHERE id = NEW.expense_id;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_approval
AFTER INSERT ON approval_actions
FOR EACH ROW
EXECUTE FUNCTION fn_process_approval();


-- ================================================================
--  TRIGGER: set_approval_rule_on_submit
--
--  Fires BEFORE UPDATE on expenses when status changes to
--  'waiting_approval'.  Picks the correct rule based on
--  amount_inr, sets rule_id, approval_step = 1, and assigns
--  the first approver.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_set_rule_on_submit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule          approval_rules%ROWTYPE;
  v_first_role    user_role;
  v_first_approver UUID;
BEGIN
  -- Only fire when transitioning into waiting_approval
  IF NEW.status <> 'waiting_approval' OR OLD.status = 'waiting_approval' THEN
    RETURN NEW;
  END IF;

  -- Match the first applicable rule (order by min_amount_inr DESC so
  -- the most specific / highest threshold wins first)
  SELECT * INTO v_rule
  FROM approval_rules
  WHERE NEW.amount_inr >= min_amount_inr
    AND (max_amount_inr IS NULL OR NEW.amount_inr <= max_amount_inr)
  ORDER BY min_amount_inr DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;   -- no rule matched, leave as-is
  END IF;

  v_first_role := v_rule.required_roles[1];

  IF v_first_role = 'manager' THEN
    SELECT manager_id INTO v_first_approver
    FROM users WHERE id = NEW.employee_id;
  ELSE
    SELECT id INTO v_first_approver
    FROM users WHERE role = v_first_role
    ORDER BY created_at LIMIT 1;
  END IF;

  NEW.rule_id             := v_rule.id;
  NEW.approval_step       := 1;
  NEW.current_approver_id := v_first_approver;
  NEW.submitted_at        := now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_rule_on_submit
BEFORE UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION fn_set_rule_on_submit();


-- ================================================================
--  TRIGGER: updated_at auto-maintenance
-- ================================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ================================================================
--  SEED DATA
-- ================================================================

-- Default approval rules
INSERT INTO approval_rules (name, min_amount_inr, max_amount_inr, required_roles) VALUES
  ('Standard',    0,      9999.99, ARRAY['manager']::user_role[]),
  ('High-value',  10000,  NULL,    ARRAY['manager', 'finance']::user_role[]);

-- Exchange rates (INR base)
INSERT INTO exchange_rates (currency, rate_to_inr) VALUES
  ('INR', 1.0),
  ('USD', 83.5),
  ('EUR', 90.2),
  ('GBP', 105.8),
  ('AED', 22.7),
  ('SGD', 61.9),
  ('JPY', 0.56),
  ('AUD', 54.3),
  ('CAD', 61.5)
ON CONFLICT (currency) DO UPDATE SET rate_to_inr = EXCLUDED.rate_to_inr;

-- Countries
INSERT INTO countries (code, name, currency) VALUES
  ('IN', 'India',          'INR'),
  ('US', 'United States',  'USD'),
  ('GB', 'United Kingdom', 'GBP'),
  ('DE', 'Germany',        'EUR'),
  ('FR', 'France',         'EUR'),
  ('AE', 'UAE',            'AED'),
  ('SG', 'Singapore',      'SGD'),
  ('JP', 'Japan',          'JPY'),
  ('AU', 'Australia',      'AUD'),
  ('CA', 'Canada',         'CAD')
ON CONFLICT (code) DO NOTHING;