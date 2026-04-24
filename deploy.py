#!/usr/bin/env python3
"""
Deploy AI Executive Team advisors to Claude Managed Agents.

Usage:
    python ai-native/deploy.py deploy          # Create/update all agents + environment
    python ai-native/deploy.py list            # List existing agents
    python ai-native/deploy.py test            # Run a quick test session
    python ai-native/deploy.py cleanup         # Archive all agents and environment

Requires:
    pip install anthropic
    ANTHROPIC_API_KEY env var (or pass --api-key)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("Error: anthropic package not installed. Run: pip install anthropic")
    sys.exit(1)

ROOT_DIR = Path(__file__).parent
STATE_FILE = ROOT_DIR / ".deploy-state.json"
ENV_FILE = ROOT_DIR / ".env"


def load_dotenv():
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key.strip(), value)

MCP_SERVERS = {
    "notion": {
        "type": "url",
        "name": "notion",
        "url": "https://mcp.notion.com/mcp",
    },
    "slack": {
        "type": "url",
        "name": "slack",
        "url": "https://mcp.slack.com/mcp",
    },
}

# MCP servers require OAuth vault credentials to be configured.
# Set to True once vaults are set up in the Claude Console.
MCP_ENABLED = os.environ.get("COACH_MCP_ENABLED", "false").lower() == "true"

COACH_CONFIGS = [
    {
        "name": "QA Judge",
        "dir": "qa-judge",
        "model": "claude-sonnet-4-6",
        "description": "Critical evaluator of AI research quality. Detects GEO manipulation, verifies source credibility, validates reasoning chains.",
        "mcp": [],
        "skills": [],
    },
    {
        "name": "Technology Advisor",
        "dir": "technology",
        "model": "claude-sonnet-4-6",
        "description": "Senior technology advisor for architecture, AI/ML systems, developer experience, security, and cost engineering.",
        "callable": ["qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [],
    },
    {
        "name": "Founder Advisor",
        "dir": "founder",
        "model": "claude-sonnet-4-6",
        "description": "Advisor for founder personal goals, vision alignment, and executive focus.",
        "callable": ["qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [],
    },
    {
        "name": "Strategy Advisor",
        "dir": "strategy",
        "model": "claude-sonnet-4-6",
        "description": "Business strategy advisor for market positioning, competitive analysis, KPIs/OKRs, and strategic planning.",
        "callable": ["qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [],
    },
    {
        "name": "Funding Advisor",
        "dir": "funding",
        "model": "claude-sonnet-4-6",
        "description": "Capital strategy advisor covering VC, angel, bootstrapping, debt, grants, and cap table management.",
        "callable": ["qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [{"type": "anthropic", "skill_id": "xlsx"}],
    },
    {
        "name": "Finance Advisor",
        "dir": "finance",
        "model": "claude-sonnet-4-6",
        "description": "Financial operations advisor for accounting systems, tax compliance, FP&A, risk management, and regulatory compliance.",
        "callable": ["qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [{"type": "anthropic", "skill_id": "xlsx"}],
    },
    {
        "name": "Legal Advisor",
        "dir": "legal",
        "model": "claude-sonnet-4-6",
        "description": "Legal strategy advisor for corporate structure, contracts, IP, employment law, and regulatory compliance.",
        "callable": ["qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [],
    },
    {
        "name": "Growth Advisor",
        "dir": "growth",
        "model": "claude-sonnet-4-6",
        "description": "Growth strategy advisor for GTM, sales, marketing, PLG, metrics, and customer retention.",
        "callable": ["qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [],
    },
    {
        "name": "Chief of Staff",
        "dir": "ea",
        "model": "claude-sonnet-4-6",
        "description": "Executive assistant and chief of staff. Orchestrates the advisory team, manages recurring tasks and templates, and coordinates work across advisors and human experts.",
        "callable": ["founder", "strategy", "technology", "funding", "finance", "legal", "growth", "qa-judge"],
        "mcp": ["notion", "slack"],
        "skills": [],
    },
]


def build_date_preamble() -> str:
    now = datetime.now(timezone.utc)
    return (
        f"Current date: {now.strftime('%A, %B %d, %Y')}. "
        f"Current time: {now.strftime('%H:%M')} UTC.\n"
        "Your training data has a knowledge cutoff. Always use web_search "
        "when you need current information, recent developments, or to verify "
        "claims about tools, frameworks, or market conditions.\n\n"
    )

ENVIRONMENT_NAME = "coach-env"


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"agents": {}, "environment_id": None}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def get_client(api_key: str | None = None) -> anthropic.Anthropic:
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        print("Error: Set ANTHROPIC_API_KEY or pass --api-key")
        sys.exit(1)
    return anthropic.Anthropic(api_key=key)


def create_environment(client: anthropic.Anthropic, state: dict) -> str:
    if state.get("environment_id"):
        print(f"  Environment already exists: {state['environment_id']}")
        return state["environment_id"]

    print("  Creating environment...")
    env = client.beta.environments.create(
        name=ENVIRONMENT_NAME,
        config={
            "type": "cloud",
            "networking": {"type": "unrestricted"},
        },
    )
    state["environment_id"] = env.id
    save_state(state)
    print(f"  Environment created: {env.id}")
    return env.id


def build_tools_list(config: dict) -> list[dict]:
    tools = [{"type": "agent_toolset_20260401"}]
    if MCP_ENABLED:
        for mcp_name in config.get("mcp", []):
            tools.append({"type": "mcp_toolset", "mcp_server_name": mcp_name})
    return tools


def build_mcp_servers(config: dict) -> list[dict]:
    if not MCP_ENABLED:
        return []
    servers = []
    for mcp_name in config.get("mcp", []):
        if mcp_name in MCP_SERVERS:
            servers.append(MCP_SERVERS[mcp_name])
    return servers


def create_agent(
    client: anthropic.Anthropic,
    config: dict,
    state: dict,
    callable_agent_ids: list[dict] | None = None,
) -> tuple[str, int]:
    dir_key = config["dir"]
    instructions_path = ROOT_DIR / config["dir"] / "INSTRUCTIONS.md"

    if not instructions_path.exists():
        print(f"  SKIP {config['name']}: no INSTRUCTIONS.md at {instructions_path}")
        return None, None

    system_prompt = build_date_preamble() + instructions_path.read_text()
    tools = build_tools_list(config)
    mcp_servers = build_mcp_servers(config)
    skills = config.get("skills", [])

    existing = state["agents"].get(dir_key)
    extra_body = {}
    if callable_agent_ids:
        extra_body["callable_agents"] = callable_agent_ids

    if existing:
        print(f"  Updating {config['name']} (id: {existing['id']})...")
        agent = client.beta.agents.update(
            existing["id"],
            version=existing["version"],
            system=system_prompt,
            description=config.get("description"),
            tools=tools,
            mcp_servers=mcp_servers if mcp_servers else None,
            skills=skills if skills else None,
            extra_body=extra_body if extra_body else None,
        )
    else:
        print(f"  Creating {config['name']}...")
        agent = client.beta.agents.create(
            name=config["name"],
            model=config["model"],
            system=system_prompt,
            description=config.get("description"),
            tools=tools,
            mcp_servers=mcp_servers if mcp_servers else None,
            skills=skills if skills else None,
            extra_body=extra_body if extra_body else None,
        )

    state["agents"][dir_key] = {
        "id": agent.id,
        "version": agent.version,
        "name": config["name"],
    }
    save_state(state)

    extras = []
    if mcp_servers:
        extras.append(f"mcp={[s['name'] for s in mcp_servers]}")
    if skills:
        extras.append(f"skills={[s['skill_id'] for s in skills]}")
    extra_str = f" ({', '.join(extras)})" if extras else ""
    print(f"  {config['name']}: id={agent.id} version={agent.version}{extra_str}")
    return agent.id, agent.version


def deploy(client: anthropic.Anthropic):
    print("\n=== Deploying Advisors ===\n")
    state = load_state()

    print("[1/3] Environment")
    create_environment(client, state)

    print("\n[2/3] Base agents (no callable_agents dependencies)")
    for config in COACH_CONFIGS:
        if not config.get("callable"):
            create_agent(client, config, state)

    print("\n[3/3] Agents with callable_agents")
    for config in COACH_CONFIGS:
        if config.get("callable"):
            callable_ids = []
            for dep_dir in config["callable"]:
                dep = state["agents"].get(dep_dir)
                if dep:
                    callable_ids.append(
                        {"type": "agent", "id": dep["id"], "version": dep["version"]}
                    )
                else:
                    print(f"  WARNING: dependency '{dep_dir}' not deployed yet")
            create_agent(client, config, state, callable_ids if callable_ids else None)

    print("\n=== Deployment Complete ===")
    print(f"State saved to: {STATE_FILE}")
    print("\nDeployed agents:")
    for key, info in state["agents"].items():
        print(f"  {info['name']}: {info['id']} (v{info['version']})")
    print(f"  Environment: {state['environment_id']}")


def list_agents(client: anthropic.Anthropic):
    state = load_state()
    if not state["agents"]:
        print("No agents deployed. Run 'deploy' first.")
        return

    print("\n=== Deployed Agents ===\n")
    for key, info in state["agents"].items():
        try:
            agent = client.beta.agents.retrieve(info["id"])
            print(f"  {agent.name}")
            print(f"    ID: {agent.id}")
            print(f"    Version: {agent.version}")
            print(f"    Model: {agent.model.id}")
            print(f"    Archived: {agent.archived_at or 'No'}")
            callable = getattr(agent, "callable_agents", None)
            if callable:
                print(f"    Callable agents: {len(callable)}")
            mcp = getattr(agent, "mcp_servers", None)
            if mcp:
                print(f"    MCP servers: {[s.name for s in mcp]}")
            skills = getattr(agent, "skills", None)
            if skills:
                print(f"    Skills: {[getattr(s, 'skill_id', str(s)) for s in skills]}")
            print()
        except Exception as e:
            print(f"  {info['name']}: ERROR - {e}\n")

    if state.get("environment_id"):
        print(f"  Environment: {state['environment_id']}")


def test_session(client: anthropic.Anthropic):
    state = load_state()

    tech_coach = state["agents"].get("technology")
    if not tech_coach:
        print("Error: Technology Advisor not deployed. Run 'deploy' first.")
        return

    env_id = state.get("environment_id")
    if not env_id:
        print("Error: No environment. Run 'deploy' first.")
        return

    print("\n=== Test Session: Technology Advisor ===\n")

    print("Creating session...")
    session = client.beta.sessions.create(
        agent=tech_coach["id"],
        environment_id=env_id,
    )
    print(f"Session: {session.id}")

    test_prompt = (
        "I'm building a SaaS product that needs to monitor LLM API spending across "
        "multiple providers (OpenAI, Anthropic, Google). I need a proxy layer. "
        "What should I use? Consider LiteLLM, Bifrost, and any other options. "
        "Be specific about tradeoffs and verify your recommendations with the QA Judge."
    )

    print(f"\nSending test prompt...\n")
    print(f"Prompt: {test_prompt}\n")
    print("--- Agent Response ---\n")

    with client.beta.sessions.events.stream(session.id) as stream:
        client.beta.sessions.events.send(
            session.id,
            events=[
                {
                    "type": "user.message",
                    "content": [{"type": "text", "text": test_prompt}],
                },
            ],
        )

        for event in stream:
            match event.type:
                case "agent.message":
                    for block in event.content:
                        if block.type == "text":
                            print(block.text, end="", flush=True)
                case "agent.tool_use":
                    tool_name = getattr(event, "name", "unknown")
                    print(f"\n[Tool: {tool_name}]", flush=True)
                case "session.status_idle":
                    break
                case "session.error":
                    error_msg = getattr(event.error, "message", "unknown")
                    print(f"\n[Error: {error_msg}]")
                    break

    print("\n\n--- End Response ---")
    print(f"\nSession ID: {session.id}")
    print("You can continue this session by sending more events to it.")


def cleanup(client: anthropic.Anthropic):
    state = load_state()

    print("\n=== Cleaning Up ===\n")

    for key, info in state["agents"].items():
        try:
            client.beta.agents.archive(info["id"])
            print(f"  Archived: {info['name']} ({info['id']})")
        except Exception as e:
            print(f"  Failed to archive {info['name']}: {e}")

    if state.get("environment_id"):
        try:
            client.beta.environments.archive(state["environment_id"])
            print(f"  Archived environment: {state['environment_id']}")
        except Exception as e:
            print(f"  Failed to archive environment: {e}")

    STATE_FILE.unlink(missing_ok=True)
    print("\nCleanup complete. State file removed.")


def main():
    parser = argparse.ArgumentParser(description="Deploy AI Executive Team advisors to Claude Managed Agents")
    parser.add_argument("command", choices=["deploy", "list", "test", "cleanup"])
    parser.add_argument("--api-key", help="Anthropic API key (or set ANTHROPIC_API_KEY)")
    args = parser.parse_args()

    load_dotenv()
    client = get_client(args.api_key)

    match args.command:
        case "deploy":
            deploy(client)
        case "list":
            list_agents(client)
        case "test":
            test_session(client)
        case "cleanup":
            cleanup(client)


if __name__ == "__main__":
    main()
