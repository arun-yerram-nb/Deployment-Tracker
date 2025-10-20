import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from dotenv import load_dotenv
import asyncio
import aiohttp
import nest_asyncio
from datetime import datetime

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise RuntimeError("GITHUB_TOKEN must be set in .env")

API_URL = "https://api.github.com"
ORG_NAME = "NationsBenefits"
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}

app = Flask(__name__)
nest_asyncio.apply()
CORS(app)

# ---------- Fetch igloo* repos ----------
@app.route("/api/repos")
def get_repos():
    repos = []
    page = 1
    while True:
        r = requests.get(f"{API_URL}/orgs/{ORG_NAME}/repos", headers=HEADERS, params={"per_page": 100, "page": page})
        if r.status_code != 200:
            return jsonify({"error": r.text}), r.status_code
        data = r.json()
        if not data:
            break
        repos.extend([repo["name"] for repo in data if repo["name"].startswith("igloo")])
        page += 1
    return jsonify({"repos": repos})

# ---------- People endpoint ----------
@app.route("/api/people")
def get_people():
    search_term = request.args.get("search", "").strip().lower()
    users = []
    page = 1
    while True:
        url = f"{API_URL}/orgs/{ORG_NAME}/members?per_page=100&page={page}"
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code != 200:
            return jsonify({"error": r.text}), r.status_code
        data = r.json()
        if not data:
            break
        users.extend([member["login"] for member in data])
        page += 1
    if search_term:
        users = [u for u in users if search_term in u.lower()]
    return jsonify({"people": users})


# ---------- Release tags endpoints ----------
@app.route("/api/all-tags")
def all_tags():
    """
    Returns all unique release tags across all repos.
    """
    releases = asyncio.run(fetch_user_releases("", ""))
    items = releases.get("items", [])
    tags = sorted(list({r["tag_name"] for r in items if r.get("tag_name")}))
    return jsonify({"tags": tags})

@app.route("/api/repos-by-tag")
def repos_by_tag():
    """
    Returns all repos/releases for a specific release tag.
    """
    tag = request.args.get("tag", "").strip()
    if not tag:
        return jsonify({"error": "tag parameter is required"}), 400

    releases = asyncio.run(fetch_user_releases("", ""))
    items = releases.get("items", [])
    filtered = [r for r in items if r.get("tag_name") == tag]
    return jsonify({"repos": filtered})


# ---------- Fetch all PRs ----------
@app.route("/api/prs/all")
def get_all_prs():
    username = request.args.get("username", "").strip()
    selected_repo = request.args.get("repo", "").strip()
    from_date = request.args.get("from_date", "").strip()
    to_date = request.args.get("to_date", "").strip()

    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
    except ValueError:
        return jsonify({"error": "page/per_page must be integers"}), 400

    prs_result = asyncio.run(fetch_all_prs(username, selected_repo, from_date, to_date))

    # Sort by created_at descending
    prs_result.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    total_count = len(prs_result)
    start = (page - 1) * per_page
    end = start + per_page
    paginated = prs_result[start:end]

    return jsonify({
        "items": paginated,
        "total_count": total_count,
        "page": page,
        "per_page": per_page
    })

async def fetch_all_prs(username, selected_repo, from_date, to_date):
    async with aiohttp.ClientSession(headers=HEADERS) as session:
        # Step 1: Get all repos
        all_repos = await fetch_all_repos(session)
        igloo_repos = [repo for repo in all_repos if repo.startswith("igloo")]
        if selected_repo:
            igloo_repos = [selected_repo] if selected_repo in igloo_repos else []

        # Step 2: Fetch PRs concurrently for all repos
        tasks = [fetch_repo_prs(session, repo, username, from_date, to_date) for repo in igloo_repos]
        results = await asyncio.gather(*tasks)
        prs = [pr for repo_prs in results for pr in repo_prs]
        return prs

async def fetch_all_repos(session):
    repos = []
    page = 1
    while True:
        url = f"{API_URL}/orgs/{ORG_NAME}/repos?per_page=100&page={page}"
        async with session.get(url) as resp:
            if resp.status != 200:
                break
            data = await resp.json()
            if not data:
                break
            repos.extend([repo["name"] for repo in data])
            page += 1
    return repos

async def fetch_repo_prs(session, repo, username, from_date, to_date):
    prs = []
    page = 1
    while True:
        url = f"{API_URL}/repos/{ORG_NAME}/{repo}/pulls?state=all&per_page=100&page={page}"
        async with session.get(url) as resp:
            if resp.status != 200:
                break
            data = await resp.json()
            if not data:
                break
            for pr in data:
                pr_user = pr.get("user", {}).get("login", "")
                pr_created_at = pr.get("created_at")
                if username and pr_user.lower() != username.lower():
                    continue
                if from_date and pr_created_at < from_date:
                    continue
                if to_date and pr_created_at > to_date:
                    continue
                state = pr.get("state")
                if pr.get("merged_at"):
                    state = "merged"
                prs.append({
                    "title": pr.get("title"),
                    "number": pr.get("number"),
                    "html_url": pr.get("html_url"),
                    "state": state,
                    "created_at": pr.get("created_at"),
                    "updated_at": pr.get("updated_at"),
                    "repo_name": repo,
                    "repo_owner": ORG_NAME
                })
            page += 1
    return prs

# ---------- User releases endpoint ----------
@app.route("/api/user-releases")
def get_user_releases():
    username = request.args.get("username", "").strip()
    selected_repo = request.args.get("repo", "").strip()

    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
    except ValueError:
        return jsonify({"error": "page/per_page must be integers"}), 400

    result = asyncio.run(fetch_user_releases(username, selected_repo))
    all_releases = result.get("items", [])

    all_releases.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    total_count = len(all_releases)
    start = (page - 1) * per_page
    end = start + per_page
    paginated = all_releases[start:end]

    return jsonify({
        "items": paginated,
        "total_count": total_count,
        "page": page,
        "per_page": per_page
    })

async def fetch_user_releases(username, selected_repo):
    async with aiohttp.ClientSession(headers=HEADERS) as session:
        all_repos = await fetch_all_repos(session)
        igloo_repos = [repo for repo in all_repos if repo.startswith("igloo")]
        if selected_repo:
            igloo_repos = [selected_repo] if selected_repo in igloo_repos else []
        tasks = [fetch_releases(session, repo, username) for repo in igloo_repos]
        results = await asyncio.gather(*tasks)
        releases = [r for repo_releases in results for r in repo_releases]
        return {"items": releases, "total_count": len(releases)}

async def fetch_releases(session, repo, username):
    url = f"{API_URL}/repos/{ORG_NAME}/{repo}/releases"
    async with session.get(url) as resp:
        if resp.status != 200:
            return []
        data = await resp.json()
        releases = []
        for rel in data:
            author_login = rel.get("author", {}).get("login")
            if not username or (author_login and author_login.lower() == username.lower()):
                releases.append({
                    "name": rel.get("name"),
                    "tag_name": rel.get("tag_name"),
                    "repo_name": repo,
                    "html_url": rel.get("html_url"),
                    "created_at": rel.get("created_at")
                })
        return releases

# ---------- Health check ----------
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(debug=True)




