import os
import re
import json
import threading
import asyncio
import aiohttp
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import nest_asyncio

# 1595
# 6837

# =========================================================
# 🔹 Environment Setup
# =========================================================

# Load environment variables from .env file
load_dotenv()

# GitHub Personal Access Token (Required)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise RuntimeError("GITHUB_TOKEN must be set in .env")

# Organization and API configuration
ORG_NAME = "NationsBenefits"
GRAPHQL_URL = "https://api.github.com/graphql"
API_URL = "https://api.github.com"

# Standard headers for GitHub API calls
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
}

# Jira base URL for linking tickets
JIRA_BASE_URL = "https://nationsbenefits.atlassian.net/browse"

# =========================================================
# 🔹 Flask App Initialization
# =========================================================

# Allow nested event loops (important for async inside Flask)
nest_asyncio.apply()

app = Flask(__name__)

# Enable CORS for frontend access
CORS(app)

# =========================================================
# 🔹 Utility Functions
# =========================================================

def extract_jira_key(text):
    """
    Extract Jira ticket key from text (e.g., NB-1234)
    """
    if not text:
        return None
    match = re.search(r"[A-Z]{2,10}-\d+", text)
    return match.group(0) if match else None


# =========================================================
# 🔹 Background Async Event Loop
# =========================================================

# Create a dedicated background event loop
_bg_loop = asyncio.new_event_loop()

def _loop_runner(loop):
    """
    Runs the async event loop in a separate thread.
    """
    asyncio.set_event_loop(loop)
    loop.run_forever()

# Start background thread
threading.Thread(target=_loop_runner, args=(_bg_loop,), daemon=True).start()

def run_async(coro):
    """
    Execute async coroutine from sync Flask routes.
    """
    future = asyncio.run_coroutine_threadsafe(coro, _bg_loop)
    return future.result()


# =========================================================
# 🔹 Repository Loader
# =========================================================

async def fetch_all_repos():
    """
    Load repository list from repos.json file.
    """
    try:
        with open("repo_names.json", "r") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"[ERROR] Failed to read repos.json: {e}")
        return []


# =========================================================
# 🔹 Pull Requests Logic
# =========================================================

async def fetch_prs_for_repo(session, repo, username=None):
    """
    Fetch pull requests for a given repository using GitHub GraphQL API.
    Optionally filter by username.
    """

    query = """
    query($owner: String!, $name: String!, $first: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequests(first: $first, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            title
            number
            url
            state
            createdAt
            updatedAt
            mergedAt
            headRefName
            author { login }
            reviewRequests(first: 50) {
              nodes {
                requestedReviewer {
                  ... on User { login }
                  ... on Team { name }
                }
              }
            }
            reviews(first: 50, states: APPROVED) {
              nodes {
                author { login }
              }
            }
          }
        }
      }
    }
    """

    variables = {"owner": ORG_NAME, "name": repo, "first": 100}

    try:
        async with session.post(
            GRAPHQL_URL, json={"query": query, "variables": variables}
        ) as r:

            if r.status != 200:
                print(f"[ERROR] Failed PR fetch for {repo}: {r.status}")
                return []

            data = await r.json()

    except Exception as e:
        print(f"[ERROR] Exception fetching PRs for {repo}: {e}")
        return []

    repo_data = data.get("data", {}).get("repository")
    if not repo_data:
        return []

    result = []

    for n in repo_data.get("pullRequests", {}).get("nodes", []):
        author = n.get("author", {}).get("login")

        # Filter by username (if provided)
        if username and (author or "").lower() != username.lower():
            continue

        # Determine PR state
        state = "merged" if n.get("mergedAt") else n.get("state", "").lower()

        # Extract reviewers
        requested_reviewers = [
            rr.get("requestedReviewer", {}).get("login")
            or rr.get("requestedReviewer", {}).get("name")
            for rr in n.get("reviewRequests", {}).get("nodes", [])
            if rr.get("requestedReviewer")
        ]

        # Extract approvers
        approvers = [
            rev.get("author", {}).get("login")
            for rev in n.get("reviews", {}).get("nodes", [])
            if rev.get("author")
        ]

        # Extract Jira key
        jira_key = (
            extract_jira_key(n.get("title"))
            or extract_jira_key(n.get("headRefName"))
        )

        # Build final response object
        result.append({
            "title": n.get("title"),
            "number": n.get("number"),
            "html_url": n.get("url"),
            "state": state,
            "created_at": n.get("createdAt"),
            "updated_at": n.get("updatedAt"),
            "repo_name": repo,
            "repo_owner": ORG_NAME,
            "author": author,
            "requested_reviewers": requested_reviewers,
            "approvers": approvers,
            "jira_key": jira_key,
            "jira_url": f"{JIRA_BASE_URL}/{jira_key}" if jira_key else None,
        })

    return result


async def fetch_all_prs(username=None):
    """
    Fetch PRs from all repositories concurrently.
    """
    repos = await fetch_all_repos()

    async with aiohttp.ClientSession(headers=HEADERS) as session:
        tasks = [fetch_prs_for_repo(session, repo, username) for repo in repos]
        results = await asyncio.gather(*tasks)

        # Flatten list
        prs = [pr for sub in results for pr in sub]

        # Sort by creation date
        prs.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        return prs


# =========================================================
# 🔹 Releases Logic
# =========================================================

async def fetch_releases_per_repo(session, repo):
    """
    Fetch releases for a repository using GitHub REST API.
    """
    url = f"{API_URL}/repos/{ORG_NAME}/{repo}/releases"

    try:
        async with session.get(url) as resp:
            if resp.status != 200:
                print(f"[ERROR] Failed release fetch for {repo}: {resp.status}")
                return []

            data = await resp.json()

            return [
                {
                    "name": rel.get("name"),
                    "author": rel.get("author", {}).get("login"),
                    "tag_name": rel.get("tag_name"),
                    "repo_name": repo,
                    "html_url": rel.get("html_url"),
                    "created_at": rel.get("created_at"),
                }
            ]

    except Exception as e:
        print(f"[ERROR] Exception fetching releases for {repo}: {e}")
        return []


async def fetch_all_releases(selected_repo=None):
    """
    Fetch releases across repositories with optional filtering.
    """
    repos = await fetch_all_repos()

    async with aiohttp.ClientSession(headers=HEADERS) as session:
        tasks = [fetch_releases_per_repo(session, repo) for repo in repos]
        results = await asyncio.gather(*tasks)

        releases = [r for sub in results for r in sub]
        releases.sort(key=lambda r: r.get("created_at") or "", reverse=True)

        return releases

# =========================================================
# 🔹 API Endpoints
# =========================================================

@app.route("/api/user-prs")
def get_user_prs():
    """
    Get pull requests for a user.
    """
    username = request.args.get("username", "").strip() or None

    try:
        prs = run_async(fetch_all_prs(username))
        return jsonify({"items": prs, "total_count": len(prs)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/user-releases")
def get_user_releases():
    """
    Get releases for a user.
    """
    # username = request.args.get("username", "").strip() or None
    repo = request.args.get("repo", "").strip() or None

    try:
        releases = run_async(fetch_all_releases(repo))
        return jsonify({
            "items": releases,
            "total_count": len(releases)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================================================
# 🔹 Entry Point (Production Ready)
# =========================================================

if __name__ == "__main__":
    # NOTE:
    # - debug=False for production
    # - Use gunicorn/uwsgi in real deployments
    app.run(host="0.0.0.0", port=5000, debug=False)