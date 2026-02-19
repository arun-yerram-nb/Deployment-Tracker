import os
import json
import asyncio
import aiohttp
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import nest_asyncio

# -------------------- Load env and apply async patch --------------------
load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise RuntimeError("GITHUB_TOKEN must be set in .env")

ORG_NAME = "NationsBenefits"
GRAPHQL_URL = "https://api.github.com/graphql"
API_URL = "https://api.github.com"
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}

nest_asyncio.apply()
app = Flask(__name__)
CORS(app)

# -------------------- Async helper functions --------------------

async def fetch_all_repos():
    """Reads all repository names from repos.json and returns as a list."""
    try:
        with open("repos.json", "r") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        else:
            print("repos.json should be a JSON array of repo names")
            return []
    except Exception as e:
        print(f"Error reading repos.json: {e}")
        return []


async def fetch_all_users():
    """Reads all users from people.json and returns as a list."""
    try:
        with open("people.json", "r") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        else:
            print("people.json should be a JSON array of usernames")
            return []
    except Exception as e:
        print(f"Error reading people.json: {e}")
        return []


async def fetch_prs_for_repo(session, repo, username=None):
    """Fetch PRs for a single repository using GraphQL, including reviewers & approvers."""
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
        async with session.post(GRAPHQL_URL, headers=HEADERS, json={"query": query, "variables": variables}) as r:
            if r.status != 200:
                print(f"Failed to fetch PRs for {repo}, status {r.status}")
                return []
            data = await r.json()
    except Exception as e:
        print(f"Error fetching {repo}: {e}")
        return []

    nodes = data.get("data", {}).get("repository", {}).get("pullRequests", {}).get("nodes", [])
    result = []

    for n in nodes:
        author_login = n.get("author", {}).get("login")
        if username and (author_login or "").lower() != username.lower():
            continue

        state = n.get("state", "").lower()
        if n.get("mergedAt"):
            state = "merged"

        # Extract requested reviewers
        requested_reviewers = []
        for rr in n.get("reviewRequests", {}).get("nodes", []):
            rv = rr.get("requestedReviewer")
            if rv:
                requested_reviewers.append(rv.get("login") or rv.get("name"))

        # Extract approvers (approved reviewers)
        approvers = []
        for rev in n.get("reviews", {}).get("nodes", []):
            auth = rev.get("author", {}).get("login")
            if auth:
                approvers.append(auth)

        result.append({
            "title": n.get("title"),
            "number": n.get("number"),
            "html_url": n.get("url"),
            "state": state,
            "created_at": n.get("createdAt"),
            "updated_at": n.get("updatedAt"),
            "repo_name": repo,
            "repo_owner": ORG_NAME,
            "author": author_login,
            "requested_reviewers": requested_reviewers,
            "approvers": approvers
        })
    return result


async def fetch_all_prs(username=None):
    """Fetch PRs for all repositories concurrently."""
    all_repos = await fetch_all_repos()
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_prs_for_repo(session, repo, username) for repo in all_repos]
        results = await asyncio.gather(*tasks)
        prs = [pr for sublist in results for pr in sublist]
        prs.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return prs

# -------------------- Releases helper --------------------

async def fetch_releases(session, repo, username=None):
    url = f"{API_URL}/repos/{ORG_NAME}/{repo}/releases"
    try:
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
                        "author": author_login,
                        "tag_name": rel.get("tag_name"),
                        "repo_name": repo,
                        "html_url": rel.get("html_url"),
                        "created_at": rel.get("created_at")
                    })
            return releases
    except Exception as e:
        print(f"Error fetching releases for {repo}: {e}")
        return []


async def fetch_user_releases(username=None, selected_repo=None):
    all_repos = await fetch_all_repos()
    if selected_repo:
        all_repos = [selected_repo] if selected_repo in all_repos else []
    async with aiohttp.ClientSession(headers=HEADERS) as session:
        tasks = [fetch_releases(session, repo, username) for repo in all_repos]
        results = await asyncio.gather(*tasks)
        releases = [r for sublist in results for r in sublist]
        releases.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return releases

# -------------------- API Endpoints --------------------

@app.route("/api/user-prs")
def get_user_prs():
    username = request.args.get("username", "").strip()
    prs = asyncio.run(fetch_all_prs(username=username))
    return jsonify({"items": prs, "total_count": len(prs)})


@app.route("/api/user-releases")
def get_user_releases():
    username = request.args.get("username", "").strip()
    selected_repo = request.args.get("repo", "").strip()
    print(f"Fetching releases for user: {username}, repo: {selected_repo}")

    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
    except ValueError:
        return jsonify({"error": "page/per_page must be integers"}), 400

    releases = asyncio.run(fetch_user_releases(username=username, selected_repo=selected_repo))
    total_count = len(releases)
    start = (page - 1) * per_page
    end = start + per_page
    paginated = releases[start:end]

    return jsonify({
        "items": paginated,
        "total_count": total_count,
        "page": page,
        "per_page": per_page
    })



if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
 
 
 
 
 
 
 
 
 
#  import os
# import json
# import threading
# import asyncio
# import aiohttp
# from flask import Flask, jsonify, request
# from flask_cors import CORS
# from dotenv import load_dotenv

# load_dotenv()
# GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
# if not GITHUB_TOKEN:
#     raise RuntimeError("GITHUB_TOKEN must be set in .env")

# ORG_NAME = "NationsBenefits"
# GRAPHQL_URL = "https://api.github.com/graphql"
# API_URL = "https://api.github.com"
# HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}

# app = Flask(__name__)
# CORS(app)

# # === Setup a background asyncio event loop running on a separate thread ===

# _bg_loop = asyncio.new_event_loop()

# def _loop_thread_runner(loop):
#     asyncio.set_event_loop(loop)
#     loop.run_forever()

# threading.Thread(target=_loop_thread_runner, args=(_bg_loop,), daemon=True).start()

# def run_async(coro):
#     """Schedule a coroutine on the background loop and return its result."""
#     future = asyncio.run_coroutine_threadsafe(coro, _bg_loop)
#     return future.result()

# # === Define async functions similar to your original ones ===

# async def fetch_prs_for_repo(repo, username=None):
#     async with aiohttp.ClientSession(headers=HEADERS) as session:
#         query = """
#         query($owner: String!, $name: String!, $first: Int!) {
#           repository(owner: $owner, name: $name) {
#             pullRequests(first: $first, orderBy: {field: CREATED_AT, direction: DESC}) {
#               nodes {
#                 title
#                 number
#                 url
#                 state
#                 createdAt
#                 updatedAt
#                 mergedAt
#                 author { login }
#                 reviewRequests(first: 50) {
#                   nodes {
#                     requestedReviewer {
#                       ... on User { login }
#                       ... on Team { name }
#                     }
#                   }
#                 }
#                 reviews(first: 50, states: APPROVED) {
#                   nodes {
#                     author { login }
#                   }
#                 }
#               }
#             }
#           }
#         }
#         """
#         variables = {"owner": ORG_NAME, "name": repo, "first": 100}
#         async with session.post(GRAPHQL_URL, json={"query": query, "variables": variables}) as r:
#             if r.status != 200:
#                 print(f"Failed to fetch PRs for {repo}, status {r.status}")
#                 return []
#             data = await r.json()

#     nodes = data.get("data", {}).get("repository", {}).get("pullRequests", {}).get("nodes", [])
#     result = []
#     for n in nodes:
#         author_login = n.get("author", {}).get("login")
#         if username and (author_login or "").lower() != username.lower():
#             continue
#         state = n.get("state", "").lower()
#         if n.get("mergedAt"):
#             state = "merged"

#         requested_reviewers = []
#         for rr in n.get("reviewRequests", {}).get("nodes", []):
#             rv = rr.get("requestedReviewer")
#             if rv:
#                 requested_reviewers.append(rv.get("login") or rv.get("name"))

#         approvers = []
#         for rev in n.get("reviews", {}).get("nodes", []):
#             auth = rev.get("author", {}).get("login")
#             if auth:
#                 approvers.append(auth)

#         result.append({
#             "title": n.get("title"),
#             "number": n.get("number"),
#             "html_url": n.get("url"),
#             "state": state,
#             "created_at": n.get("createdAt"),
#             "updated_at": n.get("updatedAt"),
#             "repo_name": repo,
#             "repo_owner": ORG_NAME,
#             "author": author_login,
#             "requested_reviewers": requested_reviewers,
#             "approvers": approvers
#         })
#     return result

# async def fetch_all_prs(username=None):
#     try:
#         with open("repos.json", "r") as f:
#             all_repos = json.load(f)
#     except Exception as e:
#         print(f"Error reading repos.json: {e}")
#         return []

#     tasks = [fetch_prs_for_repo(repo, username) for repo in all_repos]
#     results = await asyncio.gather(*tasks)
#     prs = [pr for sub in results for pr in sub]
#     prs.sort(key=lambda x: x.get("created_at") or "", reverse=True)
#     return prs

# async def fetch_releases_for_repo(repo, username=None):
#     async with aiohttp.ClientSession(headers=HEADERS) as session:
#         url = f"{API_URL}/repos/{ORG_NAME}/{repo}/releases"
#         async with session.get(url) as resp:
#             if resp.status != 200:
#                 return []
#             data = await resp.json()

#     releases = []
#     for rel in data:
#         author_login = rel.get("author", {}).get("login")
#         if not username or (author_login and author_login.lower() == username.lower()):
#             releases.append({
#                 "name": rel.get("name"),
#                 "author": author_login,
#                 "tag_name": rel.get("tag_name"),
#                 "repo_name": repo,
#                 "html_url": rel.get("html_url"),
#                 "created_at": rel.get("created_at")
#             })
#     return releases

# async def fetch_user_releases(username=None, selected_repo=None):
#     try:
#         with open("repos.json", "r") as f:
#             all_repos = json.load(f)
#     except Exception as e:
#         print(f"Error reading repos.json: {e}")
#         return []

#     if selected_repo:
#         all_repos = [selected_repo] if selected_repo in all_repos else []

#     tasks = [fetch_releases_for_repo(repo, username) for repo in all_repos]
#     results = await asyncio.gather(*tasks)
#     releases = [r for sub in results for r in sub]
#     releases.sort(key=lambda r: r.get("created_at") or "", reverse=True)
#     return releases

# # === Flask endpoints — synchronous, but schedule async work via run_async() ===

# @app.route("/api/user-prs")
# def get_user_prs():
#     username = request.args.get("username", "").strip() or None
#     try:
#         prs = run_async(fetch_all_prs(username=username))
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500
#     return jsonify({"items": prs, "total_count": len(prs)})

# @app.route("/api/user-releases")
# def get_user_releases():
#     username = request.args.get("username", "").strip() or None
#     selected_repo = request.args.get("repo", "").strip() or None
#     try:
#         page = int(request.args.get("page", 1))
#         per_page = int(request.args.get("per_page", 10))
#     except ValueError:
#         return jsonify({"error": "page/per_page must be integers"}), 400

#     try:
#         releases = run_async(fetch_user_releases(username=username, selected_repo=selected_repo))
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

#     total_count = len(releases)
#     start = (page - 1) * per_page
#     end = start + per_page
#     paginated = releases[start:end]

#     return jsonify({
#         "items": paginated,
#         "total_count": total_count,
#         "page": page,
#         "per_page": per_page
#     })

# if __name__ == "__main__":
#     app.run(host="0.0.0.0", debug=True)
 