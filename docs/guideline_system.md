# AI CUSTOMER SUPPORT SAAS — ARCHITECTURE REVIEW & SYSTEM DESIGN GUIDELINE

## Your Role

Act as a **Senior Software Architect, Staff Backend Engineer, and AI Systems Engineer** with extensive experience building scalable, production-ready SaaS platforms.

Your responsibility is to understand the existing project, evaluate its architecture, identify missing functionality, and recommend improvements based on real-world engineering practices.

Think critically. Do not blindly follow my assumptions.

If you identify a better architectural approach, explain why and recommend it.

**Important principles:**
- Do not make assumptions about the existing implementation.
- Do not modify existing code before understanding the current architecture.
- Do not introduce unnecessary complexity or overengineering.
- Prioritize scalability, maintainability, security, reliability, and performance.
- Follow the existing technology stack unless there is a strong technical reason to recommend changing it.
- Ask me questions whenever important business or technical requirements are unclear.
- Clearly distinguish between existing functionality, missing functionality, and proposed improvements.

---

# PART 1 — PRODUCT REQUIREMENTS & BUSINESS LOGIC

## 1. Product Overview

We are building a multi-tenant SaaS platform that provides AI-powered customer support through a live chat system.

The platform supports two operating modes:

1. **Human Support Mode:** Human customer support agents handle customer conversations, with AI acting as an assistant that reviews and improves their responses before sending them.
2. **AI Support Mode:** AI autonomously handles customer conversations and responds directly to customers based on each business's configured rules, policies, knowledge, and brand guidelines.

The system must ensure that every response follows the specific business's instructions and communication standards.

## 2. Human Support Mode — AI-Assisted Responses

When Human Support Mode is activated, human agents remain responsible for communicating with customers.

However, every response written by a human agent must pass through an AI processing layer before it can be sent to the customer.

### Expected Workflow

**Step 1 — Human writes a response**

A human support agent receives a customer message and writes a response.

**Step 2 — AI reviews the response**

Before the response is sent, it must be submitted to the AI model.

The AI model must have access to the relevant business context, including:

- Business rules.
- Company policies.
- Customer support guidelines.
- Brand voice and tone.
- Communication standards.
- Relevant knowledge base information.
- Any additional instructions configured by the business.

The AI must evaluate the agent's response and:

- Correct grammar and spelling.
- Improve sentence structure and clarity.
- Ensure a professional and appropriate tone.
- Align the response with the company's brand voice.
- Identify potential violations of business policies.
- Ensure the response does not contradict the business's instructions.
- Preserve the original meaning and intention of the human agent whenever possible.

**Step 3 — AI generates an improved response**

The AI returns a suggested response to the human agent.

The agent must have two options:

- Approve the AI-generated response.
- Edit the AI-generated response or provide a new version.

**Step 4 — Human approval**

If the agent approves the AI-generated response, the system sends that approved response to the customer.

If the agent edits the response, the edited version must go through the AI processing layer again.

**Step 5 — Repeat the review process**

The AI must review the newly edited response using the same business context and guidelines.

It then returns another suggested response to the agent.

This process continues until the human agent approves the final response.

**Critical requirement:**

No human-written or AI-improved response can be sent to the customer without explicit human approval while Human Support Mode is active.

### Additional Considerations

Evaluate and recommend how to handle:

- Multiple AI revision cycles.
- AI processing failures and timeouts.
- Invalid or policy-violating human responses.
- AI suggestions that change the original meaning.
- Concurrent agent edits.
- Agent disconnection during AI processing.
- Conversation state management.
- Message version history.
- Audit logs tracking original, revised, approved, and sent responses.
- Preventing duplicate message delivery.
- Ensuring that only authorized agents can approve and send messages.

Recommend appropriate safeguards without making the workflow unnecessarily complicated.

## 3. AI Support Mode — Autonomous AI Responses

When AI Support Mode is activated, the AI becomes responsible for handling customer conversations.

Human agents should not be required to approve individual AI responses.

### Expected Workflow

**Step 1 — Customer sends a message**

The customer sends a message through the live chat system.

**Step 2 — AI receives the conversation context**

The AI processing layer receives the necessary context, including:

- The customer's latest message.
- Relevant conversation history.
- Business rules.
- Company policies.
- Brand guidelines.
- Knowledge base information.
- Relevant customer information, when authorized.
- Additional business-specific instructions.

**Step 3 — AI generates a response**

The AI generates an answer that follows the configured business instructions.

**Step 4 — Response validation**

Evaluate whether an additional validation layer is needed to ensure that the AI response:

- Follows business policies.
- Does not invent information.
- Does not make unauthorized promises.
- Does not disclose sensitive information.
- Does not contradict previous conversation context.
- Follows the configured brand voice.

**Step 5 — Automatic delivery**

If the response passes the required validation, it is automatically sent to the customer.

### Additional Considerations

Analyze and recommend solutions for:

- Low-confidence AI responses.
- Questions outside the knowledge base.
- Sensitive customer requests.
- Refunds, cancellations, and other actions requiring authorization.
- Requests that require human intervention.
- AI hallucinations.
- AI provider failures.
- Response generation timeouts.
- Escalation to human support.
- Switching between Human Support Mode and AI Support Mode.
- Preserving conversation context during mode transitions.

### 4. Business-Level Configuration

The architecture must support multiple businesses using the SaaS platform.

Each business should be able to configure its own:

- Support operating mode.
- Business rules.
- Company policies.
- Brand voice and communication guidelines.
- Knowledge base.
- AI instructions.
- Escalation rules.

**Important:** Business-specific configurations and customer data must remain isolated between tenants.

Evaluate how these configurations should be stored, versioned, retrieved, cached, and passed to the AI processing layer.

---

# PART 2 — EXISTING PROJECT ANALYSIS

Before proposing architectural changes, thoroughly inspect the existing project.

Your first priority is understanding the current implementation.

## 1. Backend Investigation

Read the entire relevant backend folder.

Do not limit your investigation to the main entry points.

Inspect:

- Project structure.
- Application entry points.
- API routes and controllers.
- Services and business logic.
- Database models and schemas.
- Database migrations.
- Authentication and authorization.
- Middleware.
- Background jobs and workers.
- WebSocket or real-time communication implementation.
- AI integrations.
- External service integrations.
- Error handling.
- Logging.
- Configuration management.
- Existing tests.
- Existing architectural patterns.

Follow important execution paths across files to understand how the system actually works.

Do not assume that a feature is implemented simply because a corresponding file or function exists.

Verify whether it is connected to the actual application workflow.

## 2. Database Analysis

Understand the existing database schema in detail.

Identify:

- All relevant entities and relationships.
- Tenant/business isolation mechanisms.
- Users and agent relationships.
- Customer records.
- Conversations.
- Messages.
- Business configurations.
- AI-related data.
- Knowledge base structures.
- Permissions and roles.
- Existing indexes and constraints.

Evaluate whether the current schema supports the requirements described in PART 1.

Identify missing entities, relationships, indexes, constraints, and data structures.

Pay particular attention to conversation state, message lifecycle, AI processing state, approval workflows, and audit history.

Do not recommend database changes without explaining the problem they solve.

## 3. Existing Features vs. Required Features

Create a comparison between the existing implementation and the product requirements in PART 1.

Classify every relevant feature as:

- IMPLEMENTED: Fully implemented and connected to the actual workflow.
- PARTIALLY IMPLEMENTED: Some functionality exists, but important pieces are missing.
- NOT IMPLEMENTED: No implementation currently exists.
- NEEDS VERIFICATION: Insufficient evidence to determine implementation status.

For each feature, explain:

1. What currently exists.
2. Where it is implemented (file paths and relevant functions/classes).
3. What is missing.
4. What needs to change.
5. Whether the current implementation is architecturally suitable.

Do not modify the project during this investigation.

## 4. Architecture Assessment

Evaluate the current backend architecture against the expected requirements.

Pay particular attention to:

- Separation of concerns.
- Service boundaries.
- Database design.
- Multi-tenancy.
- AI processing architecture.
- Real-time messaging.
- Asynchronous processing.
- State management.
- Error handling.
- Security.
- Performance.
- Scalability.
- Maintainability.
- Testability.

Identify architectural weaknesses and explain their potential consequences in production.

---

# PART 3 — SYSTEM DESIGN PHILOSOPHY & SCALABILITY REVIEW

Read the PDF file:

**System_Design_Philosophy_Guide.pdf**

Extract the most valuable architectural principles, engineering patterns, and system design practices.

Do not simply summarize the document.

Understand the underlying principles and determine which ones are relevant to our SaaS platform.

## 1. Extract Relevant Engineering Principles

Identify the most useful concepts related to:

- Scalable backend architecture.
- Modular and maintainable systems.
- Database design and optimization.
- Distributed systems.
- Asynchronous processing.
- Message queues.
- Event-driven architecture.
- Caching strategies.
- Horizontal scaling.
- Fault tolerance.
- High availability.
- Observability.
- Security.
- Data consistency.
- API design.
- Infrastructure scalability.

Do not assume every pattern is necessary.

Explain when a particular pattern is useful, when it introduces unnecessary complexity, and whether it is appropriate for our current stage.

## 2. Simulate Future Production Requirements

Evaluate the architecture under increasing traffic and operational complexity.

Consider the following hypothetical growth stages:

**Stage 1 — Early Production**
- 100 businesses.
- 1,000 daily active customers.
- Moderate conversation volume.

**Stage 2 — Growing SaaS**
- 1,000 businesses.
- 50,000 daily active customers.
- Thousands of concurrent conversations.

**Stage 3 — Large-Scale SaaS**
- 10,000+ businesses.
- 500,000+ daily active customers.
- High concurrent messaging volume.
- Significant AI API usage.
- Large conversation and message databases.

These are hypothetical planning scenarios, not current production metrics.

For each stage, evaluate:

- Backend request load.
- Database performance.
- Concurrent WebSocket connections.
- Message delivery reliability.
- AI processing throughput.
- Queue capacity.
- Background worker scalability.
- Caching requirements.
- Infrastructure costs.
- Rate limiting.
- Tenant isolation.
- Monitoring and alerting.

Identify potential bottlenecks and explain when architectural changes become necessary.

Avoid recommending infrastructure simply because it is commonly used in large-scale systems.

Every recommendation must have a clear technical justification.

## 3. Compare the Current Project Against Production Best Practices

Compare three things:

1. Current project architecture.
2. Relevant principles extracted from System_Design_Philosophy_Guide.pdf.
3. Architecture requirements for a scalable production SaaS.

Identify:

- What the current architecture already does well.
- What should remain unchanged.
- What should be improved immediately.
- What should be improved before production.
- What can wait until traffic increases.
- What architectural decisions could become expensive to change later.

Clearly distinguish between essential improvements and optional optimizations.

---

# PART 4 — REQUIRED DELIVERABLE

After completing the investigation, create a Markdown file in the project root:

**ARCHITECTURE_REVIEW_AND_SCALABILITY_ROADMAP.md**

The document must contain the following sections:

1. Executive Summary.
2. Product Requirements Overview.
3. Existing System Architecture.
4. Current Backend Structure.
5. Database Schema Analysis.
6. Existing Features vs. Missing Requirements.
7. Human Support Mode — Architecture Requirements.
8. AI Support Mode — Architecture Requirements.
9. AI Processing and Validation Architecture.
10. Multi-Tenant Architecture Assessment.
11. System Design Philosophy — Extracted Principles.
12. Scalability Assessment.
13. Identified Bottlenecks and Technical Risks.
14. Security and Reliability Assessment.
15. Recommended Architecture Improvements.
16. Database Changes Required.
17. API and Service Changes Required.
18. Background Jobs and Queue Requirements.
19. Implementation Priority Roadmap.
20. Questions and Decisions Requiring Product Owner Input.

## Recommendations Must Be Actionable

For every proposed improvement, include:

- Problem identified.
- Current implementation.
- Recommended solution.
- Technical justification.
- Expected benefits.
- Potential drawbacks.
- Implementation complexity.
- Priority.
- Relevant file paths or components.

Use the following priority levels:

- P0: Critical — Required for correctness, security, or safe production operation.
- P1: High — Required for the intended product functionality or near-term scalability.
- P2: Medium — Important architectural improvement.
- P3: Low — Future optimization.

Where appropriate, organize implementation into phases:

- Phase 1: Core functionality and correctness.
- Phase 2: Production readiness.
- Phase 3: Scalability and performance.
- Phase 4: Advanced optimization.

Do not generate generic recommendations.

Every recommendation must be connected to an actual finding in the existing project or an explicitly identified future requirement.

---

# PART 5 — IMPORTANT WORKING RULES

## 1. Investigation Before Implementation

This task is initially an architecture investigation and documentation task.

Do not start implementing the proposed changes.

Do not refactor existing code.

Do not modify the database schema.

Do not introduce new dependencies.

Your only deliverable at this stage is the architecture review Markdown file.

## 2. Be Critical and Think Independently

I expect you to challenge my ideas when necessary.

If the proposed workflow has architectural weaknesses, identify them.

If a different approach would be more reliable, scalable, secure, or maintainable, recommend it.

Explain the trade-offs instead of presenting opinions as facts.

## 3. Avoid Overengineering

We are building a SaaS product that must scale, but we should not build unnecessary distributed infrastructure before we need it.

Prefer the simplest architecture that can safely support the expected workload while allowing future evolution.

For example, evaluate whether a modular monolith with asynchronous workers is more appropriate than introducing microservices immediately.

## 4. Evidence-Based Analysis

Every finding about the existing project must be supported by actual code, database schema, configuration, or documentation.

Include relevant file paths.

Never invent existing functionality or assume that an architectural feature exists without verifying it.

Clearly label assumptions and unknowns.

## 5. Ask Questions Before Making Critical Assumptions

If important details are missing, create a dedicated section in the Markdown report containing questions for me.

For each question, explain:

- What information is missing.
- Why it matters.
- Which architectural or product decision depends on it.
- Your recommended default approach, if applicable.

Do not block the entire investigation because of non-critical missing details.

However, if a missing detail could fundamentally change the architecture, ask me before finalizing that architectural decision.

## 6. Final Verification

Before finishing:

- Verify that the Markdown file has been created in the project root.
- Ensure all required sections are included.
- Ensure recommendations are specific and actionable.
- Ensure file paths actually exist.
- Ensure the report distinguishes existing functionality from proposed functionality.
- Ensure scalability recommendations are proportional to the expected workload.
- Ensure no existing source code or database schema was modified.

## FINAL EXPECTATION

I want a professional, evidence-based architectural assessment that helps us understand:

1. What we have already built.
2. What is missing to achieve the intended product functionality.
3. What architectural weaknesses exist.
4. What needs to be improved before production.
5. How to prepare the system for significant future growth.
6. Which architectural decisions we should make now to avoid expensive changes later.

Think like an engineer responsible for maintaining and scaling this SaaS platform for several years, not someone simply trying to finish a development task.

**Start with investigation. Finish with a detailed architecture report. Do not implement changes without my approval.**