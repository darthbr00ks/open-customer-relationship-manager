"""Initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    entity_type_enum = sa.Enum(
        "company", "nonprofit", "government", "education", "association", "household", "other",
        name="entity_type_enum",
    )
    relationship_stage_enum = sa.Enum(
        "prospect", "customer", "partner", "former_customer", "inactive",
        name="relationship_stage_enum",
    )
    relationship_type_enum = sa.Enum(
        "employee", "owner", "advisor", "board_member", "volunteer",
        "contractor", "customer_contact", "other",
        name="relationship_type_enum",
    )
    affiliation_status_enum = sa.Enum(
        "current", "former", name="affiliation_status_enum"
    )
    deal_stage_enum = sa.Enum(
        "qualification", "discovery", "proposal", "negotiation", "won", "lost",
        name="deal_stage_enum",
    )
    case_status_enum = sa.Enum(
        "new", "open", "pending", "resolved", "closed", name="case_status_enum"
    )
    case_priority_enum = sa.Enum(
        "low", "medium", "high", "urgent", name="case_priority_enum"
    )
    case_source_enum = sa.Enum(
        "email", "phone", "web", "internal", "integration", "other",
        name="case_source_enum",
    )
    incident_status_enum = sa.Enum(
        "investigating", "identified", "monitoring", "resolved", "closed",
        name="incident_status_enum",
    )
    incident_severity_enum = sa.Enum(
        "low", "medium", "high", "critical", name="incident_severity_enum"
    )
    impact_level_enum = sa.Enum(
        "minor", "moderate", "major", "critical", name="impact_level_enum"
    )
    request_status_enum = sa.Enum(
        "submitted", "under_review", "planned", "in_progress", "completed", "declined",
        name="request_status_enum",
    )
    request_priority_enum = sa.Enum(
        "low", "medium", "high", name="request_priority_enum"
    )

    # entity
    op.create_table(
        "entity",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("legal_name", sa.String(255), nullable=True),
        sa.Column("entity_type", entity_type_enum, nullable=False),
        sa.Column("relationship_stage", relationship_stage_enum, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("website_url", sa.String(2048), nullable=True),
        sa.Column("primary_domain", sa.String(255), nullable=True),
        sa.Column("primary_email", sa.String(320), nullable=True),
        sa.Column("primary_phone", sa.String(50), nullable=True),
        sa.Column("address_line_1", sa.String(255), nullable=True),
        sa.Column("address_line_2", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("postal_code", sa.String(20), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_entity_workspace_name", "entity", ["workspace_id", "name"])
    op.create_index("ix_entity_workspace_stage", "entity", ["workspace_id", "relationship_stage"])
    op.create_index("ix_entity_workspace_domain", "entity", ["workspace_id", "primary_domain"])
    op.create_index("ix_entity_workspace_id", "entity", ["workspace_id"])
    op.create_index("ix_entity_owner_user_id", "entity", ["owner_user_id"])

    # person
    op.create_table(
        "person",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("preferred_name", sa.String(100), nullable=True),
        sa.Column("primary_email", sa.String(320), nullable=True),
        sa.Column("primary_phone", sa.String(50), nullable=True),
        sa.Column("linkedin_url", sa.String(2048), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_person_workspace_last_name", "person", ["workspace_id", "last_name"])
    op.create_index("ix_person_workspace_email", "person", ["workspace_id", "primary_email"])
    op.create_index("ix_person_workspace_id", "person", ["workspace_id"])

    # entity_person
    op.create_table(
        "entity_person",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("entity.id"), nullable=False),
        sa.Column("person_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("person.id"), nullable=False),
        sa.Column("relationship_type", relationship_type_enum, nullable=False),
        sa.Column("job_title", sa.String(255), nullable=True),
        sa.Column("department", sa.String(255), nullable=True),
        sa.Column("is_primary_contact", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("status", affiliation_status_enum, nullable=False),
        sa.Column("started_on", sa.Date, nullable=True),
        sa.Column("ended_on", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("workspace_id", "entity_id", "person_id", name="uq_entity_person"),
    )
    op.create_index("ix_entity_person_workspace", "entity_person", ["workspace_id"])

    # deal
    op.create_table(
        "deal",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("entity.id"), nullable=False),
        sa.Column("primary_contact_person_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("person.id"), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("stage", deal_stage_enum, nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("probability", sa.Integer, nullable=True),
        sa.Column("expected_close_date", sa.Date, nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_step", sa.Text, nullable=True),
        sa.Column("lost_reason", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_deal_workspace_entity", "deal", ["workspace_id", "entity_id"])
    op.create_index("ix_deal_workspace_stage", "deal", ["workspace_id", "stage"])
    op.create_index("ix_deal_workspace_owner", "deal", ["workspace_id", "owner_user_id"])
    op.create_index("ix_deal_expected_close_date", "deal", ["workspace_id", "expected_close_date"])

    # case
    op.create_table(
        "case",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("case_number", sa.String(50), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("entity.id"), nullable=True),
        sa.Column("reported_by_person_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("person.id"), nullable=True),
        sa.Column("status", case_status_enum, nullable=False),
        sa.Column("priority", case_priority_enum, nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("source", case_source_enum, nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution", sa.Text, nullable=True),
        sa.UniqueConstraint("workspace_id", "case_number", name="uq_case_number"),
    )
    op.create_index("ix_case_workspace_status", "case", ["workspace_id", "status"])
    op.create_index("ix_case_workspace_priority", "case", ["workspace_id", "priority"])
    op.create_index("ix_case_workspace_owner", "case", ["workspace_id", "owner_user_id"])

    # incident
    op.create_table(
        "incident",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("incident_number", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", incident_status_enum, nullable=False),
        sa.Column("severity", incident_severity_enum, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("identified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("root_cause", sa.Text, nullable=True),
        sa.Column("resolution", sa.Text, nullable=True),
        sa.Column("internal_notes", sa.Text, nullable=True),
        sa.Column("public_update", sa.Text, nullable=True),
        sa.UniqueConstraint("workspace_id", "incident_number", name="uq_incident_number"),
    )
    op.create_index("ix_incident_workspace_status", "incident", ["workspace_id", "status"])
    op.create_index("ix_incident_workspace_severity", "incident", ["workspace_id", "severity"])

    # incident_case
    op.create_table(
        "incident_case",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("incident_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("incident.id"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("entity.id"), nullable=False),
        sa.Column("impact_level", impact_level_enum, nullable=True),
        sa.Column("impact_description", sa.Text, nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("unlinked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.UniqueConstraint("incident_id", "case_id", name="uq_incident_case"),
    )
    op.create_index("ix_incident_case_workspace", "incident_case", ["workspace_id"])
    op.create_index("ix_incident_case_entity", "incident_case", ["workspace_id", "entity_id"])

    # request
    op.create_table(
        "request",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("request_number", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("entity.id"), nullable=True),
        sa.Column("requested_by_person_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("person.id"), nullable=True),
        sa.Column("status", request_status_enum, nullable=False),
        sa.Column("priority", request_priority_enum, nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("business_need", sa.Text, nullable=True),
        sa.Column("decision_notes", sa.Text, nullable=True),
        sa.Column("target_date", sa.Date, nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("workspace_id", "request_number", name="uq_request_number"),
    )
    op.create_index("ix_request_workspace_status", "request", ["workspace_id", "status"])
    op.create_index("ix_request_workspace_priority", "request", ["workspace_id", "priority"])
    op.create_index("ix_request_workspace_owner", "request", ["workspace_id", "owner_user_id"])


def downgrade() -> None:
    op.drop_table("incident_case")
    op.drop_table("request")
    op.drop_table("incident")
    op.drop_table("case")
    op.drop_table("deal")
    op.drop_table("entity_person")
    op.drop_table("person")
    op.drop_table("entity")
    # Drop enums
    for name in [
        "entity_type_enum", "relationship_stage_enum", "relationship_type_enum",
        "affiliation_status_enum", "deal_stage_enum", "case_status_enum",
        "case_priority_enum", "case_source_enum", "incident_status_enum",
        "incident_severity_enum", "impact_level_enum", "request_status_enum",
        "request_priority_enum",
    ]:
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
